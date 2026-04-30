import { Injectable } from '@nestjs/common';
import COS from 'cos-nodejs-sdk-v5';
import { IStorageProvider, PutObjectInput, StoredObject } from './storage.interface';
import { StorageConfigService } from './storage.config';

function encodeKey(key: string) {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

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
  }

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
    return this.cos.getObjectUrl({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Sign: true,
      Expires: expiresInSeconds,
      Protocol: this.protocol,
      Domain: this.host,
    });
  }

  async getSignedCiUrl(key: string, expiresInSeconds: number, ciParams: string): Promise<string> {
    return this.cos.getObjectUrl({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Sign: true,
      Expires: expiresInSeconds,
      Protocol: this.protocol,
      Domain: this.host,
      QueryString: ciParams,
    });
  }
}
