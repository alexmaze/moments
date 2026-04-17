export interface SavedFile {
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
}

export interface IStorageProvider {
  save(file: Express.Multer.File, subpath: string): Promise<SavedFile>;
  delete(storagePath: string): Promise<void>;
  getPublicUrl(storagePath: string): string;
}
