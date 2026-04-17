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
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets } from '@moments/db';
import { STORAGE_PROVIDER } from './storage/storage.module';
import { IStorageProvider } from './storage/storage.interface';
import { LocalStorageProvider } from './storage/local.storage';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];

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
      } catch {
        // Non-critical: proceed without cover
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
      const localProvider = this.storageProvider as LocalStorageProvider;
      const savedCover = await localProvider.saveBuffer(coverBuffer, datePath, coverFilename);

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
