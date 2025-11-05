import sharp from 'sharp';
import { s3Client } from './s3Client.js';
import { cacheManager, CacheSize } from './cacheManager.js';
import { database } from './database.js';

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
      const photo = database.getPhotoByS3Key(s3Key);
      if (photo) {
        database.markAsCached(photo.id);
      }
    }

    return processed;
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
