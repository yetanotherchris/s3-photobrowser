import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../../server/config.js';
import { s3Client } from '../../server/services/s3Client.js';
import { database } from '../../server/services/database.js';
import { photoIndexer } from '../../server/services/photoIndexer.js';
import { imageProcessor } from '../../server/services/imageProcessor.js';
import { videoProcessor } from '../../server/services/videoProcessor.js';
import { cacheManager } from '../../server/services/cacheManager.js';

/**
 * Create a test Express app without starting the server
 * This is useful for integration testing with supertest
 */
export function createTestApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // API Routes

  /**
   * GET /api/photos
   * Get photos with pagination and filters
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
   * POST /api/photos/refresh
   * Re-index S3 bucket
   */
  app.post('/api/photos/refresh', async (req: Request, res: Response) => {
    try {
      const result = await photoIndexer.indexAllPhotos();

      res.json({
        success: true,
        indexed: result.indexed,
        total: result.total,
        failed: result.failed,
      });
    } catch (error) {
      console.error('Error refreshing photos:', error);
      res.status(500).json({ error: 'Failed to refresh photos' });
    }
  });

  /**
   * GET /api/health
   * Health check endpoint
   */
  app.get('/api/health', async (req: Request, res: Response) => {
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

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
