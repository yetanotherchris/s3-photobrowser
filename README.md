# S3 Photo Browser

![Docker Compose Tests](https://github.com/yetanotherchris/s3-photobrowser/workflows/Docker%20Compose%20Integration%20Test/badge.svg)
![Tests](https://github.com/yetanotherchris/s3-photobrowser/workflows/Tests/badge.svg)

A Google Photos-style web application for browsing, viewing, and managing photos and videos stored in S3-compatible storage.

## Features

- **Google Photos-like UI** with infinite scrolling and date grouping
- **Multi-provider S3 support** - Works with AWS S3, Backblaze B2, Wasabi, Cloudflare R2, DigitalOcean Spaces, OVH, MinIO, and any S3-compatible storage
- **Smart caching** with LRU eviction for fast browsing
- **Photo & video support** with automatic thumbnail generation
- **EXIF data extraction** for photos
- **Responsive design** with Tailwind CSS
- **Docker-first deployment** for easy setup
- **TypeScript** for type safety

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Storage**: S3-compatible object storage
- **Database**: SQLite for metadata
- **Image Processing**: Sharp
- **Video Processing**: FFmpeg
- **Containerization**: Docker

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd s3-photobrowser
   ```

2. **Configure S3 credentials**

   Copy the example environment file and edit it:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your S3 credentials:
   ```env
   S3_ACCESS_KEY=your_access_key_here
   S3_SECRET_KEY=your_secret_key_here
   S3_ENDPOINT=https://s3.amazonaws.com
   S3_BUCKET_NAME=your_bucket_name
   S3_REGION=us-east-1
   ```

3. **Launch with Docker Compose**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**

   Open your browser to http://localhost:3000

## Development Mode

For local development without Docker:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create and configure `.env` file**
   ```bash
   cp .env.example .env
   # Edit .env with your S3 credentials
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend API server on http://localhost:3001
   - Frontend dev server on http://localhost:3000 (with proxy to backend)

## S3 Provider Setup

### AWS S3

```env
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET_NAME=my-photos
S3_REGION=us-east-1
```

### Backblaze B2

```env
S3_ACCESS_KEY=your_application_key_id
S3_SECRET_KEY=your_application_key
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_BUCKET_NAME=my-photos
S3_REGION=us-west-004
```

### Cloudflare R2

```env
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_BUCKET_NAME=my-photos
S3_REGION=auto
```

### Wasabi

```env
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT=https://s3.us-east-1.wasabisys.com
S3_BUCKET_NAME=my-photos
S3_REGION=us-east-1
```

### DigitalOcean Spaces

```env
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_BUCKET_NAME=my-photos
S3_REGION=nyc3
```

### MinIO (Self-hosted)

```env
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_ENDPOINT=http://localhost:9000
S3_BUCKET_NAME=my-photos
S3_REGION=us-east-1
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_ACCESS_KEY` | - | S3 access key (required) |
| `S3_SECRET_KEY` | - | S3 secret key (required) |
| `S3_ENDPOINT` | - | S3 endpoint URL (required) |
| `S3_BUCKET_NAME` | - | S3 bucket name (required) |
| `S3_REGION` | `us-east-1` | S3 region (optional for some providers) |
| `CACHE_DIR` | `/app/cache` | Directory for cached files |
| `CACHE_SIZE_LIMIT` | `10GB` | Maximum cache size |
| `PRELOAD_COUNT` | `100` | Number of thumbnails to preload on startup |
| `PORT` | `3001` | Server port (backend) |
| `NODE_ENV` | `development` | Environment mode |
| `ENABLE_VIDEO_SUPPORT` | `true` | Enable video processing |
| `MAX_UPLOAD_SIZE` | `100MB` | Maximum file size for uploads |

## API Endpoints

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

## Project Structure

```
s3-photobrowser/
├── server/                 # Backend code
│   ├── index.ts           # Main server file
│   ├── config.ts          # Configuration
│   └── services/          # Service modules
│       ├── s3Client.ts    # S3 client wrapper
│       ├── database.ts    # SQLite database
│       ├── photoIndexer.ts # Photo indexing
│       ├── cacheManager.ts # Cache management
│       ├── imageProcessor.ts # Image processing
│       └── videoProcessor.ts # Video processing
├── src/                   # Frontend code
│   ├── components/        # React components
│   │   ├── PhotoGallery.tsx
│   │   ├── PhotoCard.tsx
│   │   ├── DateGroup.tsx
│   │   ├── DateNavigator.tsx
│   │   └── PhotoViewer.tsx
│   ├── types.ts          # TypeScript types
│   ├── api.ts            # API client
│   ├── utils.ts          # Utility functions
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config (frontend)
├── tsconfig.server.json  # TypeScript config (backend)
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind configuration
```

## Building for Production

### Docker Build

```bash
docker build -t s3-photobrowser .
docker run -p 3000:3000 --env-file .env s3-photobrowser
```

### Manual Build

```bash
# Install dependencies
npm install

# Build
npm run build

# Start production server
npm start
```

The built files will be in:
- `dist/client/` - Frontend static files
- `dist/` - Backend compiled JavaScript

## Supported File Formats

### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- HEIC (.heic)

### Videos
- MP4 (.mp4)
- MOV (.mov)
- AVI (.avi)
- MKV (.mkv)
- WebM (.webm)

## Troubleshooting

### S3 Connection Issues

If you're having trouble connecting to S3:

1. Verify your credentials are correct
2. Check that the endpoint URL is correct for your provider
3. Ensure your bucket exists and is accessible
4. Check firewall/network settings
5. Review logs: `docker-compose logs -f`

### Cache Issues

If thumbnails aren't loading:

1. Check cache directory permissions
2. Clear cache: `POST /api/cache/clear`
3. Re-index photos: Click "Refresh" button in UI

### Video Thumbnails Not Generating

Ensure FFmpeg is installed:
- Docker: FFmpeg is included automatically
- Local: Install FFmpeg (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Ubuntu)

## Testing

The application includes comprehensive unit and integration tests using Jest and LocalStack.

### Running Tests

**Prerequisites:**
- Docker and Docker Compose (for integration tests)

**Quick Start:**

```bash
# Automated setup (recommended)
./scripts/test-setup.sh

# Run all tests
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

For detailed testing documentation, see [test/README.md](test/README.md).

## Performance Tips

1. **Increase preload count** for faster initial load on fast connections
2. **Adjust cache size** based on available disk space
3. **Use CDN or reverse proxy** for better performance in production
4. **Enable compression** in your reverse proxy (nginx, Caddy, etc.)

## Security Considerations

- Never expose your S3 credentials to the frontend
- Use environment variables for sensitive configuration
- Implement authentication/authorization if exposing publicly
- Use HTTPS in production
- Keep dependencies updated

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please open a GitHub issue
