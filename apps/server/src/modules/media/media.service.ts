import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { format } from 'date-fns';
import type { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg');
import { randomUUID } from 'crypto';
import { join } from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { and, eq, inArray, lte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets, postMediaRelations, spaces, users } from '@moments/db';
import { STORAGE_PROVIDER } from './storage/storage.module';
import { IStorageProvider } from './storage/storage.interface';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];
type MediaPurpose = 'post_attachment' | 'user_avatar' | 'space_cover';
type DbExecutor = DrizzleClient | any;

@Injectable()
export class MediaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
  ) {}

  async uploadFile(file: Express.Multer.File, uploaderId: string) {
    // 1. Validate MIME type
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const isVideo = ALLOWED_VIDEO_MIMES.includes(file.mimetype);
    const type = isVideo ? 'video' : 'image';

    // 2. Store file
    const datePath = format(new Date(), 'yyyy/MM/dd');
    const saved = await this.storageProvider.save(file, datePath);

    // 3. Extract metadata
    let width: number | undefined;
    let height: number | undefined;
    let durationSecs: number | undefined;
    let coverPath: string | undefined;
    let coverUrl: string | undefined;

    if (!isVideo) {
      // Extract image dimensions
      try {
        const meta = await sharp(file.buffer).metadata();
        width = meta.width;
        height = meta.height;
      } catch {
        // Non-critical: proceed without dimensions
      }
    } else {
      // Extract video first frame as cover + metadata
      try {
        const result = await this.extractVideoMetadata(file.buffer, datePath);
        width = result.width;
        height = result.height;
        durationSecs = result.durationSecs;
        coverPath = result.coverPath;
        coverUrl = result.coverUrl;
      } catch (error) {
        // Non-critical: proceed without cover, but log for debugging
        console.error('Failed to extract video metadata:', error);
      }
    }

    // 4. Insert DB record
    const [asset] = await this.db.insert(mediaAssets).values({
      uploaderId,
      type,
      storagePath: saved.storagePath,
      publicUrl: saved.publicUrl,
      coverPath: coverPath || null,
      coverUrl: coverUrl || null,
      mimeType: file.mimetype,
      sizeBytes: saved.sizeBytes,
      width: width || null,
      height: height || null,
      durationSecs: durationSecs || null,
      status: 'pending',
    }).returning();

    return {
      id: asset.id,
      type: asset.type,
      publicUrl: asset.publicUrl,
      coverUrl: asset.coverUrl,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationSecs: asset.durationSecs,
    };
  }

  async getById(id: string) {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return asset || null;
  }

  async requireOwnedPendingAsset(id: string, uploaderId: string, type: 'image' | 'video' | 'any' = 'any') {
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
    await this.storageProvider.delete(asset.storagePath);

    if (asset.coverPath) {
      await this.storageProvider.delete(asset.coverPath);
    }
  }

  async deleteAssetRecord(id: string, tx?: any) {
    const executor = this.getExecutor(tx);
    await executor.delete(mediaAssets).where(eq(mediaAssets.id, id));
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
    const [postRef] = await executor
      .select({ id: postMediaRelations.id })
      .from(postMediaRelations)
      .where(eq(postMediaRelations.mediaId, id))
      .limit(1);
    if (postRef) return true;

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
    datePath: string,
  ): Promise<{
    width?: number;
    height?: number;
    durationSecs?: number;
    coverPath?: string;
    coverUrl?: string;
  }> {
    // Write buffer to temp file for ffmpeg
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'moments-'));
    const tmpInput = join(tmpDir, 'input.mp4');
    const coverFilename = `${randomUUID()}_cover.jpg`;
    const tmpCover = join(tmpDir, coverFilename);

    try {
      await fs.writeFile(tmpInput, buffer);

      // Extract metadata with ffprobe
      const metadata = await new Promise<{
        width?: number;
        height?: number;
        durationSecs?: number;
      }>((resolve, reject) => {
        ffmpeg.ffprobe(tmpInput, (err: Error | null, data: FfprobeData) => {
          if (err) return reject(err);
          const videoStream = data.streams.find((s: FfprobeStream) => s.codec_type === 'video');
          resolve({
            width: videoStream?.width,
            height: videoStream?.height,
            durationSecs: data.format.duration ? Math.round(data.format.duration) : undefined,
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
      const savedCover = await this.storageProvider.saveBuffer(coverBuffer, datePath, coverFilename);

      return {
        ...metadata,
        coverPath: savedCover.storagePath,
        coverUrl: savedCover.publicUrl,
      };
    } finally {
      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
