import { s3Client } from './s3Client.js';
import { database, PhotoMetadata } from './database.js';
import { randomUUID } from 'crypto';
import exifr from 'exifr';
import path from 'path';
import { config } from '../config.js';

export interface IndexResult {
  total: number;
  indexed: number;
  failed: number;
  backgroundIndexing?: boolean;
}

class PhotoIndexerService {
  private backgroundIndexing = false;
  private backgroundIndexStats = { indexed: 0, failed: 0 };

  /**
   * Scan S3 bucket and index all photos and videos
   * @param initialLimit - Number of photos to index immediately (default: config.cache.preloadCount)
   *                       Set to 0 or Infinity to index all photos synchronously
   */
  async indexAllPhotos(initialLimit?: number): Promise<IndexResult> {
    const limit = initialLimit ?? config.cache.preloadCount;
    console.log('Starting photo indexing...');

    const objects = await s3Client.listAllObjects();

    // Filter media files
    const mediaObjects = objects.filter(
      (obj) => s3Client.isImage(obj.key) || s3Client.isVideo(obj.key)
    );

    let indexed = 0;
    let failed = 0;

    // Determine how many to index initially
    const shouldLimitInitial = limit > 0 && limit < Infinity;
    const initialBatchSize = shouldLimitInitial ? Math.min(limit, mediaObjects.length) : mediaObjects.length;
    const hasBackgroundWork = shouldLimitInitial && mediaObjects.length > limit;

    // Index initial batch synchronously
    console.log(`Indexing initial batch of ${initialBatchSize} photos...`);
    for (let i = 0; i < initialBatchSize; i++) {
      const object = mediaObjects[i];
      try {
        await this.indexPhoto(object);
        indexed++;

        if (indexed % 50 === 0) {
          console.log(`Indexed ${indexed}/${initialBatchSize} items (initial batch)...`);
        }
      } catch (error) {
        console.error(`Failed to index ${object.key}:`, error);
        failed++;
      }
    }

    console.log(
      `Initial indexing complete: ${indexed} indexed, ${failed} failed out of ${initialBatchSize}`
    );

    // Start background indexing for remaining photos
    if (hasBackgroundWork) {
      const remainingObjects = mediaObjects.slice(initialBatchSize);
      console.log(`Starting background indexing for ${remainingObjects.length} remaining photos...`);
      this.startBackgroundIndexing(remainingObjects);
    }

    return {
      total: mediaObjects.length,
      indexed,
      failed,
      backgroundIndexing: hasBackgroundWork,
    };
  }

  /**
   * Start background indexing for remaining photos
   */
  private startBackgroundIndexing(objects: Array<{ key: string; size: number; lastModified: Date }>): void {
    if (this.backgroundIndexing) {
      console.log('Background indexing already in progress, skipping...');
      return;
    }

    this.backgroundIndexing = true;
    this.backgroundIndexStats = { indexed: 0, failed: 0 };

    // Run indexing in background (non-blocking)
    (async () => {
      try {
        for (const object of objects) {
          try {
            await this.indexPhoto(object);
            this.backgroundIndexStats.indexed++;

            if (this.backgroundIndexStats.indexed % 100 === 0) {
              console.log(`Background indexed ${this.backgroundIndexStats.indexed}/${objects.length} items...`);
            }
          } catch (error) {
            console.error(`Background indexing failed for ${object.key}:`, error);
            this.backgroundIndexStats.failed++;
          }
        }

        console.log(
          `Background indexing complete: ${this.backgroundIndexStats.indexed} indexed, ${this.backgroundIndexStats.failed} failed`
        );
      } finally {
        this.backgroundIndexing = false;
      }
    })();
  }

  /**
   * Get background indexing status
   */
  getBackgroundIndexingStatus(): {
    isIndexing: boolean;
    indexed: number;
    failed: number;
  } {
    return {
      isIndexing: this.backgroundIndexing,
      indexed: this.backgroundIndexStats.indexed,
      failed: this.backgroundIndexStats.failed,
    };
  }

  /**
   * Index a single photo/video
   */
  private async indexPhoto(object: {
    key: string;
    size: number;
    lastModified: Date;
  }): Promise<void> {
    const filename = path.basename(object.key);
    const filePath = path.dirname(object.key);
    const isVideo = s3Client.isVideo(object.key);

    // Check if already exists
    const existing = database.getPhotoByS3Key(object.key);
    if (existing && existing.modifiedAt === object.lastModified.toISOString()) {
      // Already indexed and up to date
      return;
    }

    let createdAt = object.lastModified;
    let width: number | undefined;
    let height: number | undefined;
    let exifData: any;

    // Try to extract EXIF data for images
    if (!isVideo) {
      try {
        const buffer = await s3Client.getObjectBuffer(object.key);
        const exif = await exifr.parse(buffer, {
          pick: [
            'DateTimeOriginal',
            'CreateDate',
            'Make',
            'Model',
            'LensModel',
            'FocalLength',
            'FNumber',
            'ISO',
            'ExposureTime',
            'latitude',
            'longitude',
          ],
        });

        if (exif) {
          // Use EXIF date if available
          if (exif.DateTimeOriginal) {
            createdAt = new Date(exif.DateTimeOriginal);
          } else if (exif.CreateDate) {
            createdAt = new Date(exif.CreateDate);
          }

          // Extract camera info
          exifData = {
            camera: exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : undefined,
            lens: exif.LensModel,
            focalLength: exif.FocalLength,
            aperture: exif.FNumber,
            iso: exif.ISO,
            shutterSpeed: exif.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : undefined,
            location:
              exif.latitude && exif.longitude
                ? {
                    latitude: exif.latitude,
                    longitude: exif.longitude,
                  }
                : undefined,
          };

          // Try to get dimensions from EXIF
          const size = await exifr.parse(buffer, { pick: ['ImageWidth', 'ImageHeight'] });
          if (size) {
            width = size.ImageWidth;
            height = size.ImageHeight;
          }
        }
      } catch (error) {
        // EXIF parsing failed, use file modified date
        console.warn(`Failed to parse EXIF for ${object.key}:`, error);
      }
    }

    const photo: PhotoMetadata = {
      id: existing?.id || randomUUID(),
      filename,
      path: filePath,
      s3Key: object.key,
      size: object.size,
      mimeType: s3Client.getMimeType(object.key),
      type: isVideo ? 'video' : 'photo',
      width,
      height,
      duration: undefined, // Will be filled by video processor
      createdAt: createdAt.toISOString(),
      modifiedAt: object.lastModified.toISOString(),
      exifData: exifData ? JSON.stringify(exifData) : undefined,
      cached: existing?.cached || false,
    };

    database.upsertPhoto(photo);
  }

  /**
   * Re-index specific photo
   */
  async reindexPhoto(s3Key: string): Promise<void> {
    const objects = await s3Client.listAllObjects();
    const object = objects.find((obj) => obj.key === s3Key);

    if (!object) {
      throw new Error(`Object not found: ${s3Key}`);
    }

    await this.indexPhoto(object);
  }
}

export const photoIndexer = new PhotoIndexerService();
