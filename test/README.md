# Testing Guide

This directory contains all tests for the S3 Photo Browser application. The project supports both **Jest** and **Vitest** test frameworks.

## Overview

The test suite uses LocalStack to provide a local S3-compatible environment, ensuring tests run against real S3 APIs without requiring AWS credentials or incurring costs.

## Test Frameworks

This project includes two test framework setups:

### Jest (Default)
- Traditional testing framework with excellent TypeScript support
- Located in `test/integration/` and `test/unit/`
- Configured via `jest.config.js`

### Vitest
- Modern, faster test framework with Vite integration
- Test files use Vitest directly
- Better performance and hot module reload support

## Test Structure

```
test/
├── integration/          # Integration tests (API, S3)
│   ├── api.test.ts      # API endpoint tests (Jest)
│   └── s3Client.test.ts # S3 client integration tests (Jest)
├── unit/                # Unit tests
│   └── s3Client.test.ts # S3 client utility tests (Jest)
├── helpers/             # Test helpers and utilities
│   └── testServer.ts    # Test Express app setup
├── localstack-init/     # LocalStack initialization scripts
│   └── init-s3.sh       # S3 bucket setup script
├── test-data/           # Test data files
├── fixtures/            # Test fixtures (Vitest)
│   └── photos/          # Generated CV photos for testing
├── setup.ts             # Jest/Vitest setup file
├── setup-localstack.ts  # LocalStack S3 initialization (Vitest)
└── generate-test-photos.ts  # Mock photo generator (Vitest)
```

## Running Tests

### Jest Tests (Recommended for Unit/Integration)

**Prerequisites:**
- Docker and Docker Compose (for integration tests)

**Quick Start:**

```bash
# Automated setup
./scripts/test-setup.sh

# Run all Jest tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
```

**Manual Setup:**

```bash
# Start LocalStack for integration tests
docker compose -f docker-compose.localstack.yml up -d localstack

# Run tests
npm test

# Stop LocalStack
docker compose -f docker-compose.localstack.yml down
```

### Vitest Tests (Recommended for E2E)

```bash
# Quick test with automated setup
./test-runner.sh

# Or manual steps:
# 1. Start LocalStack
docker compose -f docker-compose.test.yml up -d localstack

# 2. Generate test photos
npm run test:generate-photos

# 3. Setup S3 bucket
npm run test:setup

# 4. Run Vitest tests
npm run test:vitest

# 5. Cleanup
npm run test:cleanup
```

## Test Environment

### Environment Variables

Tests use `.env.test` configuration:

```env
NODE_ENV=test
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_ENDPOINT=http://localhost:4566
S3_BUCKET_NAME=test-photos
S3_REGION=us-east-1
CACHE_DIR=./test-cache
CACHE_SIZE_LIMIT=1GB
PRELOAD_COUNT=10
PORT=3001
```

### LocalStack Configuration

Two LocalStack configurations are available:

**docker-compose.localstack.yml** - Jest tests
- Port: 4566
- Services: S3 only
- Auto-initialization via init scripts

**docker-compose.test.yml** - Vitest tests
- Port: 4566
- Services: S3 only
- Data directory: `test/localstack-data/`

## Test Coverage

### Jest Tests

#### Unit Tests ✅
- S3 client utility functions (11 tests - all passing)
  - Image file detection
  - Video file detection
  - MIME type determination

#### Integration Tests
- S3 operations with LocalStack (5 tests)
- API endpoints (6 tests)

**Total: 22 Jest tests**

### Vitest Tests
- Bucket operations
- Object upload/download
- Image processing
- Storage verification

## Troubleshooting

### Jest Tests

#### Tests failing with S3 connection errors

1. Ensure LocalStack is running:
   ```bash
   docker ps | grep localstack
   ```

2. Check LocalStack is healthy:
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

### Vitest Tests

#### LocalStack Won't Start

```bash
# View LocalStack logs
docker compose -f docker-compose.test.yml logs localstack

# Remove old containers
docker compose -f docker-compose.test.yml down -v
```

## Coverage Goals

Aim for:
- **80%+ overall coverage**
- **90%+ coverage for critical paths**
- **100% coverage for utility functions**

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
