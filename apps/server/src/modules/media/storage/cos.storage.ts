import { Injectable } from '@nestjs/common';
import COS from 'cos-nodejs-sdk-v5';
import { LRUCache } from 'lru-cache';
import { IStorageProvider, PutObjectInput, StoredObject } from './storage.interface';
import { StorageConfigService } from './storage.config';

function encodeKey(key: string) {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

/** Safety margin: retire cache entry 1 day before URL expiry. */
const CACHE_SAFETY_MARGIN_SECONDS = 86_400;

/** Maximum cached entries. Each entry ≈ 390 bytes → 10 000 ≈ 4 MB ceiling. */
const CACHE_MAX_ENTRIES = 10_000;

@Injectable()
export class TencentCosStorageProvider implements IStorageProvider {
  readonly kind = 'tencent-cos' as const;

  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private readonly region: string;
  private readonly protocol: 'http' | 'https';
  private readonly timeoutMs: number;
  private readonly host: string;
  private readonly cos: COS;

  /**
   * LRU cache: cacheKey → signed URL string.
   * cacheKey = objectKey             (plain signed URLs)
   *          = objectKey + \x00 + ciParams (CI-processed URLs)
   * TTL per entry = (expiresInSeconds - CACHE_SAFETY_MARGIN_SECONDS) * 1000 ms
   */
  private readonly urlCache: LRUCache<string, string>;

  /**
   * Reverse index: objectKey → Set<cacheKey>.
   * Used to evict all cache entries for an object when it is deleted.
   * Cleaned up automatically when LRU entries are disposed (TTL expiry or eviction).
   */
  private readonly cacheKeyIndex = new Map<string, Set<string>>();

  constructor(storageConfigService: StorageConfigService) {
    const config = storageConfigService.getConfig().tencentCos;
    this.secretId = config.secretId;
    this.secretKey = config.secretKey;
    this.bucket = config.bucket;
    this.region = config.region;
    this.protocol = config.useHttps ? 'https' : 'http';
    this.timeoutMs = config.timeoutMs;
    this.host = `${this.bucket}.cos.${this.region}.myqcloud.com`;
    this.cos = new COS({
      SecretId: this.secretId,
      SecretKey: this.secretKey,
      Protocol: this.protocol,
      Domain: this.host,
      Timeout: this.timeoutMs,
    });

    this.urlCache = new LRUCache<string, string>({
      max: CACHE_MAX_ENTRIES,
      dispose: (_value, cacheKey) => {
        const objectKey = cacheKey.split('\x00', 1)[0];
        const keySet = this.cacheKeyIndex.get(objectKey);
        if (keySet) {
          keySet.delete(cacheKey);
          if (keySet.size === 0) {
            this.cacheKeyIndex.delete(objectKey);
          }
        }
      },
    });
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private buildCacheKey(objectKey: string, ciParams?: string): string {
    return ciParams ? `${objectKey}\x00${ciParams}` : objectKey;
  }

  private cacheTtlMs(expiresInSeconds: number): number {
    return Math.max(expiresInSeconds - CACHE_SAFETY_MARGIN_SECONDS, 0) * 1000;
  }

  private setCachedUrl(objectKey: string, cacheKey: string, url: string, ttlMs: number): void {
    if (ttlMs <= 0) return;
    this.urlCache.set(cacheKey, url, { ttl: ttlMs });

    let keySet = this.cacheKeyIndex.get(objectKey);
    if (!keySet) {
      keySet = new Set();
      this.cacheKeyIndex.set(objectKey, keySet);
    }
    keySet.add(cacheKey);
  }

  private evictCachedUrls(objectKey: string): void {
    const keySet = this.cacheKeyIndex.get(objectKey);
    if (keySet) {
      for (const k of keySet) {
        this.urlCache.delete(k);
      }
      this.cacheKeyIndex.delete(objectKey);
    }
  }

  // ─── IStorageProvider ─────────────────────────────────────────────────────

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const response = await this.cos.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength ?? input.body.length,
      CacheControl: input.cacheControl,
    });

    return {
      key: input.key,
      sizeBytes: input.contentLength ?? input.body.length,
      etag: response.ETag?.replace(/"/g, '') ?? response.headers?.etag?.replace(/"/g, '') ?? null,
      provider: 'tencent-cos',
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.evictCachedUrls(key);
    try {
      await this.cos.deleteObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
      });
    } catch (error) {
      // Log but don't throw — deletion is best-effort for cleanup
      console.error(`Failed to delete COS object ${key}:`, error);
    }
  }

  getObjectUrl(key: string): string {
    return `${this.protocol}://${this.host}/${encodeKey(key)}`;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const cacheKey = this.buildCacheKey(key);
    const cached = this.urlCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.cos.getObjectUrl({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Sign: true,
      Expires: expiresInSeconds,
      Protocol: this.protocol,
      Domain: this.host,
    });

    this.setCachedUrl(key, cacheKey, url, this.cacheTtlMs(expiresInSeconds));
    return url;
  }

  async getSignedCiUrl(key: string, expiresInSeconds: number, ciParams: string): Promise<string> {
    const cacheKey = this.buildCacheKey(key, ciParams);
    const cached = this.urlCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.cos.getObjectUrl({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Sign: true,
      Expires: expiresInSeconds,
      Protocol: this.protocol,
      Domain: this.host,
      QueryString: ciParams,
    });

    this.setCachedUrl(key, cacheKey, url, this.cacheTtlMs(expiresInSeconds));
    return url;
  }
}
