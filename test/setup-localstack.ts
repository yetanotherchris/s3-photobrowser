#!/usr/bin/env tsx

import { S3Client, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load test environment
config({ path: path.resolve(process.cwd(), '.env.test') });

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'test',
    secretAccessKey: process.env.S3_SECRET_KEY || 'test',
  },
  forcePathStyle: true,
});

const bucketName = process.env.S3_BUCKET_NAME || 'test-photos';

async function setupLocalStack() {
  try {
    console.log('Setting up LocalStack S3 bucket...');

    // Create bucket
    try {
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        })
      );
      console.log(`✓ Created bucket: ${bucketName}`);
    } catch (error: any) {
      if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
        console.log(`✓ Bucket already exists: ${bucketName}`);
      } else {
        throw error;
      }
    }

    // Upload test photos with year/month folder structure
    const testPhotosDir = path.resolve(process.cwd(), 'test/fixtures/photos');
    const files = readdirSync(testPhotosDir);

    console.log(`Uploading ${files.length} test photos...`);

    // Organize photos by year (testing folder date extraction)
    // First 3 photos -> 2023, next 3 -> 2024/01, rest -> 2024/12
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(testPhotosDir, file);
      const fileContent = readFileSync(filePath);

      // Determine folder structure based on index
      let s3Key: string;
      if (i < 3) {
        s3Key = `photos/2023/${file}`;
      } else if (i < 6) {
        s3Key = `photos/2024/01/${file}`;
      } else {
        s3Key = `photos/2024/12/${file}`;
      }

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileContent,
          ContentType: file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
        })
      );
      console.log(`  ✓ Uploaded: ${s3Key}`);
    }

    console.log('✅ LocalStack setup complete!');
  } catch (error) {
    console.error('❌ Error setting up LocalStack:', error);
    process.exit(1);
  }
}

setupLocalStack();
