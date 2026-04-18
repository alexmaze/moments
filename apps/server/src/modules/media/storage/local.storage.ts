import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import * as fs from 'fs/promises';
import { IStorageProvider, SavedFile } from './storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private uploadRoot: string;

  constructor() {
    this.uploadRoot = process.env.UPLOAD_DIR ?? './uploads';
  }

  async save(file: Express.Multer.File, subpath: string): Promise<SavedFile> {
    const dir = join(this.uploadRoot, subpath);
    await fs.mkdir(dir, { recursive: true });

    const ext = extname(file.originalname) || this.getExtFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const fullPath = join(dir, filename);

    await fs.writeFile(fullPath, file.buffer);

    const storagePath = join(subpath, filename);
    return {
      storagePath,
      publicUrl: this.buildPublicUrl(storagePath),
      sizeBytes: file.size,
    };
  }

  async saveBuffer(buffer: Buffer, subpath: string, filename: string): Promise<SavedFile> {
    const dir = join(this.uploadRoot, subpath);
    await fs.mkdir(dir, { recursive: true });

    const fullPath = join(dir, filename);
    await fs.writeFile(fullPath, buffer);

    const storagePath = join(subpath, filename);
    return {
      storagePath,
      publicUrl: this.buildPublicUrl(storagePath),
      sizeBytes: buffer.length,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(join(this.uploadRoot, storagePath));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  getPublicUrl(storagePath: string): string {
    return this.buildPublicUrl(storagePath);
  }

  private buildPublicUrl(storagePath: string): string {
    const normalizedPath = storagePath.replace(/\\/g, '/');
    return `/uploads/${normalizedPath}`;
  }

  private getExtFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
    };
    return map[mime] || '';
  }
}
