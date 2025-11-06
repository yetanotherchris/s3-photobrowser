import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { Readable } from 'stream';

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
}

class S3ClientService {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = config.s3.bucketName;

    // Configure S3 client with support for multiple providers
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      // Force path style for non-AWS providers (e.g., MinIO, Wasabi)
      forcePathStyle: true,
    });
  }

  /**
   * Test S3 connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucketName })
      );
      return true;
    } catch (error) {
      console.error('S3 connection test failed:', error);
      return false;
    }
  }

  /**
   * List all objects in the bucket recursively
   */
  async listAllObjects(): Promise<S3Object[]> {
    const objects: S3Object[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await this.client.send(command);

        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key && item.Size !== undefined && item.LastModified) {
              objects.push({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return objects;
    } catch (error) {
      console.error('Error listing S3 objects:', error);
      throw new Error('Failed to list S3 objects');
    }
  }

  /**
   * Get object from S3
   */
  async getObject(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in response');
      }

      return response.Body as Readable;
    } catch (error) {
      console.error(`Error getting object ${key}:`, error);
      throw new Error(`Failed to get object: ${key}`);
    }
  }

  /**
   * Get object as buffer
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const stream = await this.getObject(key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Get partial object buffer (for EXIF extraction)
   * Downloads only the first N bytes to extract EXIF data without downloading entire file
   * EXIF data is typically in the first 64KB of JPEG files
   */
  async getPartialObjectBuffer(key: string, bytes: number = 65536): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Range: `bytes=0-${bytes - 1}`, // Range is inclusive
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in response');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      console.error(`Error getting partial object ${key}:`, error);
      throw new Error(`Failed to get partial object: ${key}`);
    }
  }

  /**
   * Generate presigned URL for direct access
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error(`Error generating presigned URL for ${key}:`, error);
      throw new Error(`Failed to generate presigned URL: ${key}`);
    }
  }

  /**
   * Delete object from S3
   */
  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error(`Error deleting object ${key}:`, error);
      throw new Error(`Failed to delete object: ${key}`);
    }
  }

  /**
   * Check if file is an image
   */
  isImage(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  /**
   * Check if file is a video
   */
  isVideo(filename: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext);
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(filename: string): string {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export const s3Client = new S3ClientService();
