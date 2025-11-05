import dotenv from 'dotenv';

dotenv.config();

export const config = {
  s3: {
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
    bucketName: process.env.S3_BUCKET_NAME || '',
    region: process.env.S3_REGION || 'us-east-1',
  },
  cache: {
    dir: process.env.CACHE_DIR || '/app/cache',
    sizeLimit: process.env.CACHE_SIZE_LIMIT || '10GB',
    preloadCount: parseInt(process.env.PRELOAD_COUNT || '100', 10),
  },
  indexing: {
    // When false, only index up to preloadCount photos. Remaining photos are indexed on-demand.
    // When true, continue indexing all photos in the background.
    enableBackgroundIndexing: process.env.ENABLE_BACKGROUND_INDEXING === 'true',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  features: {
    enableVideoSupport: process.env.ENABLE_VIDEO_SUPPORT !== 'false',
    maxUploadSize: process.env.MAX_UPLOAD_SIZE || '100MB',
  },
};

// Validate required configuration
export function validateConfig(): void {
  const required = [
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_ENDPOINT',
    'S3_BUCKET_NAME',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
