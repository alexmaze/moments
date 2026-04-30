import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';

type CleanupSummary = {
  scanned: number;
  deleted: number;
  failed: number;
  skippedReattached: number;
  dryRun: number;
  byPurpose: Partial<Record<'post_attachment' | 'user_avatar' | 'space_cover', number>>;
  pendingScanned: number;
  pendingDeleted: number;
  pendingFailed: number;
  pendingSkippedAttached: number;
};

@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupService.name);
  private readonly intervalMs = 60 * 60 * 1000;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Media cleanup worker disabled');
      return;
    }

    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);

    this.logger.log(`Media cleanup worker started, interval=${this.intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (this.isRunning) {
      this.logger.warn('Skip media cleanup run because previous run is still active');
      return;
    }

    this.isRunning = true;
    const retentionDays = this.getRetentionDays();
    const pendingMaxAgeHours = this.getPendingMaxAgeHours();
    const batchSize = this.getBatchSize();
    const dryRun = this.isDryRun();

    try {
      const candidates = await this.mediaService.listExpiredOrphanedAssets(retentionDays, batchSize);
      const summary: CleanupSummary = {
        scanned: candidates.length,
        deleted: 0,
        failed: 0,
        skippedReattached: 0,
        dryRun: 0,
        byPurpose: {},
        pendingScanned: 0,
        pendingDeleted: 0,
        pendingFailed: 0,
        pendingSkippedAttached: 0,
      };

      for (const asset of candidates) {
        if (asset.purpose) {
          summary.byPurpose[asset.purpose] = (summary.byPurpose[asset.purpose] ?? 0) + 1;
        }

        if (await this.mediaService.restoreAttachedIfReferenced(asset.id)) {
          summary.skippedReattached += 1;
          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              purpose: asset.purpose,
              status: asset.status,
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'skipped_referenced',
            }),
          );
          continue;
        }

        if (dryRun) {
          summary.dryRun += 1;
          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              purpose: asset.purpose,
              status: asset.status,
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'dry_run',
            }),
          );
          continue;
        }

        try {
          await this.mediaService.deleteStoredFiles(asset);
          const deleted = await this.mediaService.deleteAssetRecord(asset.id, 'orphaned');
          if (!deleted) {
            // Asset was concurrently re-attached between COS deletion and DB deletion
            summary.skippedReattached += 1;
            await this.mediaService.recordCleanupFailure(asset.id, new Error('COS files deleted but asset was concurrently re-attached'));
            this.logger.warn(
              JSON.stringify({
                mediaId: asset.id,
                purpose: asset.purpose,
                status: asset.status,
                storagePath: asset.storagePath,
                result: 'skipped_concurrent_reattach',
              }),
            );
            continue;
          }
          summary.deleted += 1;

          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              purpose: asset.purpose,
              status: asset.status,
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'deleted',
            }),
          );
        } catch (error) {
          summary.failed += 1;
          await this.mediaService.recordCleanupFailure(asset.id, error);

          this.logger.error(
            JSON.stringify({
              mediaId: asset.id,
              purpose: asset.purpose,
              status: asset.status,
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'failed',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // --- Clean up stale pending assets (abandoned uploads) ---
      const pendingCandidates = await this.mediaService.listStalePendingAssets(pendingMaxAgeHours, batchSize);
      summary.pendingScanned = pendingCandidates.length;

      for (const asset of pendingCandidates) {
        // Double-check: if the asset was attached in the meantime, skip it
        if (await this.mediaService.isReferenced(asset.id)) {
          summary.pendingSkippedAttached += 1;
          // Fix the status without overwriting purpose (the business flow will set it correctly)
          await this.mediaService.markAttachedWithoutPurpose(asset.id);
          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              status: 'pending',
              storagePath: asset.storagePath,
              result: 'pending_skipped_attached',
            }),
          );
          continue;
        }

        if (dryRun) {
          summary.dryRun += 1;
          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              status: 'pending',
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'pending_dry_run',
            }),
          );
          continue;
        }

        try {
          await this.mediaService.deleteStoredFiles(asset);
          const deleted = await this.mediaService.deleteAssetRecord(asset.id, 'pending');
          if (!deleted) {
            // Asset was concurrently attached between COS deletion and DB deletion
            summary.pendingSkippedAttached += 1;
            await this.mediaService.recordCleanupFailure(asset.id, new Error('COS files deleted but asset was concurrently attached'));
            this.logger.warn(
              JSON.stringify({
                mediaId: asset.id,
                status: 'pending',
                storagePath: asset.storagePath,
                result: 'pending_skipped_concurrent_attach',
              }),
            );
            continue;
          }
          summary.pendingDeleted += 1;

          this.logger.log(
            JSON.stringify({
              mediaId: asset.id,
              status: 'pending',
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'pending_deleted',
            }),
          );
        } catch (error) {
          summary.pendingFailed += 1;
          await this.mediaService.recordCleanupFailure(asset.id, error);

          this.logger.error(
            JSON.stringify({
              mediaId: asset.id,
              status: 'pending',
              storagePath: asset.storagePath,
              coverPath: asset.coverPath,
              result: 'pending_failed',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      this.logger.log(
        JSON.stringify({
          event: 'media_cleanup_summary',
          retentionDays,
          pendingMaxAgeHours,
          batchSize,
          dryRunEnabled: dryRun,
          ...summary,
        }),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private isEnabled() {
    return this.configService.get<string>('MEDIA_CLEANUP_ENABLED', 'true') === 'true';
  }

  private isDryRun() {
    return this.configService.get<string>('MEDIA_CLEANUP_DRY_RUN', 'false') === 'true';
  }

  private getRetentionDays() {
    return Number.parseInt(this.configService.get<string>('MEDIA_CLEANUP_RETENTION_DAYS', '7'), 10) || 7;
  }

  private getPendingMaxAgeHours() {
    return Number.parseInt(this.configService.get<string>('MEDIA_CLEANUP_PENDING_MAX_AGE_HOURS', '24'), 10) || 24;
  }

  private getBatchSize() {
    return Number.parseInt(this.configService.get<string>('MEDIA_CLEANUP_BATCH_SIZE', '100'), 10) || 100;
  }
}
