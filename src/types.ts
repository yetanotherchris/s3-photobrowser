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
  exif?: ExifData;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  cached: boolean;
}

export interface ExifData {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLength?: number;
  aperture?: number;
  iso?: number;
  shutterSpeed?: string;
  exposureTime?: number;
  latitude?: number;
  longitude?: number;
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
