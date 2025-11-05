import ffmpeg from 'fluent-ffmpeg';
import { s3Client } from './s3Client.js';
import { cacheManager } from './cacheManager.js';
import { database } from './database.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

class VideoProcessorService {
  /**
   * Get video thumbnail
   */
  async getVideoThumbnail(s3Key: string): Promise<Buffer> {
    // Check cache first
    const cached = await cacheManager.getCachedFile(s3Key, 'thumbnail');
    if (cached) {
      return cached;
    }

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(s3Key);

    // Save to cache
    await cacheManager.saveToCac(s3Key, 'thumbnail', thumbnail);

    // Mark as cached in database
    const photo = database.getPhotoByS3Key(s3Key);
    if (photo) {
      database.markAsCached(photo.id);
    }

    return thumbnail;
  }

  /**
   * Generate video thumbnail at 1 second
   */
  private async generateThumbnail(s3Key: string): Promise<Buffer> {
    const tempVideoPath = path.join(tmpdir(), `video-${randomUUID()}`);
    const tempThumbPath = path.join(tmpdir(), `thumb-${randomUUID()}.jpg`);

    try {
      // Download video to temp file
      const videoBuffer = await s3Client.getObjectBuffer(s3Key);
      await fs.writeFile(tempVideoPath, videoBuffer);

      // Generate thumbnail using ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .screenshots({
            count: 1,
            timemarks: ['1'], // Capture at 1 second
            filename: path.basename(tempThumbPath),
            folder: path.dirname(tempThumbPath),
            size: '200x200',
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      // Read thumbnail
      const thumbnail = await fs.readFile(tempThumbPath);

      return thumbnail;
    } catch (error) {
      console.error(`Failed to generate video thumbnail for ${s3Key}:`, error);
      throw new Error('Failed to generate video thumbnail');
    } finally {
      // Cleanup temp files
      try {
        await fs.unlink(tempVideoPath);
        await fs.unlink(tempThumbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(s3Key: string): Promise<{
    duration?: number;
    width?: number;
    height?: number;
  }> {
    const tempVideoPath = path.join(tmpdir(), `video-${randomUUID()}`);

    try {
      // Download video to temp file
      const videoBuffer = await s3Client.getObjectBuffer(s3Key);
      await fs.writeFile(tempVideoPath, videoBuffer);

      // Get metadata using ffmpeg
      const metadata = await new Promise<{
        duration?: number;
        width?: number;
        height?: number;
      }>((resolve, reject) => {
        ffmpeg.ffprobe(tempVideoPath, (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = data.streams.find((s) => s.codec_type === 'video');

          resolve({
            duration: data.format.duration,
            width: videoStream?.width,
            height: videoStream?.height,
          });
        });
      });

      return metadata;
    } catch (error) {
      console.error(`Failed to get video metadata for ${s3Key}:`, error);
      return {};
    } finally {
      // Cleanup
      try {
        await fs.unlink(tempVideoPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Preload video thumbnails
   */
  async preloadVideoThumbnails(count: number): Promise<void> {
    console.log(`Preloading ${count} video thumbnails...`);

    const videos = database
      .getPhotos({ type: 'video', limit: count, sortBy: 'date', sortOrder: 'desc' })
      .filter((v) => !v.cached);

    let loaded = 0;

    for (const video of videos) {
      try {
        await this.getVideoThumbnail(video.s3Key);
        loaded++;

        if (loaded % 5 === 0) {
          console.log(`Preloaded ${loaded}/${videos.length} video thumbnails`);
        }
      } catch (error) {
        console.error(`Failed to preload video thumbnail for ${video.s3Key}:`, error);
      }
    }

    console.log(`Video thumbnail preloading complete: ${loaded} thumbnails loaded`);
  }
}

export const videoProcessor = new VideoProcessorService();
