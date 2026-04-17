// Media types
export type MediaType = 'image' | 'video';
export type MediaStatus = 'pending' | 'attached' | 'orphaned';

export interface MediaAssetDto {
  id: string;
  type: MediaType;
  publicUrl: string;
  coverUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSecs: number | null;
}

export interface PostMediaDto extends MediaAssetDto {
  sortOrder: number;
}
