# Testing Guide

This directory contains all tests for the S3 Photo Browser application.

## Test Structure

```
test/
├── integration/          # Integration tests (API, S3)
│   ├── api.test.ts      # API endpoint tests
│   └── s3Client.test.ts # S3 client integration tests
├── unit/                # Unit tests
│   └── s3Client.test.ts # S3 client utility tests
├── helpers/             # Test helpers and utilities
│   └── testServer.ts    # Test Express app setup
├── localstack-init/     # LocalStack initialization scripts
│   └── init-s3.sh       # S3 bucket setup script
├── test-data/           # Test data files
└── setup.ts             # Jest setup file

```

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start LocalStack (for integration tests):
   ```bash
   docker-compose -f docker-compose.localstack.yml up -d localstack
   ```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

**Unit tests only:**
```bash
npm run test:unit
```

**Integration tests only:**
```bash
npm run test:integration
```

**Watch mode (re-run on file changes):**
```bash
npm run test:watch
```

**With coverage:**
```bash
npm run test:coverage
```

## Test Environment

Tests use a separate environment configuration (`.env.test`) that points to LocalStack instead of real S3 services.

### LocalStack Configuration

- **Endpoint:** http://localhost:4566
- **Region:** us-east-1
- **Access Key:** test
- **Secret Key:** test
- **Bucket:** test-photos

### Test Database

Tests use a separate SQLite database in `./test-cache/photos.db` to avoid interfering with development data.

## Writing Tests

### Unit Tests

Unit tests should:
- Test individual functions/methods in isolation
- Mock external dependencies
- Be fast and not require external services
- Go in the `test/unit/` directory

Example:
```typescript
import { describe, test, expect } from '@jest/globals';

describe('MyService', () => {
  test('should do something', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

### Integration Tests

Integration tests should:
- Test complete workflows
- Use LocalStack for S3 operations
- Test API endpoints with supertest
- Go in the `test/integration/` directory

Example:
```typescript
import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/testServer.js';

describe('API Integration', () => {
  let app: any;

  beforeAll(() => {
    app = createTestApp();
  });

  test('GET /api/health', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });
});
```

## LocalStack Setup

LocalStack emulates AWS services locally, allowing us to test S3 operations without connecting to real AWS infrastructure.

### Starting LocalStack

Using docker-compose:
```bash
docker-compose -f docker-compose.localstack.yml up -d localstack
```

### Stopping LocalStack

```bash
docker-compose -f docker-compose.localstack.yml down
```

### Viewing LocalStack Logs

```bash
docker-compose -f docker-compose.localstack.yml logs -f localstack
```

### Manual S3 Operations (for debugging)

Using AWS CLI with LocalStack:

```bash
# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List objects in bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://test-photos --recursive

# Upload a file
aws --endpoint-url=http://localhost:4566 s3 cp test.jpg s3://test-photos/test.jpg
```

Or use `awslocal` (simpler):

```bash
# Install awslocal
pip install awscli-local

# Then use awslocal instead of aws
awslocal s3 ls
awslocal s3 ls s3://test-photos --recursive
```

## Continuous Integration

Tests should run in CI/CD pipelines. The CI configuration should:

1. Start LocalStack service
2. Wait for LocalStack to be ready
3. Run tests with proper environment variables
4. Collect coverage reports
5. Clean up resources

Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: s3
          DEBUG: 1

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Tests failing with S3 connection errors

1. Ensure LocalStack is running:
   ```bash
   docker ps | grep localstack
   ```

2. Check LocalStack is healthy:
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

3. Verify environment variables:
   ```bash
   cat .env.test
   ```

### Tests timing out

Increase Jest timeout in test file:
```typescript
jest.setTimeout(30000); // 30 seconds
```

### Database locked errors

Ensure you're cleaning up database connections in `afterAll` hooks:
```typescript
afterAll(() => {
  database.close();
});
```

## Coverage Goals

Aim for:
- **80%+ overall coverage**
- **90%+ coverage for critical paths** (photo indexing, S3 operations)
- **100% coverage for utility functions**

View coverage report:
```bash
npm run test:coverage
open coverage/index.html  # On macOS
xdg-open coverage/index.html  # On Linux
```
