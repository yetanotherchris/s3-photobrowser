# Test Suite

This directory contains the complete test suite for the S3 Photo Browser application.

## Overview

The test suite uses LocalStack to provide a local S3-compatible environment, ensuring tests run against real S3 APIs without requiring AWS credentials or incurring costs.

## Test Files

- **`setup.ts`** - Test environment configuration and setup
- **`setup-localstack.ts`** - LocalStack S3 initialization and photo upload
- **`generate-test-photos.ts`** - Generates 10 mock CV photos using Sharp
- **`api.test.ts`** - S3 API integration tests
- **`server.test.ts`** - Server and storage verification tests
- **`integration.test.ts`** - Full integration tests with image processing

## Test Data

### Mock CV Photos

The test suite generates 10 CV/resume photos with the following characteristics:

- **Format:** JPEG
- **Dimensions:** 800x1000 pixels
- **Content:** Mock CV with profile photo, name, role, contact info, and skills
- **People:**
  1. John Smith - Software Engineer
  2. Sarah Johnson - Product Manager
  3. Michael Chen - UX Designer
  4. Emily Davis - Data Scientist
  5. David Wilson - DevOps Engineer
  6. Lisa Anderson - Marketing Director
  7. James Martinez - Senior Developer
  8. Jessica Brown - QA Engineer
  9. Robert Taylor - Tech Lead
  10. Jennifer Lee - HR Manager

Photos are generated in `test/fixtures/photos/` (git-ignored).

## Running Tests

### Quick Test (Recommended)

```bash
./test-runner.sh
```

This script:
1. Verifies Docker and Node.js are available
2. Starts LocalStack
3. Waits for LocalStack to be ready
4. Generates test photos
5. Sets up S3 bucket and uploads photos
6. Runs all tests
7. Cleans up Docker containers

### Manual Testing

```bash
# Start LocalStack
docker compose -f docker-compose.test.yml up -d localstack

# Wait for it to be ready (check health)
curl http://localhost:4566/_localstack/health

# Generate photos
npm run test:generate-photos

# Setup S3 bucket
npm run test:setup

# Run tests
npm test

# Cleanup
npm run test:cleanup
```

### Individual Test Suites

```bash
# Run specific test file
npx vitest run test/api.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npx vitest run --coverage
```

## Test Configuration

### Environment Variables

Tests use `.env.test` configuration:

```env
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_ENDPOINT=http://localhost:4566
S3_BUCKET_NAME=test-photos
S3_REGION=us-east-1
```

### LocalStack Configuration

LocalStack is configured in `docker-compose.test.yml`:

- **Port:** 4566 (S3 API)
- **Services:** S3 only
- **Data Directory:** `test/localstack-data/` (git-ignored)

## Test Coverage

### S3 Operations

- ✓ Bucket creation
- ✓ Object upload
- ✓ Object listing
- ✓ Object retrieval
- ✓ Object metadata
- ✓ Error handling

### Image Processing

- ✓ JPEG validation
- ✓ Dimension verification (800x1000)
- ✓ Thumbnail generation (200x200)
- ✓ Preview generation (1200px width)
- ✓ Format conversion
- ✓ Quality adjustment

### Storage Verification

- ✓ Photo count (10 photos)
- ✓ Naming conventions (cv_photo_N_name.jpg)
- ✓ File sizes (reasonable ranges)
- ✓ Sequential numbering
- ✓ Content integrity

### Integration

- ✓ LocalStack health checks
- ✓ S3 connection configuration
- ✓ End-to-end upload/download
- ✓ Image processing pipeline

## Troubleshooting

### LocalStack Won't Start

**Problem:** Docker container fails to start

**Solutions:**

```bash
# Check Docker daemon
docker ps

# View LocalStack logs
docker compose -f docker-compose.test.yml logs localstack

# Remove old containers and volumes
docker compose -f docker-compose.test.yml down -v

# Remove data directory
rm -rf test/localstack-data
```

### Connection Refused Errors

**Problem:** Tests can't connect to LocalStack

**Solutions:**

```bash
# Verify LocalStack is running
docker compose -f docker-compose.test.yml ps

# Check LocalStack health
curl http://localhost:4566/_localstack/health

# Wait longer for startup (LocalStack can take 5-10 seconds)
sleep 10
```

### Photo Generation Fails

**Problem:** Sharp fails to generate photos

**Solutions:**

```bash
# Reinstall Sharp
npm install sharp --force

# Check if fixtures directory exists
mkdir -p test/fixtures/photos

# Run generator manually
npx tsx test/generate-test-photos.ts
```

### S3 Upload Fails

**Problem:** Photos don't upload to LocalStack

**Solutions:**

```bash
# Verify LocalStack S3 is running
aws --endpoint-url=http://localhost:4566 s3 ls

# Check if bucket exists
aws --endpoint-url=http://localhost:4566 s3 ls s3://test-photos/

# Manually create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-photos

# Run setup again
npm run test:setup
```

### Tests Timeout

**Problem:** Tests exceed 30 second timeout

**Solutions:**

- Increase timeout in `vitest.config.ts`:
  ```typescript
  testTimeout: 60000,  // 60 seconds
  ```

- Check LocalStack performance:
  ```bash
  docker stats
  ```

## CI/CD Integration

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Start LocalStack
  run: docker compose -f docker-compose.test.yml up -d localstack

- name: Wait for LocalStack
  run: |
    timeout 30 bash -c 'until curl -s http://localhost:4566/_localstack/health; do sleep 1; done'

- name: Run Tests
  run: npm run test:localstack

- name: Cleanup
  run: npm run test:cleanup
  if: always()
```

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup code
  });

  afterAll(() => {
    // Cleanup code
  });

  describe('Specific Functionality', () => {
    it('should do something', async () => {
      // Test code
      expect(result).toBe(expected);
    });
  });
});
```

### Best Practices

1. **Use Real S3 Operations:** Don't mock S3 calls, use LocalStack
2. **Test Realistic Scenarios:** Use actual photos and processing
3. **Clean Up:** Always cleanup resources in afterAll
4. **Descriptive Names:** Use clear test descriptions
5. **Async/Await:** Handle promises properly
6. **Error Cases:** Test both success and failure paths

## Performance

Typical test run times:

- **Photo Generation:** 2-3 seconds
- **LocalStack Startup:** 5-10 seconds
- **S3 Setup:** 3-5 seconds
- **Test Execution:** 10-15 seconds
- **Total:** ~25-35 seconds

## Dependencies

- **vitest** - Test framework
- **supertest** - HTTP testing
- **@aws-sdk/client-s3** - AWS SDK for S3
- **sharp** - Image processing
- **tsx** - TypeScript execution

## Maintenance

### Updating Test Data

To change test CV photos:

1. Edit `generate-test-photos.ts`
2. Update the `people` array with new data
3. Regenerate photos: `npm run test:generate-photos`
4. Re-run tests: `npm test`

### Adding New Test Suites

1. Create new test file in `test/` directory
2. Import vitest and necessary dependencies
3. Follow existing test patterns
4. Run tests to verify: `npm test`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
