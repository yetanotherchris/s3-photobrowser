import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

describe('LocalStack S3 Integration Tests', () => {
  let s3Client: S3Client;
  const bucketName = process.env.S3_BUCKET_NAME || 'test-photos';

  beforeAll(() => {
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'test',
        secretAccessKey: process.env.S3_SECRET_KEY || 'test',
      },
      forcePathStyle: true,
    });
  });

  afterAll(() => {
    s3Client.destroy();
  });

  describe('S3 Bucket Operations', () => {
    it('should list objects in the bucket', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      expect(response).toBeDefined();
      expect(response.Contents).toBeDefined();
      expect(response.Contents?.length).toBeGreaterThan(0);
    });

    it('should have 10 CV photos uploaded', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      expect(response.Contents).toHaveLength(10);
    });

    it('should have correctly named CV photo files', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);
      const keys = response.Contents?.map((obj) => obj.Key) || [];

      expect(keys).toContain('cv_photo_1_john_smith.jpg');
      expect(keys).toContain('cv_photo_2_sarah_johnson.jpg');
      expect(keys).toContain('cv_photo_3_michael_chen.jpg');
      expect(keys).toContain('cv_photo_4_emily_davis.jpg');
      expect(keys).toContain('cv_photo_5_david_wilson.jpg');
      expect(keys).toContain('cv_photo_6_lisa_anderson.jpg');
      expect(keys).toContain('cv_photo_7_james_martinez.jpg');
      expect(keys).toContain('cv_photo_8_jessica_brown.jpg');
      expect(keys).toContain('cv_photo_9_robert_taylor.jpg');
      expect(keys).toContain('cv_photo_10_jennifer_lee.jpg');
    });

    it('should retrieve a specific photo', async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'cv_photo_1_john_smith.jpg',
      });

      const response = await s3Client.send(command);

      expect(response).toBeDefined();
      expect(response.Body).toBeDefined();
      expect(response.ContentType).toContain('image/jpeg');
    });

    it('should have proper metadata for photos', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      response.Contents?.forEach((obj) => {
        expect(obj.Key).toBeDefined();
        expect(obj.Size).toBeGreaterThan(0);
        expect(obj.LastModified).toBeDefined();
      });
    });
  });

  describe('Photo Content Validation', () => {
    it('should have photos with reasonable file sizes', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      response.Contents?.forEach((obj) => {
        // Photos should be between 10KB and 5MB
        expect(obj.Size).toBeGreaterThan(10 * 1024);
        expect(obj.Size).toBeLessThan(5 * 1024 * 1024);
      });
    });

    it('should retrieve photo data as buffer', async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'cv_photo_1_john_smith.jpg',
      });

      const response = await s3Client.send(command);
      const bodyContents = await response.Body?.transformToByteArray();

      expect(bodyContents).toBeDefined();
      expect(bodyContents?.length).toBeGreaterThan(0);

      // Check JPEG magic number (FF D8 FF)
      expect(bodyContents?.[0]).toBe(0xFF);
      expect(bodyContents?.[1]).toBe(0xD8);
      expect(bodyContents?.[2]).toBe(0xFF);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent object gracefully', async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'non_existent_photo.jpg',
      });

      await expect(s3Client.send(command)).rejects.toThrow();
    });
  });
});
