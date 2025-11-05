import { s3Client } from './s3Client.js';
import { database, PhotoMetadata } from './database.js';
import { randomUUID } from 'crypto';
import exifr from 'exifr';
import path from 'path';

export interface IndexResult {
  total: number;
  indexed: number;
  failed: number;
}

class PhotoIndexerService {
  /**
   * Scan S3 bucket and index all photos and videos
   */
  async indexAllPhotos(): Promise<IndexResult> {
    console.log('Starting photo indexing...');

    const objects = await s3Client.listAllObjects();
    let indexed = 0;
    let failed = 0;

    for (const object of objects) {
      try {
        // Skip non-media files
        if (!s3Client.isImage(object.key) && !s3Client.isVideo(object.key)) {
          continue;
        }

        await this.indexPhoto(object);
        indexed++;

        if (indexed % 100 === 0) {
          console.log(`Indexed ${indexed}/${objects.length} items...`);
        }
      } catch (error) {
        console.error(`Failed to index ${object.key}:`, error);
        failed++;
      }
    }

    console.log(
      `Indexing complete: ${indexed} indexed, ${failed} failed out of ${objects.length} total`
    );

    return {
      total: objects.length,
      indexed,
      failed,
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
