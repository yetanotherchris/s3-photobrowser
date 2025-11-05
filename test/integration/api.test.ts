import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { S3Client, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createTestApp } from '../helpers/testServer.js';
import { database } from '../../server/services/database.js';

describe('API Integration Tests', () => {
  let app: any;
  let s3: S3Client;
  const bucketName = 'test-photos';

  beforeAll(async () => {
    // Setup S3 client
    s3 = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
      forcePathStyle: true,
    });

    // Ensure bucket exists
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
      console.log('Bucket setup note:', error.message);
    }

    // Upload test images
    const testImageData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ]);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: 'photos/2024/01/test1.jpg',
        Body: testImageData,
        ContentType: 'image/jpeg',
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: 'photos/2024/02/test2.jpg',
        Body: testImageData,
        ContentType: 'image/jpeg',
      })
    );

    // Create test app
    app = createTestApp();
  });

  afterAll(async () => {
    // Cleanup
    database.clearAll();
    s3.destroy();
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('s3Connected');
      expect(response.body).toHaveProperty('cacheWritable');
      expect(['ok', 'error']).toContain(response.body.status);
    });

    test('should connect to LocalStack S3', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.body.s3Connected).toBe(true);
    });
  });

  describe('POST /api/photos/refresh', () => {
    test('should index photos from S3', async () => {
      const response = await request(app)
        .post('/api/photos/refresh')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('indexed');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('failed');
      expect(response.body.indexed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/photos', () => {
    beforeAll(async () => {
      // Ensure photos are indexed before testing
      await request(app).post('/api/photos/refresh');
    });

    test('should return photos list', async () => {
      const response = await request(app)
        .get('/api/photos')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('photos');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.photos)).toBe(true);
    });

    test('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/photos?limit=1&offset=0')
        .expect(200);

      expect(response.body.photos).toHaveLength(1);
    });

    test('should include photo URLs', async () => {
      const response = await request(app)
        .get('/api/photos?limit=1')
        .expect(200);

      if (response.body.photos.length > 0) {
        const photo = response.body.photos[0];
        expect(photo).toHaveProperty('thumbnailUrl');
        expect(photo).toHaveProperty('previewUrl');
        expect(photo).toHaveProperty('originalUrl');
      }
    });
  });

  describe('GET /api/photos/:photoId', () => {
    test('should return 404 for non-existent photo', async () => {
      const response = await request(app)
        .get('/api/photos/non-existent-id')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('error');
    });

    test('should return photo metadata for existing photo', async () => {
      // First get a list of photos
      const listResponse = await request(app).get('/api/photos?limit=1');

      if (listResponse.body.photos.length > 0) {
        const photoId = listResponse.body.photos[0].id;
        const response = await request(app)
          .get(`/api/photos/${photoId}`)
          .expect(200)
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('id', photoId);
        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('s3Key');
        expect(response.body).toHaveProperty('thumbnailUrl');
      }
    });
  });
});
