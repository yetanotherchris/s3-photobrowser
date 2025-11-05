# Claude Development Guide for S3 Photo Browser

This document provides guidance for Claude (AI assistant) when working on this project.

## Project Overview

S3 Photo Browser is a Google Photos-style web application for browsing, viewing, and managing photos and videos stored in S3-compatible storage.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Storage: S3-compatible object storage (AWS S3, LocalStack for testing)
- Database: SQLite for metadata
- Image Processing: Sharp
- Video Processing: FFmpeg

## Testing Requirements

### Local Testing with LocalStack

All changes must be tested locally using LocalStack before committing. This ensures the application works correctly with S3 storage.

#### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 18+ installed
3. NPM dependencies installed

#### Running Tests

**Quick Test Run:**
```bash
npm test
```

**Full LocalStack Integration Test:**
```bash
npm run test:localstack
```

This command will:
1. Start LocalStack S3 service in Docker
2. Generate 10 test CV photos (mock resume photos)
3. Upload photos to LocalStack S3 bucket
4. Run all integration tests
5. Validate S3 operations, photo content, and image processing

**Manual Setup (if needed):**
```bash
# Start LocalStack
docker-compose -f docker-compose.test.yml up -d localstack

# Wait for LocalStack to be ready
sleep 5

# Generate test photos
npm run test:generate-photos

# Setup S3 bucket and upload photos
npm run test:setup

# Run tests
npm test

# Cleanup
npm run test:cleanup
```

#### Test Structure

The test suite includes:

1. **S3 Integration Tests** (`test/api.test.ts`)
   - S3 bucket operations
   - Object listing and retrieval
   - Photo content validation
   - Error handling

2. **Server Tests** (`test/server.test.ts`)
   - Photo storage verification
   - Naming conventions
   - S3 connection configuration
   - Content integrity
   - LocalStack health checks

3. **Integration Tests** (`test/integration.test.ts`)
   - Image format validation (JPEG magic numbers)
   - Image dimensions (800x1000)
   - Sharp processing capabilities
   - Thumbnail and preview generation

#### Test Data

Test photos are automatically generated as mock CV/resume photos with:
- 10 different people profiles
- Names, roles, contact info, skills
- Consistent 800x1000 dimensions
- JPEG format
- Different creation dates

Files are generated in: `test/fixtures/photos/`

### Environment Configuration

**Production/Development:** Use `.env` file
**Testing:** Use `.env.test` file (pre-configured for LocalStack)

Test environment uses:
- Endpoint: `http://localhost:4566`
- Bucket: `test-photos`
- Region: `us-east-1`
- Access Key: `test`
- Secret Key: `test`

## Development Workflow

### Before Making Changes

1. Read the README.md to understand the application
2. Review existing code structure
3. Ensure all tests pass:
   ```bash
   npm run test:localstack
   ```

### Making Changes

1. Make your code changes
2. Generate test photos if needed:
   ```bash
   npm run test:generate-photos
   ```
3. Run tests locally:
   ```bash
   npm run test:localstack
   ```
4. Fix any failing tests
5. Ensure all tests pass before committing

### After Making Changes

1. Run full test suite:
   ```bash
   npm run test:localstack
   ```
2. Verify Docker containers are working:
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```
3. Check LocalStack logs if tests fail:
   ```bash
   docker-compose -f docker-compose.test.yml logs localstack
   ```
4. Cleanup test environment:
   ```bash
   npm run test:cleanup
   ```

## Common Issues and Solutions

### LocalStack Not Starting

**Problem:** LocalStack container fails to start

**Solution:**
```bash
# Stop all containers
docker-compose -f docker-compose.test.yml down -v

# Remove old data
rm -rf test/localstack-data

# Start fresh
docker-compose -f docker-compose.test.yml up -d localstack
```

### Tests Failing with Connection Errors

**Problem:** Tests cannot connect to LocalStack

**Solutions:**
1. Verify LocalStack is running:
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```

2. Check LocalStack health:
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

3. Wait longer for LocalStack to start (increase sleep time in test:localstack script)

