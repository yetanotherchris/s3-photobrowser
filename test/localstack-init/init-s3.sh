#!/bin/bash

set -e

echo "Initializing LocalStack S3 for testing..."

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 2

# Create the test bucket
echo "Creating test bucket: test-photos"
awslocal s3 mb s3://test-photos || true

# Create some test image files if they don't exist
if [ ! -f /test-data/test-image-1.jpg ]; then
    echo "Creating test image files..."

    # Create a simple test image using ImageMagick or use a placeholder
    # For now, we'll create empty files as placeholders
    # In real tests, you'd want to use actual image files
    touch /test-data/test-image-1.jpg
    touch /test-data/test-image-2.jpg
    touch /test-data/test-image-3.png
    touch /test-data/test-video-1.mp4
fi

# Upload test files to the bucket
echo "Uploading test files to bucket..."
awslocal s3 cp /test-data/test-image-1.jpg s3://test-photos/photos/2024/01/test-image-1.jpg || true
awslocal s3 cp /test-data/test-image-2.jpg s3://test-photos/photos/2024/02/test-image-2.jpg || true
awslocal s3 cp /test-data/test-image-3.png s3://test-photos/photos/2024/03/test-image-3.png || true
awslocal s3 cp /test-data/test-video-1.mp4 s3://test-photos/videos/2024/test-video-1.mp4 || true

# List the contents
echo "Bucket contents:"
awslocal s3 ls s3://test-photos --recursive

echo "LocalStack S3 initialization complete!"
