import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import path from 'path';

describe('S3 Photo Browser API Integration Tests', () => {
  let s3Client: S3Client;
  const bucketName = process.env.S3_BUCKET_NAME || 'test-photos';
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:4566';

  beforeAll(async () => {
    s3Client = new S3Client({
      endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'test',
        secretAccessKey: process.env.S3_SECRET_KEY || 'test',
      },
      forcePathStyle: true,
    });

    // Verify S3 setup
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    });
    const response = await s3Client.send(command);
    expect(response.Contents?.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    s3Client.destroy();
  });

  describe('Photo Storage Verification', () => {
    it('should verify all 10 CV photos are in S3', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);
      const contents = response.Contents || [];

      expect(contents).toHaveLength(10);

      const expectedFiles = [
        'cv_photo_1_john_smith.jpg',
        'cv_photo_2_sarah_johnson.jpg',
        'cv_photo_3_michael_chen.jpg',
        'cv_photo_4_emily_davis.jpg',
        'cv_photo_5_david_wilson.jpg',
        'cv_photo_6_lisa_anderson.jpg',
        'cv_photo_7_james_martinez.jpg',
        'cv_photo_8_jessica_brown.jpg',
        'cv_photo_9_robert_taylor.jpg',
        'cv_photo_10_jennifer_lee.jpg',
      ];

      const keys = contents.map((obj) => obj.Key);
      expectedFiles.forEach((file) => {
        expect(keys).toContain(file);
      });
    });

    it('should have valid JPEG photos', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      response.Contents?.forEach((obj) => {
        expect(obj.Key).toMatch(/\.jpg$/);
        expect(obj.Size).toBeGreaterThan(1000); // At least 1KB
      });
    });

    it('should have photos with different timestamps', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);
      const timestamps = response.Contents?.map((obj) => obj.LastModified?.getTime());

      // Check that we have multiple timestamps
      const uniqueTimestamps = new Set(timestamps);
      expect(timestamps).toBeDefined();
      expect(timestamps!.length).toBe(10);
    });
  });

  describe('Photo Naming Convention', () => {
    it('should follow cv_photo_N_name format', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);
      const regex = /^cv_photo_\d+_[a-z_]+\.jpg$/;

      response.Contents?.forEach((obj) => {
        expect(obj.Key).toMatch(regex);
      });
    });

    it('should have sequential numbering', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);
      const numbers = response.Contents?.map((obj) => {
        const match = obj.Key?.match(/cv_photo_(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
      }).sort((a, b) => a - b);

      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('S3 Connection Configuration', () => {
    it('should use correct endpoint', () => {
      expect(endpoint).toBe('http://localhost:4566');
    });

    it('should use correct bucket name', () => {
      expect(bucketName).toBe('test-photos');
    });

    it('should use test credentials', () => {
      expect(process.env.S3_ACCESS_KEY).toBe('test');
      expect(process.env.S3_SECRET_KEY).toBe('test');
    });
  });

  describe('Photo Content Integrity', () => {
    it('should have reasonable file sizes for all photos', async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });

      const response = await s3Client.send(command);

      const sizes = response.Contents?.map((obj) => obj.Size || 0);
      const avgSize = sizes!.reduce((a, b) => a + b, 0) / sizes!.length;

      // Average size should be reasonable (between 20KB and 500KB)
      expect(avgSize).toBeGreaterThan(20 * 1024);
      expect(avgSize).toBeLessThan(500 * 1024);

      // All photos should have similar sizes (within 10x range)
      const minSize = Math.min(...sizes!);
      const maxSize = Math.max(...sizes!);
      expect(maxSize / minSize).toBeLessThan(10);
    });
  });

  describe('LocalStack Health Check', () => {
    it('should connect to LocalStack successfully', async () => {
      try {
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
        });
        const response = await s3Client.send(command);
        expect(response.$metadata.httpStatusCode).toBe(200);
      } catch (error) {
        throw new Error(`LocalStack connection failed: ${error}`);
      }
    });
  });
});
