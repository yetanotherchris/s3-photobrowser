import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config, validateConfig } from './config.js';
import { s3Client } from './services/s3Client.js';
import { database } from './services/database.js';
import { photoIndexer } from './services/photoIndexer.js';
import { imageProcessor } from './services/imageProcessor.js';
import { videoProcessor } from './services/videoProcessor.js';
import { cacheManager } from './services/cacheManager.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API Routes

/**
 * GET /api/photos/indexing-status
 * Get background indexing status
 * IMPORTANT: This must come before /api/photos/:photoId
 */
app.get('/api/photos/indexing-status', (_req: Request, res: Response) => {
  try {
    const status = photoIndexer.getBackgroundIndexingStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting indexing status:', error);
    res.status(500).json({ error: 'Failed to get indexing status' });
  }
});

/**
 * GET /api/photos/dates
 * Get all dates with photo counts
 * IMPORTANT: This must come before /api/photos/:photoId
 */
app.get('/api/photos/dates', async (_req: Request, res: Response) => {
  try {
    const dates = database.getDateCounts();
    res.json({ dates });
  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({ error: 'Failed to get dates' });
  }
});

/**
 * POST /api/photos/refresh
 * Re-index S3 bucket
 */
app.post('/api/photos/refresh', async (_req: Request, res: Response) => {
  try {
    const result = await photoIndexer.indexAllPhotos();

    res.json({
      success: true,
      indexed: result.indexed,
      total: result.total,
      failed: result.failed,
      backgroundIndexing: result.backgroundIndexing,
    });
  } catch (error) {
    console.error('Error refreshing photos:', error);
    res.status(500).json({ error: 'Failed to refresh photos' });
  }
});

/**
 * POST /api/photos/index-next
 * Index next batch of unindexed photos
 */
app.post('/api/photos/index-next', async (req: Request, res: Response) => {
  try {
    const batchSize = parseInt(req.query.batchSize as string) || 100;
    const result = await photoIndexer.indexNextBatch(batchSize);

    res.json({
      success: true,
      indexed: result.indexed,
      total: result.total,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Error indexing next batch:', error);
    res.status(500).json({ error: 'Failed to index next batch' });
  }
});

/**
 * GET /api/photos
 * Get photos with pagination and filters
 * IMPORTANT: This must come before /api/photos/:photoId
 */
app.get('/api/photos', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const sortBy = (req.query.sortBy as 'date' | 'name') || 'date';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const photos = database.getPhotos({
      limit,
      offset,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    const total = database.getTotalCount();
    const hasMore = offset + photos.length < total;

    // Add URLs to photos
    const photosWithUrls = photos.map((photo) => ({
      ...photo,
      thumbnailUrl: `/api/photos/${photo.id}/download?size=thumbnail`,
      previewUrl: `/api/photos/${photo.id}/download?size=preview`,
      originalUrl: `/api/photos/${photo.id}/download?size=original`,
    }));

    res.json({
      photos: photosWithUrls,
      total,
      hasMore,
    });
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

/**
 * GET /api/photos/:photoId
 * Get single photo metadata
 * IMPORTANT: This must come after specific routes like /api/photos/dates
 */
app.get('/api/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const photo = database.getPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photoWithUrls = {
      ...photo,
      thumbnailUrl: `/api/photos/${photo.id}/download?size=thumbnail`,
      previewUrl: `/api/photos/${photo.id}/download?size=preview`,
      originalUrl: `/api/photos/${photo.id}/download?size=original`,
    };

    res.json(photoWithUrls);
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ error: 'Failed to get photo' });
  }
});

/**
 * GET /api/photos/:photoId/download
 * Download photo at specified size
 */
app.get('/api/photos/:photoId/download', async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const size = (req.query.size as 'thumbnail' | 'preview' | 'original') || 'original';

    const photo = database.getPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    let buffer: Buffer;

    if (photo.type === 'video' && size === 'thumbnail') {
      // Get video thumbnail
      buffer = await videoProcessor.getVideoThumbnail(photo.s3Key);
    } else if (photo.type === 'video') {
      // For video original/preview, stream from S3
      const presignedUrl = await s3Client.getPresignedUrl(photo.s3Key, 3600);
      return res.redirect(presignedUrl);
    } else {
      // Get processed image
      buffer = await imageProcessor.getProcessedImage(photo.s3Key, size);
    }

    // Set appropriate headers
    res.set('Content-Type', photo.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading photo:', error);
    res.status(500).json({ error: 'Failed to download photo' });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Delete photo
 */
app.delete('/api/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const photo = database.getPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete from S3
    await s3Client.deleteObject(photo.s3Key);

    // Delete from database
    database.deletePhoto(photoId);

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
app.get('/api/cache/stats', async (_req: Request, res: Response) => {
  try {
    const stats = cacheManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * POST /api/cache/clear
 * Clear cache
 */
app.post('/api/cache/clear', async (_req: Request, res: Response) => {
  try {
    await cacheManager.clearCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const s3Connected = await s3Client.testConnection();
    const cacheWritable = await cacheManager.isWritable();

    const status = s3Connected && cacheWritable ? 'ok' : 'error';

    res.status(status === 'ok' ? 200 : 500).json({
      status,
      s3Connected,
      cacheWritable,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      s3Connected: false,
      cacheWritable: false,
    });
  }
});

// Serve static files in production
if (config.server.nodeEnv === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist/client')));

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'dist/client/index.html'));
  });
}

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
async function start() {
  try {
    // Validate configuration
    validateConfig();
    console.log('Configuration validated');

    // Test S3 connection
    const s3Connected = await s3Client.testConnection();
    if (!s3Connected) {
      throw new Error('Failed to connect to S3');
    }
    console.log('S3 connection successful');

    // Check cache directory
    const cacheWritable = await cacheManager.isWritable();
    if (!cacheWritable) {
      throw new Error('Cache directory is not writable');
    }
    console.log('Cache directory ready');

    // Start server immediately (non-blocking)
    app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
    });

    // Index photos in background (non-blocking)
    console.log('Starting background photo indexing...');
    photoIndexer.indexAllPhotos().then((result) => {
      console.log(`Initial indexing complete: ${result.indexed} photos indexed`);

      // Preload thumbnails after initial indexing
      if (config.cache.preloadCount > 0) {
        console.log(`Preloading ${config.cache.preloadCount} thumbnails...`);
        imageProcessor.preloadThumbnails(config.cache.preloadCount).catch((err) => {
          console.error('Failed to preload thumbnails:', err);
        });

        if (config.features.enableVideoSupport) {
          videoProcessor
            .preloadVideoThumbnails(Math.floor(config.cache.preloadCount / 10))
            .catch((err) => {
              console.error('Failed to preload video thumbnails:', err);
            });
        }
      }
    }).catch((error) => {
      console.error('Background indexing failed:', error);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  database.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing database...');
  database.close();
  process.exit(0);
});

start();
