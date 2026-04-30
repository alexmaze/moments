export interface StoredObject {
  key: string;
  sizeBytes: number;
  etag: string | null;
  provider: 'tencent-cos';
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  contentLength?: number;
  cacheControl?: string;
}

export interface BucketStats {
  totalBytes: number;
  objectCount: number;
}

export interface IStorageProvider {
  readonly kind: 'tencent-cos';

  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getObjectUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;

  /** Generate a signed URL with CI image-processing params co-signed into the HMAC. */
  getSignedCiUrl?(key: string, expiresInSeconds: number, ciParams: string): Promise<string>;

  /** Get storage usage statistics for objects under the given prefix. */
  getBucketStats(prefix: string): Promise<BucketStats>;
}
