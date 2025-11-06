import sharp from 'sharp';
import exifr from 'exifr';
import { s3Client } from './s3Client.js';
import { cacheManager, CacheSize } from './cacheManager.js';
import { database, ExifData } from './database.js';

interface ProcessOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
}

class ImageProcessorService {
  /**
   * Get processed image (thumbnail, preview, or original)
   */
  async getProcessedImage(
    s3Key: string,
    size: CacheSize
  ): Promise<Buffer> {
    // Check cache first
    const cached = await cacheManager.getCachedFile(s3Key, size);
    if (cached) {
      return cached;
    }

    // Download from S3
    const originalBuffer = await s3Client.getObjectBuffer(s3Key);

    // Extract EXIF data on first download (progressive refinement)
    // This happens when user views the photo, allowing us to update the date to be more precise
    const photo = database.getPhotoByS3Key(s3Key);
    if (photo && !photo.exif) {
      await this.extractAndUpdateExif(s3Key, originalBuffer);
    }

    // Process based on size
    let processed: Buffer;
    switch (size) {
      case 'thumbnail':
        processed = await this.generateThumbnail(originalBuffer);
        break;
      case 'preview':
        processed = await this.generatePreview(originalBuffer);
        break;
      case 'original':
        processed = originalBuffer;
        break;
    }

    // Save to cache
    await cacheManager.saveToCac(s3Key, size, processed);

    // Mark as cached in database (for thumbnails)
    if (size === 'thumbnail') {
      if (photo) {
        database.markAsCached(photo.id);
      }
    }

    return processed;
  }

  /**
   * Extract EXIF data and update photo with precise date
   * This is called on-demand when photo is first downloaded
   */
  private async extractAndUpdateExif(s3Key: string, buffer: Buffer): Promise<void> {
    try {
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

      if (!parsedExif) return;

      // Extract precise date from EXIF
      let exifDate: Date | null = null;
      if (parsedExif.DateTimeOriginal) {
        exifDate = new Date(parsedExif.DateTimeOriginal);
      } else if (parsedExif.CreateDate) {
        exifDate = new Date(parsedExif.CreateDate);
      }

      // Extract camera info
      const exifData: ExifData = {
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

      // Update database with EXIF data and refined date
      database.updatePhotoExif(s3Key, {
        exif: exifData,
        createdAt: exifDate?.toISOString(),
        width: parsedExif.ImageWidth,
        height: parsedExif.ImageHeight,
      });

      if (exifDate) {
        console.log(
          `Refined date with EXIF for ${s3Key}: ${exifDate.toISOString().split('T')[0]}`
        );
      }
    } catch (error) {
      console.warn(`Failed to extract EXIF for ${s3Key}:`, error);
    }
  }

  /**
   * Generate thumbnail (200x200)
   */
  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    return await this.processImage(buffer, {
      width: 200,
      height: 200,
      fit: 'cover',
      quality: 80,
    });
  }

  /**
   * Generate preview (800x600)
   */
  private async generatePreview(buffer: Buffer): Promise<Buffer> {
    return await this.processImage(buffer, {
      width: 800,
      height: 600,
      fit: 'inside',
      quality: 85,
    });
  }

  /**
   * Process image with Sharp
   */
  private async processImage(
    buffer: Buffer,
    options: ProcessOptions
  ): Promise<Buffer> {
    try {
      let image = sharp(buffer);

      // Rotate based on EXIF orientation
      image = image.rotate();

      // Resize if dimensions specified
      if (options.width || options.height) {
        image = image.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          position: 'center',
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG with specified quality
      image = image.jpeg({
        quality: options.quality || 80,
        progressive: true,
      });

      return await image.toBuffer();
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Get image metadata
   */
  async getMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      console.error('Error getting image metadata:', error);
      throw new Error('Failed to get image metadata');
    }
  }

  /**
   * Preload thumbnails for recent photos
   */
  async preloadThumbnails(count: number): Promise<void> {
    console.log(`Preloading ${count} thumbnails...`);

    const photos = database.getUncachedPhotos(count);
    let loaded = 0;

    for (const photo of photos) {
      try {
        if (photo.type === 'photo') {
          await this.getProcessedImage(photo.s3Key, 'thumbnail');
          loaded++;

          if (loaded % 10 === 0) {
            console.log(`Preloaded ${loaded}/${photos.length} thumbnails`);
          }
        }
      } catch (error) {
        console.error(`Failed to preload thumbnail for ${photo.s3Key}:`, error);
      }
    }

    console.log(`Preloading complete: ${loaded} thumbnails loaded`);
  }
}

export const imageProcessor = new ImageProcessorService();
