# GitHub Actions Workflows

This directory contains CI/CD workflows for the S3 Photo Browser application.

## Workflows

### 1. Docker Compose Integration Test (`docker-compose-test.yml`)

**Trigger:** Pull requests and pushes to main/master branches

**Purpose:** Test the complete application stack using Docker Compose with LocalStack

**What it does:**
1. **Sets up environment** - Creates test configuration with LocalStack S3
2. **Builds Docker image** - Builds the application container
3. **Starts services** - Launches LocalStack and the application
4. **Initializes data** - Creates S3 bucket and uploads test images
5. **Runs smoke tests:**
   - Health check endpoint (`/api/health`)
   - Photos API endpoint (`/api/photos`)
   - Cache stats endpoint (`/api/cache/stats`)
   - Photo refresh endpoint (`/api/photos/refresh`)
6. **Validates responses** - Checks JSON structure and required fields
7. **Collects logs** - Captures container logs for debugging
8. **Cleanup** - Removes all containers and volumes

**Jobs:**
- `docker-compose-test` - Full integration test with LocalStack
- `docker-build-test` - Verifies Docker image builds correctly
- `summary` - Aggregates results from all jobs

**Duration:** ~5-10 minutes

**Failure handling:**
- Logs are always collected (even on failure)
- Container status is displayed
- All resources are cleaned up

### 2. Tests (`test.yml`)

**Trigger:** Pull requests and pushes to main/develop branches

**Purpose:** Run unit tests, integration tests, linting, and build verification

**What it does:**
1. **Unit tests** - Fast isolated tests
2. **Integration tests** - Tests with LocalStack S3 service
3. **Code coverage** - Generates coverage reports
4. **Linting** - Code quality checks
5. **Build verification** - Ensures production build succeeds

**Jobs:**
- `test` - Runs all tests with LocalStack
- `lint` - ESLint checks
- `build` - Production build verification

**Duration:** ~3-5 minutes

## Running Workflows Locally

### Docker Compose Test

You can simulate the Docker Compose workflow locally:

```bash
# 1. Create .env file
cat > .env << EOF
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_ENDPOINT=http://localstack:4566
S3_BUCKET_NAME=test-photos
S3_REGION=us-east-1
CACHE_DIR=/app/cache
CACHE_SIZE_LIMIT=1GB
PRELOAD_COUNT=10
PORT=3001
NODE_ENV=production
ENABLE_VIDEO_SUPPORT=true
EOF

# 2. Start LocalStack
docker run -d --name localstack -p 4566:4566 \
  -e SERVICES=s3 \
  -e DEBUG=1 \
  localstack/localstack:latest

# 3. Wait for LocalStack
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  echo "Waiting for LocalStack..."
  sleep 2
done

# 4. Create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-photos

# 5. Build and run application
docker compose up --build

# 6. Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/photos

# 7. Cleanup
docker compose down -v
docker rm -f localstack
```

### Unit/Integration Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm run test:unit

# Run integration tests (requires LocalStack)
docker compose -f docker-compose.localstack.yml up -d localstack
npm run test:integration
docker compose -f docker-compose.localstack.yml down
```

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![Docker Compose Tests](https://github.com/yetanotherchris/s3-photobrowser/workflows/Docker%20Compose%20Integration%20Test/badge.svg)
![Tests](https://github.com/yetanotherchris/s3-photobrowser/workflows/Tests/badge.svg)
```

## Troubleshooting

### Docker Compose workflow fails

1. **Check logs in workflow output** - Expand "View application logs" step
2. **LocalStack not ready** - Increase timeout in "Wait for LocalStack" step
3. **Build fails** - Check Dockerfile and dependencies
4. **Health check fails** - Verify S3 connection and configuration

### Test workflow fails

1. **LocalStack service issues** - Check service health configuration
2. **Test timeouts** - Increase Jest timeout in test files
3. **Dependency issues** - Clear npm cache and reinstall

### Common issues

**Issue: "Port already in use"**
```bash
# Find and kill process using port
lsof -ti:4566 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

**Issue: "Docker disk space"**
```bash
# Clean up Docker resources
docker system prune -a --volumes -f
```

**Issue: "LocalStack connection refused"**
```bash
# Check LocalStack is running
docker ps | grep localstack

# Check LocalStack health
curl http://localhost:4566/_localstack/health

# View LocalStack logs
docker logs localstack
```

## Best Practices

1. **Keep workflows fast** - Use caching for dependencies
2. **Fail fast** - Run quick tests before slow ones
3. **Collect artifacts** - Save logs and reports for debugging
4. **Clean up resources** - Always use `if: always()` for cleanup steps
5. **Test locally first** - Run workflows locally before pushing

## Workflow Optimization

### Caching

The workflows use GitHub Actions caching for:
- npm dependencies (`actions/setup-node@v4` with `cache: 'npm'`)
- Docker layers (Docker Buildx)

### Parallelization

Tests run in parallel jobs:
- Unit tests
- Integration tests
- Linting
- Build verification

### Conditional execution

- `if: always()` - Runs even if previous steps fail (for cleanup)
- `needs: [job1, job2]` - Defines job dependencies
- `continue-on-error: true` - Allows workflow to continue on non-critical failures

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose in CI](https://docs.docker.com/compose/ci/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
