#!/bin/bash

# S3 Photo Browser - E2E Test Runner with LocalStack
# This script sets up LocalStack and runs Playwright E2E tests in headless mode

set -e

echo "🎭 S3 Photo Browser E2E Test Suite (Playwright)"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    echo "Please install Docker to run LocalStack tests"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not available${NC}"
    echo "Please install Docker Compose plugin"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    exit 1
fi

echo "✓ Docker is available"
echo "✓ Docker Compose is available"
echo "✓ Node.js is available"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    docker compose -f docker-compose.test.yml down -v > /dev/null 2>&1 || true
    echo "✓ Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Start LocalStack
echo "🚀 Starting LocalStack..."
docker compose -f docker-compose.test.yml up -d localstack

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ LocalStack is ready${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ LocalStack failed to start after ${MAX_ATTEMPTS} attempts${NC}"
        docker compose -f docker-compose.test.yml logs localstack
        exit 1
    fi
    sleep 1
    echo -n "."
done

echo ""

# Generate test photos
echo "📸 Generating test CV photos..."
npm run test:generate-photos

# Setup LocalStack S3
echo "☁️  Setting up S3 bucket and uploading photos..."
npm run test:setup

# Run Playwright E2E tests in headless mode
echo ""
echo "🎭 Running Playwright E2E tests (headless mode)..."
echo ""
npm run test:e2e

# Check test result
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All E2E tests passed!${NC}"
else
    echo -e "${RED}❌ Some E2E tests failed${NC}"
    exit $TEST_EXIT_CODE
fi
