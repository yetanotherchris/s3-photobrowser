export interface PhotoMetadata {
  id: string;
  filename: string;
  path: string;
  s3Key: string;
  size: number;
  mimeType: string;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
  modifiedAt: string;
  exifData?: ExifData;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  cached: boolean;
}

export interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  iso?: number;
  shutterSpeed?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface PhotosResponse {
  photos: PhotoMetadata[];
  total: number;
  hasMore: boolean;
}

export interface DateCount {
  date: string;
  count: number;
}

export interface CacheStats {
  totalSize: number;
  itemCount: number;
  limit: number;
  hitRate: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  s3Connected: boolean;
  cacheWritable: boolean;
}
