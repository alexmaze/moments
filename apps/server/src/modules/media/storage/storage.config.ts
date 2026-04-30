import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

export interface CiConfig {
  enabled: boolean;
  feedImage: string;   // e.g. "imageMogr2/thumbnail/800x/format/webp/quality/80"
  feedCover: string;   // video cover in feed, usually same as feedImage
  smallThumb: string;  // notification / admin small thumbnails
  avatar: string;      // avatar thumbnails
  spaceCover: string;  // space cover thumbnails
}

export interface StorageConfig {
  driver: 'tencent-cos';
  signedUrlTtlSeconds: number;
  keyPrefix: string;
  ci: CiConfig | null;
  tencentCos: {
    secretId: string;
    secretKey: string;
    region: string;
    bucket: string;
    useHttps: boolean;
    timeoutMs: number;
  };
}

type RawStorageConfig = {
  storage?: {
    driver?: string;
    signedUrlTtlSeconds?: number;
    keyPrefix?: string;
    ci?: {
      enabled?: boolean;
      feedImage?: string;
      feedCover?: string;
      smallThumb?: string;
      avatar?: string;
      spaceCover?: string;
    };
    tencentCos?: {
      secretId?: string;
      secretKey?: string;
      region?: string;
      bucket?: string;
      useHttps?: boolean;
      timeoutMs?: number;
    };
  };
};

function interpolateEnv(raw: string): string {
  return raw.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, name: string) => {
    const value = process.env[name];
    if (value === undefined) {
      throw new Error(`Environment variable ${name} is not set (referenced in storage config)`);
    }
    return value;
  });
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid storage config: ${field} is required`);
  }
  return value.trim();
}

function ensurePositiveInt(value: unknown, field: string, fallback: number): number {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(`Invalid storage config: ${field} must be a positive integer`);
  }
  return resolved;
}

@Injectable()
export class StorageConfigService {
  private readonly config: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  private loadConfig(): StorageConfig {
    const configPath = this.resolveConfigPath();

    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Storage config file not found: ${configPath}. ` +
        'Create it from config/storage.example.json or set STORAGE_CONFIG_FILE explicitly.',
      );
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    let parsed: RawStorageConfig;
    try {
      parsed = JSON.parse(interpolateEnv(raw)) as RawStorageConfig;
    } catch (error) {
      throw new Error(`Failed to parse storage config file ${configPath}: ${(error as Error).message}`);
    }
    const storage = parsed.storage;

    if (!storage) {
      throw new Error('Invalid storage config: missing storage section');
    }

    if (storage.driver !== 'tencent-cos') {
      throw new Error('Invalid storage config: only tencent-cos driver is supported');
    }

    const cos = storage.tencentCos;
    if (!cos) {
      throw new Error('Invalid storage config: missing storage.tencentCos section');
    }

    return {
      driver: 'tencent-cos',
      signedUrlTtlSeconds: ensurePositiveInt(storage.signedUrlTtlSeconds, 'storage.signedUrlTtlSeconds', 28_800),
      keyPrefix: (storage.keyPrefix ?? 'moments').trim().replace(/^\/+|\/+$/g, ''),
      ci: this.parseCiConfig(storage.ci),
      tencentCos: {
        secretId: ensureString(cos.secretId, 'storage.tencentCos.secretId'),
        secretKey: ensureString(cos.secretKey, 'storage.tencentCos.secretKey'),
        region: ensureString(cos.region, 'storage.tencentCos.region'),
        bucket: ensureString(cos.bucket, 'storage.tencentCos.bucket'),
        useHttps: cos.useHttps !== false,
        timeoutMs: ensurePositiveInt(cos.timeoutMs, 'storage.tencentCos.timeoutMs', 30_000),
      },
    };
  }

  private parseCiConfig(ci?: {
    enabled?: boolean;
    feedImage?: string;
    feedCover?: string;
    smallThumb?: string;
    avatar?: string;
    spaceCover?: string;
  }): CiConfig | null {
    if (!ci || ci.enabled === false) return null;

    const defaultFeed = 'imageMogr2/thumbnail/800x/format/webp/quality/80';
    const defaultSmall = 'imageMogr2/thumbnail/200x200/format/webp/quality/80';
    const defaultAvatar = 'imageMogr2/thumbnail/200x200/format/webp/quality/85';

    return {
      enabled: true,
      feedImage: (ci.feedImage ?? defaultFeed).trim(),
      feedCover: (ci.feedCover ?? ci.feedImage ?? defaultFeed).trim(),
      smallThumb: (ci.smallThumb ?? defaultSmall).trim(),
      avatar: (ci.avatar ?? defaultAvatar).trim(),
      spaceCover: (ci.spaceCover ?? ci.feedImage ?? defaultFeed).trim(),
    };
  }

  private resolveConfigPath() {
    const configuredPath = this.configService.get<string>('STORAGE_CONFIG_FILE', 'config/storage.json');

    if (isAbsolute(configuredPath)) {
      return configuredPath;
    }

    const candidates = [
      resolve(process.cwd(), configuredPath),
      resolve(process.cwd(), '..', '..', configuredPath),
      resolve(dirname(__dirname), '..', '..', '..', '..', '..', configuredPath),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
  }
}
