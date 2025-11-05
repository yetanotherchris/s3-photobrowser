import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { S3Client, CreateBucketCommand, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

describe('S3Client Integration Tests with LocalStack', () => {
  let s3: S3Client;
  const bucketName = 'test-photos';
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:4566';

  beforeAll(async () => {
    // Initialize S3 client for LocalStack
    s3 = new S3Client({
      region: 'us-east-1',
      endpoint,
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
      // Bucket might already exist, that's okay
      if (error.name !== 'BucketAlreadyOwnedByYou') {
        console.log('Bucket creation note:', error.message);
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    s3.destroy();
  });

  test('should connect to LocalStack S3', async () => {
    const response = await s3.send(new ListBucketsCommand({}));
    expect(response.Buckets).toBeDefined();
    expect(Array.isArray(response.Buckets)).toBe(true);
  });

  test('should list buckets including test bucket', async () => {
    const response = await s3.send(new ListBucketsCommand({}));
    const bucketNames = response.Buckets?.map(b => b.Name) || [];
    expect(bucketNames).toContain(bucketName);
  });

  test('should upload a test file to S3', async () => {
    const testKey = 'test/test-upload.txt';
    const testContent = 'Hello from test!';

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
      })
    );

    // Verify by trying to list objects
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'test/',
      })
    );

    const keys = listResponse.Contents?.map(obj => obj.Key) || [];
    expect(keys).toContain(testKey);
  });

  test('should upload and retrieve an image file', async () => {
    const testKey = 'photos/2024/test-image.jpg';
    // Create a minimal JPEG header (not a valid image, but enough for testing)
    const testImageData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ]);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testImageData,
        ContentType: 'image/jpeg',
      })
    );

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const getResponse = await s3.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );

    expect(getResponse.ContentType).toBe('image/jpeg');
    expect(getResponse.Body).toBeDefined();
  });

  test('should delete an object from S3', async () => {
    const testKey = 'test/to-delete.txt';

    // First upload
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from('Delete me'),
      })
    );

    // Then delete
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );

    // Verify deletion
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'test/',
      })
    );

    const keys = listResponse.Contents?.map(obj => obj.Key) || [];
    expect(keys).not.toContain(testKey);
  });
});
