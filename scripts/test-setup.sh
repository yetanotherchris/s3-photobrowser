#!/bin/bash

set -e

echo "================================"
echo "S3 Photo Browser - Test Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker is installed"

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✓ Docker Compose is available"

# Create necessary directories
echo ""
echo "Creating test directories..."
mkdir -p test/localstack-init
mkdir -p test/test-data
mkdir -p test-cache

echo "✓ Test directories created"

# Check if .env.test exists
if [ ! -f .env.test ]; then
    echo "❌ .env.test not found. Creating from template..."
    cp .env.example .env.test
    sed -i 's/S3_ENDPOINT=.*/S3_ENDPOINT=http:\/\/localhost:4566/' .env.test
    sed -i 's/S3_ACCESS_KEY=.*/S3_ACCESS_KEY=test/' .env.test
    sed -i 's/S3_SECRET_KEY=.*/S3_SECRET_KEY=test/' .env.test
    sed -i 's/S3_BUCKET_NAME=.*/S3_BUCKET_NAME=test-photos/' .env.test
    sed -i 's/CACHE_DIR=.*/CACHE_DIR=.\/test-cache/' .env.test
    echo "✓ .env.test created"
else
    echo "✓ .env.test already exists"
fi

# Start LocalStack
echo ""
echo "Starting LocalStack..."
$COMPOSE_CMD -f docker-compose.localstack.yml up -d localstack

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; then
        echo "✓ LocalStack is ready!"
        break
    fi

    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ LocalStack failed to start within 30 seconds"
        exit 1
    fi

    echo "  Waiting... ($attempt/$max_attempts)"
    sleep 1
done

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing npm dependencies..."
    npm install
fi

echo ""
echo "================================"
echo "✓ Test environment is ready!"
echo "================================"
echo ""
echo "You can now run tests with:"
echo "  npm test              # Run all tests"
echo "  npm run test:unit     # Run unit tests only"
echo "  npm run test:integration  # Run integration tests"
echo "  npm run test:watch    # Run tests in watch mode"
echo "  npm run test:coverage # Run tests with coverage"
echo ""
echo "To stop LocalStack:"
echo "  $COMPOSE_CMD -f docker-compose.localstack.yml down"
echo ""
