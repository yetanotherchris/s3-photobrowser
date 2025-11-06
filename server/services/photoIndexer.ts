import { s3Client } from './s3Client.js';
import { database, PhotoMetadata, ExifData } from './database.js';
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

    // Sort by lastModified date in descending order (newest first)
    // This ensures the initial batch contains the most recent photos
    mediaObjects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

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

    // Start background indexing for remaining photos (if enabled)
    const shouldStartBackgroundIndexing = hasBackgroundWork && config.indexing.enableBackgroundIndexing;
    if (shouldStartBackgroundIndexing) {
      const remainingObjects = mediaObjects.slice(initialBatchSize);
      console.log(`Starting background indexing for ${remainingObjects.length} remaining photos...`);
      this.startBackgroundIndexing(remainingObjects);
    } else if (hasBackgroundWork && !config.indexing.enableBackgroundIndexing) {
      const unindexedCount = mediaObjects.length - initialBatchSize;
      console.log(
        `Background indexing disabled. ${unindexedCount} photos will be indexed on-demand when accessed.`
      );
    }

    return {
      total: mediaObjects.length,
      indexed,
      failed,
      backgroundIndexing: shouldStartBackgroundIndexing,
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
   * Index a photo by its S3 key (on-demand)
   * This is useful for indexing photos that were skipped during initial indexing
   */
  async indexPhotoByKey(s3Key: string): Promise<void> {
    const objects = await s3Client.listAllObjects();
    const object = objects.find((obj) => obj.key === s3Key);

    if (!object) {
      throw new Error(`Object not found in S3: ${s3Key}`);
    }

    await this.indexPhoto(object);
  }

  /**
   * Index next batch of unindexed photos from S3
   * This allows gradual indexing as users need more photos
   */
  async indexNextBatch(batchSize: number = 100): Promise<IndexResult> {
    console.log(`Indexing next batch of ${batchSize} photos...`);

    // Get all S3 objects
    const objects = await s3Client.listAllObjects();
    const mediaObjects = objects.filter(
      (obj) => s3Client.isImage(obj.key) || s3Client.isVideo(obj.key)
    );

    // Get already indexed S3 keys
    const allIndexedPhotos = database.getAllPhotos();
    const indexedKeys = new Set(allIndexedPhotos.map((p) => p.s3Key));

    // Find unindexed objects
    const unindexedObjects = mediaObjects.filter((obj) => !indexedKeys.has(obj.key));

    if (unindexedObjects.length === 0) {
      console.log('No unindexed photos found');
      return { total: mediaObjects.length, indexed: 0, failed: 0 };
    }

    // Sort unindexed objects by lastModified date (newest first)
    unindexedObjects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    // Index the next batch
    const toIndex = unindexedObjects.slice(0, batchSize);
    let indexed = 0;
    let failed = 0;

    for (const object of toIndex) {
      try {
        await this.indexPhoto(object);
        indexed++;

        if (indexed % 10 === 0) {
          console.log(`Indexed ${indexed}/${toIndex.length} photos in batch...`);
        }
      } catch (error) {
        console.error(`Failed to index ${object.key}:`, error);
        failed++;
      }
    }

    console.log(
      `Batch indexing complete: ${indexed} indexed, ${failed} failed. ${unindexedObjects.length - toIndex.length} remain.`
    );

    return {
      total: mediaObjects.length,
      indexed,
      failed,
    };
  }

  /**
   * Extract date from folder path (e.g., "photos/2024/01/image.jpg" -> 2024-01-01)
   * Supports patterns like:
   * - photos/2024/image.jpg -> 2024-01-01
   * - photos/2024/01/image.jpg -> 2024-01-01
   * - 2023-12-25/photo.jpg -> 2023-12-25
   * - travel/2021/europe/pic.jpg -> 2021-01-01
   */
  private extractDateFromPath(s3Key: string): Date | null {
    // Match year (1900-2099) in path
    const yearMatch = s3Key.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) return null;

    const year = parseInt(yearMatch[0]);

    // Try to find month (01-12) near the year
    const monthMatch = s3Key.match(new RegExp(`${year}[/-](0[1-9]|1[0-2])`));
    const month = monthMatch ? parseInt(monthMatch[1]) : 1;

    // Try to find day near month
    const dayMatch = s3Key.match(
      new RegExp(`${year}[/-]${month.toString().padStart(2, '0')}[/-](0[1-9]|[12][0-9]|3[01])`)
    );
    const day = dayMatch ? parseInt(dayMatch[1]) : 1;

    return new Date(year, month - 1, day);
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
    let width: number | undefined = existing?.width;
    let height: number | undefined = existing?.height;
    let exif: ExifData | undefined = existing?.exif;

    const dateAccuracy = config.indexing.dateAccuracy;

    // Apply date accuracy mode
    switch (dateAccuracy) {
      case 'none':
        // Use S3 LastModified date only (fastest)
        // createdAt is already set to object.lastModified
        break;

      case 'folders':
        // Extract dates from folder structure only (fast, no downloads)
        const folderDate = this.extractDateFromPath(object.key);
        if (folderDate) {
          createdAt = folderDate;
          console.log(`Using folder date for ${object.key}: ${folderDate.toISOString().split('T')[0]}`);
        }
        break;

      case 'folders-exif':
        // Use folders initially, EXIF will be extracted progressively when photos are viewed
        const folderDateProgressive = this.extractDateFromPath(object.key);
        if (folderDateProgressive) {
          createdAt = folderDateProgressive;
          console.log(`Using folder date for ${object.key}: ${folderDateProgressive.toISOString().split('T')[0]}`);
        }
        // EXIF extraction happens in imageProcessor.extractAndUpdateExif()
        break;

      case 'exif':
        // Download EXIF upfront during indexing (slow but most accurate)
        if (!isVideo) {
          try {
            // Use partial download to get just EXIF data (first 64KB)
            const buffer = await s3Client.getPartialObjectBuffer(object.key, 65536);
            const parsedExif = await exifr.parse(buffer, {
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
                'ImageWidth',
                'ImageHeight',
              ],
            });

            if (parsedExif) {
              // Use EXIF date if available
              if (parsedExif.DateTimeOriginal) {
                createdAt = new Date(parsedExif.DateTimeOriginal);
                console.log(`Using EXIF date for ${object.key}: ${createdAt.toISOString().split('T')[0]}`);
              } else if (parsedExif.CreateDate) {
                createdAt = new Date(parsedExif.CreateDate);
                console.log(`Using EXIF date for ${object.key}: ${createdAt.toISOString().split('T')[0]}`);
              }

              // Extract dimensions
              if (parsedExif.ImageWidth && parsedExif.ImageHeight) {
                width = parsedExif.ImageWidth;
                height = parsedExif.ImageHeight;
              }

              // Extract camera info
              exif = {
                cameraMake: parsedExif.Make,
                cameraModel: parsedExif.Model,
                lensModel: parsedExif.LensModel,
                focalLength: parsedExif.FocalLength,
                aperture: parsedExif.FNumber,
                iso: parsedExif.ISO,
                shutterSpeed: parsedExif.ExposureTime ? `1/${Math.round(1 / parsedExif.ExposureTime)}` : undefined,
                exposureTime: parsedExif.ExposureTime,
                latitude: parsedExif.latitude,
                longitude: parsedExif.longitude,
              };
            }
          } catch (error) {
            console.warn(`Failed to extract EXIF for ${object.key}:`, error);
            // Fallback to folder date if EXIF extraction fails
            const folderDateFallback = this.extractDateFromPath(object.key);
            if (folderDateFallback) {
              createdAt = folderDateFallback;
            }
          }
        }
        break;
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
      exif,
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
