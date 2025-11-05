# Test Data

This directory contains test images and videos used for integration testing.

## Contents

The test data is automatically generated when running tests. The following files are created:

- `test-image-1.jpg` - Sample JPEG image
- `test-image-2.jpg` - Sample JPEG image
- `test-image-3.png` - Sample PNG image
- `test-video-1.mp4` - Sample MP4 video

## Generating Test Data

Test images are minimal valid image files that contain the proper headers for their respective formats. They are not meant to be viewed but to test file processing and S3 operations.

You can also add your own test images to this directory. Just make sure to:

1. Keep file sizes small (< 1MB)
2. Use common formats (JPEG, PNG, MP4, etc.)
3. Avoid committing actual photos with personal information

## Note

This directory is excluded from git via `.gitignore` to keep the repository size small and avoid committing test artifacts.