### Photos Not Uploading

**Problem:** Test photos don't upload to LocalStack

**Solutions:**
1. Regenerate test photos:
   ```bash
   npm run test:generate-photos
   ```

2. Manually run setup:
   ```bash
   npm run test:setup
   ```

3. Check S3 bucket contents:
   ```bash
   aws --endpoint-url=http://localhost:4566 s3 ls s3://test-photos/
   ```

### Sharp/Image Processing Errors

**Problem:** Image processing fails during tests

**Solutions:**
1. Ensure Sharp is properly installed:
   ```bash
   npm install sharp --force
   ```

2. Check that test photos are valid JPEGs:
   ```bash
   file test/fixtures/photos/*.jpg
   ```

## Code Quality Standards

### TypeScript

- Strict mode enabled
- All types must be explicit
- No `any` types unless absolutely necessary
- Use interfaces for complex types

### Testing

- All new features must have tests
- Tests must use LocalStack, not mocked S3
- Minimum 80% code coverage for new code
- Integration tests required for API endpoints

### Error Handling

- All async operations must have try/catch
- Proper error messages for debugging
- Return appropriate HTTP status codes
- Log errors with context

## API Endpoints Reference

### Photos
- `GET /api/photos` - Get photos with pagination
- `GET /api/photos/:id` - Get single photo
- `GET /api/photos/:id/download?size=thumbnail|preview|original` - Download photo
- `DELETE /api/photos/:id` - Delete photo
- `POST /api/photos/refresh` - Re-index S3 bucket
- `GET /api/photos/dates` - Get dates with photo counts

### Cache
- `GET /api/cache/stats` - Get cache statistics
- `POST /api/cache/clear` - Clear cache

### Health
- `GET /api/health` - Health check endpoint

## File Structure

```
s3-photobrowser/
├── server/                      # Backend code
│   ├── index.ts                # Main server file
│   ├── config.ts               # Configuration
│   └── services/               # Service modules
├── src/                        # Frontend code
├── test/                       # Test files
│   ├── fixtures/               # Test data
│   │   └── photos/            # Generated CV photos
│   ├── setup.ts               # Test setup
│   ├── setup-localstack.ts    # LocalStack initialization
│   ├── generate-test-photos.ts # Photo generator
│   ├── api.test.ts            # S3 API tests
│   ├── server.test.ts         # Server integration tests
│   └── integration.test.ts    # Full integration tests
├── docker-compose.test.yml     # Test infrastructure
├── .env.test                   # Test environment config
└── vitest.config.ts           # Test configuration
```

## Deployment Testing

Before deploying to production:

1. Run full test suite with LocalStack
2. Test with actual S3 provider (if available)
3. Verify all environment variables are set
4. Test Docker build process
5. Run health checks

## Getting Help

- Review README.md for application documentation
- Check test files for examples
- Review existing code for patterns
- Test changes locally with LocalStack

## Version Control

### Commit Messages

Use conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `test:` Test additions/changes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

### Before Committing

Run this checklist:
- [ ] All tests pass (`npm run test:localstack`)
- [ ] No console errors or warnings
- [ ] Code is formatted (`npm run format`)
- [ ] Code is linted (`npm run lint`)
- [ ] README updated if needed
- [ ] This file (CLAUDE.md) updated if workflow changes

## Testing Philosophy

**Always test with LocalStack, not mocks.**

This ensures:
- Real S3 API behavior
- Network request handling
- Proper error scenarios
- Upload/download workflows
- Performance characteristics

Mock tests can hide issues that only appear with real S3 operations.

## Performance Considerations

- Thumbnails should be < 100KB
- Preview images should be < 500KB
- Database queries should be indexed
- Cache frequently accessed images
- Use presigned URLs for large files

## Security Guidelines

- Never commit real AWS credentials
- Use environment variables for secrets
- Validate all user inputs
- Implement rate limiting
- Use helmet for security headers
- Keep dependencies updated

---

**Remember:** The goal is to ensure the application works correctly with S3 storage. All changes should be validated with LocalStack tests before assuming they work.
