import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { format } from 'date-fns';
import type { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg');
import { randomUUID } from 'crypto';
import { join, posix } from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { and, eq, inArray, lte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets, postMediaRelations, posts, spaces, users } from '@moments/db';
import { STORAGE_PROVIDER } from './storage/storage.module';
import { IStorageProvider } from './storage/storage.interface';
import { StorageConfigService, type StorageConfig, type CiConfig } from './storage/storage.config';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
const ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES, ...ALLOWED_AUDIO_MIMES];
type MediaPurpose = 'post_attachment' | 'user_avatar' | 'space_cover';
type DbExecutor = DrizzleClient | any;

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

@Injectable()
export class MediaService {
  private readonly keyPrefix: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly storageConfig: StorageConfig;
  private readonly ciConfig: StorageConfig['ci'];

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
    storageConfigService: StorageConfigService,
  ) {
    const config = storageConfigService.getConfig();
    this.storageConfig = config;
    this.keyPrefix = config.keyPrefix;
    this.signedUrlTtlSeconds = config.signedUrlTtlSeconds;
    this.ciConfig = config.ci;
  }

  async uploadFile(file: Express.Multer.File, uploaderId: string) {
    const normalizedMimeType = normalizeMimeType(file.mimetype);

    // 1. Validate MIME type
    if (!ALLOWED_MIMES.includes(normalizedMimeType)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const isVideo = ALLOWED_VIDEO_MIMES.includes(normalizedMimeType);
    const isAudio = ALLOWED_AUDIO_MIMES.includes(normalizedMimeType);
    const type = isVideo ? 'video' : isAudio ? 'audio' : 'image';
    const assetId = randomUUID();
    const originalKey = this.buildOriginalObjectKey(assetId, file.originalname, normalizedMimeType, isAudio ? 'audio' : undefined);

    // 2. Store file
    const datePath = format(new Date(), 'yyyy/MM/dd');
    const saved = await this.storageProvider.putObject({
      key: originalKey,
      body: file.buffer,
      contentType: normalizedMimeType,
      contentLength: file.size,
      cacheControl: `private, max-age=${this.signedUrlTtlSeconds}`,
    });

    // 3. Extract metadata
    let width: number | undefined;
    let height: number | undefined;
    let durationMs: number | undefined;
    let coverPath: string | undefined;
    let coverUrl: string | undefined;

    if (!isVideo && !isAudio) {
      // Extract image dimensions
      try {
        const meta = await sharp(file.buffer).metadata();
        width = meta.width;
        height = meta.height;
      } catch {
        // Non-critical: proceed without dimensions
      }
    } else if (isVideo) {
      // Extract video first frame as cover + metadata
      try {
        const result = await this.extractVideoMetadata(file.buffer, assetId);
        width = result.width;
        height = result.height;
        durationMs = result.durationMs;
        coverPath = result.coverPath;
        coverUrl = result.coverUrl;
      } catch (error) {
        // Non-critical: proceed without cover, but log for debugging
        console.error('Failed to extract video metadata:', error);
      }
    } else {
      try {
        durationMs = await this.extractAudioDuration(file.buffer, file.originalname || 'audio');
      } catch (error) {
        throw new BadRequestException(`Failed to read audio metadata: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 4. Insert DB record
    const [asset] = await this.db.insert(mediaAssets).values({
      id: assetId,
      uploaderId,
      type,
      storageProvider: this.storageProvider.kind,
      bucket: this.storageConfig.tencentCos.bucket,
      objectKey: saved.key,
      etag: saved.etag,
      storagePath: saved.key,
      publicUrl: this.storageProvider.getObjectUrl(saved.key),
      coverPath: coverPath || null,
      coverUrl: coverUrl || null,
      mimeType: normalizedMimeType,
      sizeBytes: saved.sizeBytes,
      width: width || null,
      height: height || null,
      durationMs: durationMs || null,
      status: 'pending',
    }).returning();

    return this.toAssetDto(asset);
  }

  async getById(id: string) {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return asset ? this.toAssetDto(asset) : null;
  }

  async requireOwnedPendingAsset(id: string, uploaderId: string, type: 'image' | 'video' | 'audio' | 'any' = 'any') {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(and(
        eq(mediaAssets.id, id),
        eq(mediaAssets.uploaderId, uploaderId),
        or(eq(mediaAssets.status, 'pending'), eq(mediaAssets.status, 'orphaned')),
      ))
      .limit(1);

    if (!asset) {
      throw new BadRequestException('Media asset is invalid, not owned by you, or already attached elsewhere');
    }

    if (type !== 'any' && asset.type !== type) {
      throw new BadRequestException(`Media asset must be a ${type}`);
    }

    return asset;
  }

  async markAttached(ids: string[], purpose: MediaPurpose, tx?: any) {
    if (ids.length === 0) return;
    const executor = this.getExecutor(tx);
    await executor
      .update(mediaAssets)
      .set({
        status: 'attached',
        purpose,
        orphanedAt: null,
        cleanupError: null,
      })
      .where(inArray(mediaAssets.id, ids));
  }

  async attachAsset(id: string, purpose: MediaPurpose, tx?: any) {
    const executor = this.getExecutor(tx);
    await executor
      .update(mediaAssets)
      .set({
        status: 'attached',
        purpose,
        orphanedAt: null,
        cleanupError: null,
      })
      .where(eq(mediaAssets.id, id));
  }

  /**
   * Mark an asset as attached without overwriting its purpose.
   * Used by the cleanup worker when it discovers a pending asset that was
   * concurrently attached by a business flow (avatar, cover, post).
   */
  async markAttachedWithoutPurpose(id: string, tx?: any) {
    const executor = this.getExecutor(tx);
    await executor
      .update(mediaAssets)
      .set({
        status: 'attached',
        orphanedAt: null,
        cleanupError: null,
      })
      .where(eq(mediaAssets.id, id));
  }

  async markOrphanedIfUnreferenced(id: string, tx?: any) {
    const executor = this.getExecutor(tx);

    if (await this.hasAnyReference(id, executor)) {
      await executor
        .update(mediaAssets)
        .set({
          status: 'attached',
          orphanedAt: null,
          cleanupError: null,
        })
        .where(eq(mediaAssets.id, id));
      return false;
    }

    await executor
      .update(mediaAssets)
      .set({
        status: 'orphaned',
        orphanedAt: new Date(),
      })
      .where(eq(mediaAssets.id, id));

    return true;
  }

  async listExpiredOrphanedAssets(retentionDays: number, batchSize: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    return this.db
      .select()
      .from(mediaAssets)
      .where(and(
        eq(mediaAssets.status, 'orphaned'),
        lte(mediaAssets.orphanedAt, cutoff),
      ))
      .orderBy(mediaAssets.orphanedAt)
      .limit(batchSize);
  }

  /**
   * Find pending assets that were never attached (abandoned uploads).
   * These are uploads where the user started but never completed the post creation.
   */
  async listStalePendingAssets(pendingMaxAgeHours: number, batchSize: number) {
    const cutoff = new Date(Date.now() - pendingMaxAgeHours * 60 * 60 * 1000);

    return this.db
      .select()
      .from(mediaAssets)
      .where(and(
        eq(mediaAssets.status, 'pending'),
        lte(mediaAssets.createdAt, cutoff),
      ))
      .orderBy(mediaAssets.createdAt)
      .limit(batchSize);
  }

  async isReferenced(id: string, tx?: any) {
    return this.hasAnyReference(id, this.getExecutor(tx));
  }

  async restoreAttachedIfReferenced(id: string, tx?: any) {
    const executor = this.getExecutor(tx);

    if (!(await this.hasAnyReference(id, executor))) {
      return false;
    }

    await executor
      .update(mediaAssets)
      .set({
        status: 'attached',
        orphanedAt: null,
        cleanupError: null,
      })
      .where(eq(mediaAssets.id, id));

    return true;
  }

  async deleteStoredFiles(asset: typeof mediaAssets.$inferSelect) {
    await this.storageProvider.deleteObject(asset.storagePath);

    if (asset.coverPath) {
      await this.storageProvider.deleteObject(asset.coverPath);
    }
  }

  async getSignedUrl(storagePath: string | null | undefined) {
    if (!storagePath) return null;
    return this.storageProvider.getSignedUrl(storagePath, this.signedUrlTtlSeconds);
  }

  /** CI config accessors — return null when CI is disabled */
  get feedImageCiParams(): string | null { return this.ciConfig?.feedImage ?? null; }
  get feedCoverCiParams(): string | null { return this.ciConfig?.feedCover ?? null; }
  get smallThumbCiParams(): string | null { return this.ciConfig?.smallThumb ?? null; }
  get avatarCiParams(): string | null { return this.ciConfig?.avatar ?? null; }
  get spaceCoverCiParams(): string | null { return this.ciConfig?.spaceCover ?? null; }

  /** Get a signed URL with CI processing params. Falls back to regular signed URL if CI unavailable. */
  async getSignedUrlWithCi(storagePath: string | null | undefined, ciParams: string | null): Promise<string | null> {
    if (!storagePath) return null;
    if (ciParams && this.storageProvider.getSignedCiUrl) {
      return this.storageProvider.getSignedCiUrl(storagePath, this.signedUrlTtlSeconds, ciParams);
    }
    return this.storageProvider.getSignedUrl(storagePath, this.signedUrlTtlSeconds);
  }

  private async getSignedCiUrl(key: string, ciParams: string | null): Promise<string | null> {
    if (!ciParams || !this.storageProvider.getSignedCiUrl) {
      return null;
    }
    return this.storageProvider.getSignedCiUrl(key, this.signedUrlTtlSeconds, ciParams);
  }

  async signMediaAssetUrl(avatarMediaId: string | null | undefined, ciParams?: string | null) {
    if (!avatarMediaId) return null;

    const [asset] = await this.db
      .select({ storagePath: mediaAssets.storagePath })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, avatarMediaId))
      .limit(1);

    const path = asset?.storagePath ?? null;
    if (!path) return null;

    if (ciParams && this.storageProvider.getSignedCiUrl) {
      return this.storageProvider.getSignedCiUrl(path, this.signedUrlTtlSeconds, ciParams);
    }
    return this.getSignedUrl(path);
  }

  async signUserAvatarRows<T extends { avatarPath: string | null }>(rows: T[], avatarCiParams?: string | null) {
    const urlCache = new Map<string, string>();

    for (const row of rows) {
      if (!row.avatarPath || urlCache.has(row.avatarPath)) continue;
      // When CI is configured, sign avatar with CI params for smaller delivery
      if (avatarCiParams && this.storageProvider.getSignedCiUrl) {
        urlCache.set(row.avatarPath, await this.storageProvider.getSignedCiUrl(row.avatarPath, this.signedUrlTtlSeconds, avatarCiParams));
      } else {
        urlCache.set(row.avatarPath, await this.storageProvider.getSignedUrl(row.avatarPath, this.signedUrlTtlSeconds));
      }
    }

    return rows.map(({ avatarPath, ...rest }) => ({
      ...rest,
      avatarUrl: avatarPath ? (urlCache.get(avatarPath) ?? null) : null,
    }));
  }

  async signMediaRows<T extends { storagePath: string; coverPath?: string | null; type?: string }>(
    rows: T[],
    options?: {
      imageCiParams?: string | null;
      coverCiParams?: string | null;
    },
  ) {
    const urlCache = new Map<string, string>();
    const ciUrlCache = new Map<string, string>();
    const imageCi = options?.imageCiParams ?? null;
    const coverCi = options?.coverCiParams ?? null;

    for (const row of rows) {
      if (!urlCache.has(row.storagePath)) {
        urlCache.set(row.storagePath, await this.storageProvider.getSignedUrl(row.storagePath, this.signedUrlTtlSeconds));
      }

      if (row.coverPath && !urlCache.has(row.coverPath)) {
        urlCache.set(row.coverPath, await this.storageProvider.getSignedUrl(row.coverPath, this.signedUrlTtlSeconds));
      }

      // Generate CI thumbnail URLs
      const isImage = row.type === 'image';
      const isVideo = row.type === 'video';

      if (isImage && imageCi && !ciUrlCache.has(row.storagePath)) {
        const ciUrl = await this.getSignedCiUrl(row.storagePath, imageCi);
        if (ciUrl) ciUrlCache.set(row.storagePath, ciUrl);
      }

      if (isVideo && coverCi && row.coverPath && !ciUrlCache.has(row.coverPath)) {
        const ciUrl = await this.getSignedCiUrl(row.coverPath, coverCi);
        if (ciUrl) ciUrlCache.set(row.coverPath, ciUrl);
      }
    }

    return rows.map((row) => {
      const isImage = row.type === 'image';
      const isVideo = row.type === 'video';
      let thumbnailUrl: string | null = null;

      if (isImage) {
        thumbnailUrl = ciUrlCache.get(row.storagePath) ?? null;
      } else if (isVideo && row.coverPath) {
        thumbnailUrl = ciUrlCache.get(row.coverPath) ?? null;
      }

      return {
        ...row,
        publicUrl: urlCache.get(row.storagePath)!,
        coverUrl: row.coverPath ? (urlCache.get(row.coverPath) ?? null) : null,
        thumbnailUrl,
      };
    });
  }

  async toAssetDto(asset: typeof mediaAssets.$inferSelect) {
    return {
      id: asset.id,
      type: asset.type,
      publicUrl: await this.getSignedUrl(asset.storagePath),
      coverUrl: await this.getSignedUrl(asset.coverPath),
      thumbnailUrl: null as string | null,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
    };
  }

  async deleteAssetRecord(id: string, expectedStatus?: 'orphaned' | 'pending', tx?: any) {
    const executor = this.getExecutor(tx);
    const conditions = [eq(mediaAssets.id, id)];
    if (expectedStatus) {
      conditions.push(eq(mediaAssets.status, expectedStatus));
    }
    const [deleted] = await executor
      .delete(mediaAssets)
      .where(and(...conditions))
      .returning({ id: mediaAssets.id });
    return Boolean(deleted);
  }

  async recordCleanupFailure(id: string, error: unknown, tx?: any) {
    const executor = this.getExecutor(tx);
    const message = error instanceof Error ? error.message : String(error);

    await executor
      .update(mediaAssets)
      .set({
        lastCleanupAttemptAt: new Date(),
        cleanupError: message,
      })
      .where(eq(mediaAssets.id, id));
  }

  private getExecutor(tx?: any): DbExecutor {
    return tx ?? this.db;
  }

  private async hasAnyReference(id: string, executor: DbExecutor) {
    // Check image/video attachments — only count relations where the parent post is not soft-deleted
    const [postRef] = await executor
      .select({ id: postMediaRelations.id })
      .from(postMediaRelations)
      .innerJoin(posts, eq(posts.id, postMediaRelations.postId))
      .where(and(
        eq(postMediaRelations.mediaId, id),
        eq(posts.isDeleted, false),
      ))
      .limit(1);
    if (postRef) return true;

    // Check audio attachments — only non-deleted posts
    const [postAudioRef] = await executor
      .select({ id: posts.id })
      .from(posts)
      .where(and(
        eq(posts.audioMediaId, id),
        eq(posts.isDeleted, false),
      ))
      .limit(1);
    if (postAudioRef) return true;

    const [avatarRef] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.avatarMediaId, id))
      .limit(1);
    if (avatarRef) return true;

    const [coverRef] = await executor
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(
        eq(spaces.coverMediaId, id),
        eq(spaces.isDeleted, false),
      ))
      .limit(1);

    return Boolean(coverRef);
  }

  private async extractVideoMetadata(
    buffer: Buffer,
    assetId: string,
  ): Promise<{
    width?: number;
    height?: number;
    durationMs?: number;
    coverPath?: string;
    coverUrl?: string;
  }> {
    // Write buffer to temp file for ffmpeg
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'moments-'));
    const tmpInput = join(tmpDir, 'input.mp4');
    const coverFilename = 'video-cover.jpg';
    const tmpCover = join(tmpDir, coverFilename);

    try {
      await fs.writeFile(tmpInput, buffer);

      // Extract metadata with ffprobe
      const metadata = await new Promise<{
        width?: number;
        height?: number;
        durationMs?: number;
      }>((resolve, reject) => {
        ffmpeg.ffprobe(tmpInput, (err: Error | null, data: FfprobeData) => {
          if (err) return reject(err);
          const videoStream = data.streams.find((s: FfprobeStream) => s.codec_type === 'video');
          resolve({
            width: videoStream?.width,
            height: videoStream?.height,
            durationMs: data.format.duration ? Math.round(data.format.duration * 1000) : undefined,
          });
        });
      });

      // Extract first frame as cover
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpInput)
          .screenshots({
            count: 1,
            timemarks: ['0'],
            filename: coverFilename,
            folder: tmpDir,
            size: metadata.width && metadata.height
              ? `${Math.min(metadata.width, 1280)}x?`
              : '1280x?',
          })
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err));
      });

      // Save cover to storage
      const coverBuffer = await fs.readFile(tmpCover);
      const coverKey = this.buildVariantObjectKey(assetId, coverFilename);
      const savedCover = await this.storageProvider.putObject({
        key: coverKey,
        body: coverBuffer,
        contentType: 'image/jpeg',
        contentLength: coverBuffer.length,
        cacheControl: `private, max-age=${this.signedUrlTtlSeconds}`,
      });

      return {
        ...metadata,
        coverPath: savedCover.key,
        coverUrl: this.storageProvider.getObjectUrl(savedCover.key),
      };
    } finally {
      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async extractAudioDuration(buffer: Buffer, filename: string): Promise<number> {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'moments-audio-'));
    const tmpInput = join(tmpDir, filename);

    try {
      await fs.writeFile(tmpInput, buffer);

      const metadata = await new Promise<FfprobeData>((resolve, reject) => {
        ffmpeg.ffprobe(tmpInput, (err: Error | null, data: FfprobeData) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

      if (!metadata.format.duration) {
        throw new Error('missing audio duration');
      }

      return Math.max(1, Math.round(metadata.format.duration * 1000));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private buildOriginalObjectKey(assetId: string, originalname: string, mimeType: string, folder?: string) {
    const datePath = format(new Date(), 'yyyy/MM/dd');
    const ext = this.getExtFromNameOrMime(originalname, mimeType);
    return this.buildObjectKey(assetId, `${folder ? `${folder}/` : ''}original${ext}` , datePath);
  }

  private buildVariantObjectKey(assetId: string, filename: string) {
    const datePath = format(new Date(), 'yyyy/MM/dd');
    return this.buildObjectKey(assetId, filename, datePath);
  }

  private buildObjectKey(assetId: string, filename: string, datePath: string) {
    const parts = [this.keyPrefix, datePath, assetId, filename].filter(Boolean);
    return posix.join(...parts);
  }

  private getExtFromNameOrMime(originalname: string, mimeType: string) {
    const ext = posix.extname(originalname || '');
    if (ext) return ext.toLowerCase();

    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
      'audio/webm': '.webm',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
    };

    return map[mimeType] ?? '';
  }
}
