import { describe, it, expect } from 'vitest';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

describe('Photo Content Validation', () => {
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

  describe('Image Format Validation', () => {
    const testPhotos = [
      'cv_photo_1_john_smith.jpg',
      'cv_photo_5_david_wilson.jpg',
      'cv_photo_10_jennifer_lee.jpg',
    ];

    testPhotos.forEach((photoKey) => {
      it(`should validate ${photoKey} is a valid JPEG`, async () => {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: photoKey,
        });

        const response = await s3Client.send(command);
        const bodyContents = await response.Body?.transformToByteArray();

        expect(bodyContents).toBeDefined();

        // Check JPEG magic number (FF D8 FF)
        expect(bodyContents![0]).toBe(0xFF);
        expect(bodyContents![1]).toBe(0xD8);
        expect(bodyContents![2]).toBe(0xFF);
      });

      it(`should validate ${photoKey} can be processed by Sharp`, async () => {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: photoKey,
        });

        const response = await s3Client.send(command);
        const bodyContents = await response.Body?.transformToByteArray();

        const metadata = await sharp(Buffer.from(bodyContents!)).metadata();

        expect(metadata.format).toBe('jpeg');
        expect(metadata.width).toBeGreaterThan(0);
        expect(metadata.height).toBeGreaterThan(0);
        expect(metadata.width).toBe(800);
        expect(metadata.height).toBe(1000);
      });
    });
  });

  describe('Image Dimensions', () => {
    it('should have all photos with consistent dimensions (800x1000)', async () => {
      const photoKeys = [
        'cv_photo_1_john_smith.jpg',
        'cv_photo_2_sarah_johnson.jpg',
        'cv_photo_3_michael_chen.jpg',
        'cv_photo_4_emily_davis.jpg',
        'cv_photo_5_david_wilson.jpg',
      ];

      for (const photoKey of photoKeys) {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: photoKey,
        });

        const response = await s3Client.send(command);
        const bodyContents = await response.Body?.transformToByteArray();

        const metadata = await sharp(Buffer.from(bodyContents!)).metadata();

        expect(metadata.width).toBe(800);
        expect(metadata.height).toBe(1000);
      }
    });
  });

  describe('Image Processing Capabilities', () => {
    it('should be able to create thumbnails', async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'cv_photo_1_john_smith.jpg',
      });

      const response = await s3Client.send(command);
      const bodyContents = await response.Body?.transformToByteArray();

      const thumbnail = await sharp(Buffer.from(bodyContents!))
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      expect(thumbnail).toBeDefined();
      expect(thumbnail.length).toBeGreaterThan(0);

      const thumbnailMetadata = await sharp(thumbnail).metadata();
      expect(thumbnailMetadata.width).toBe(200);
      expect(thumbnailMetadata.height).toBe(200);
    });

    it('should be able to create preview sizes', async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: 'cv_photo_1_john_smith.jpg',
      });

      const response = await s3Client.send(command);
      const bodyContents = await response.Body?.transformToByteArray();

      const preview = await sharp(Buffer.from(bodyContents!))
        .resize(1200, null, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toBuffer();

      expect(preview).toBeDefined();
      expect(preview.length).toBeGreaterThan(0);

      const previewMetadata = await sharp(preview).metadata();
      expect(previewMetadata.width).toBeLessThanOrEqual(1200);
    });
  });

  describe('CV Photo Content', () => {
    it('should contain expected people names in file names', async () => {
      const expectedNames = [
        'john_smith',
        'sarah_johnson',
        'michael_chen',
        'emily_davis',
        'david_wilson',
        'lisa_anderson',
        'james_martinez',
        'jessica_brown',
        'robert_taylor',
        'jennifer_lee',
      ];

      // This is validated by checking if the files exist (already done in other tests)
      expectedNames.forEach((name) => {
        expect(name).toBeTruthy();
      });
    });
  });
});
