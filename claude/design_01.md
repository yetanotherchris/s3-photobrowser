# Photo Browsing Application - Design Specification

> **Document Type**: Architecture Decision Record (ADR) / High-Level Design Specification  
> **Optimized for**: LLM-based code generation (Claude Code, etc.)  
> **Tech Stack**: React 18+ with TypeScript/JSX, Tailwind CSS, Vite, Express, Docker

## 1. Project Overview

A Google Photos/Apple Photos-style web application for browsing, viewing, and managing photos and videos stored in S3-compatible storage. The application provides an intuitive, responsive interface with infinite scrolling, photo grouping by date, and basic photo management capabilities.

**Key Design Principles:**
- Seamless compatibility with multiple S3 providers
- Google Photos-like UX with infinite scrolling and date grouping
- Efficient caching and preloading for fast browsing
- Support for both photos and videos
- Docker-first deployment
- Type-safe implementation with TypeScript

## 2. Technology Stack

### Frontend
- **Framework**: React 18+ with JSX
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Language**: TypeScript (.tsx for components, .ts for utilities)

### Backend/API
- **Runtime**: Node.js with Express
- **Language**: TypeScript (.ts for server files)
- **S3 SDK**: AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`)
- **Image Processing**: Sharp (thumbnails), FFmpeg (video thumbnails)

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Storage**: S3-compatible object storage (AWS S3, Backblaze, Wasabi, Cloudflare R2, OVH, DigitalOcean Spaces, MinIO)
- **Cache**: Local filesystem cache with LRU eviction
- **Database**: SQLite for photo metadata (lightweight, embedded)

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   Photo    │  │   Infinite   │  │   Date/Year      │    │
│  │   Grid     │  │   Scroll     │  │   Navigator      │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend API Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Photo      │  │   Cache      │  │   S3 Client      │  │
│  │   Service    │  │   Manager    │  │   Service        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │   Local File Cache   │    │   S3 Bucket Storage      │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 4. Environment Configuration

### Required Environment Variables

The application must support any S3-compatible storage provider through standard S3 API credentials. Tested and compatible with:
- **AWS S3**
- **Backblaze B2** (S3-compatible API)
- **Wasabi**
- **Cloudflare R2**
- **OVH Object Storage**
- **DigitalOcean Spaces**
- **MinIO** (self-hosted)
- Any other S3-compatible storage

```env
# S3 Configuration (Required)
S3_ACCESS_KEY=your_access_key_here
S3_SECRET_KEY=your_secret_key_here
S3_ENDPOINT=https://s3.amazonaws.com (or provider-specific endpoint)
S3_BUCKET_NAME=your_bucket_name
S3_REGION=us-east-1 (optional, some providers don't require this)

# Application Configuration
CACHE_DIR=/app/cache
CACHE_SIZE_LIMIT=10GB (optional, default: 10GB)
PRELOAD_COUNT=100 (optional, number of photos to preload on startup)
PORT=3000

# Optional Configuration
NODE_ENV=production
ENABLE_VIDEO_SUPPORT=true
MAX_UPLOAD_SIZE=100MB
```

**Provider-Specific Endpoint Examples:**
- AWS S3: `https://s3.amazonaws.com` or `https://s3.{region}.amazonaws.com`
- Backblaze B2: `https://s3.{region}.backblazeb2.com`
- Wasabi: `https://s3.{region}.wasabisys.com`
- Cloudflare R2: `https://{account-id}.r2.cloudflarestorage.com`
- DigitalOcean: `https://{region}.digitaloceanspaces.com`
- OVH: `https://s3.{region}.io.cloud.ovh.net`

## 5. Core Features

### 5.1 Photo Discovery & Indexing

**Requirements:**
- Recursively scan all subdirectories in the S3 bucket on startup
- Index photos and videos with metadata (file name, path, size, last modified, EXIF data if available)
- Support common image formats: JPEG, PNG, GIF, WebP, HEIC
- Support common video formats: MP4, MOV, AVI, MKV
- Extract creation date from EXIF data or use file modified date as fallback
- Store index in memory or lightweight database (SQLite recommended for persistence)

**Implementation Notes:**
- Use `ListObjectsV2` S3 API with pagination
- Parse EXIF data using `exif-parser` or `exifr` library
- Create database schema for photo metadata

### 5.2 Caching System

**Requirements:**
- Maintain local file cache directory for downloaded photos
- Generate and cache multiple sizes: thumbnail (200x200), preview (800x600), original
- Implement LRU (Least Recently Used) cache eviction when size limit reached
- Preload thumbnails for the most recent N photos on startup
- Cache videos differently: generate thumbnail poster frame only

**Cache Structure:**
```
/app/cache/
  ├── thumbnails/
  │   └── [hash]/[filename]_thumb.jpg
  ├── previews/
  │   └── [hash]/[filename]_preview.jpg
  ├── originals/
  │   └── [hash]/[filename]
  └── metadata.json
```

**Preloading Strategy:**
1. On startup, fetch metadata for all photos
2. Sort by creation date (newest first)
3. Download thumbnails for the first PRELOAD_COUNT photos
4. Continue background downloading of remaining thumbnails

### 5.3 User Interface

#### 5.3.1 Main Photo Grid

**Layout:**
- Responsive grid using Tailwind's grid system
- Photos grouped by day (like Google Photos)
- Date headers: "Today", "Yesterday", "December 1, 2024", etc.
- Variable height cards maintaining aspect ratio
- Lazy loading with intersection observer

**Component Structure:**
```jsx
<PhotoGallery>
  <DateNavigator />
  <InfiniteScroll>
    <DateGroup date="2024-12-01">
      <PhotoCard />
      <PhotoCard />
      ...
    </DateGroup>
    <DateGroup date="2024-11-30">
      ...
    </DateGroup>
  </InfiniteScroll>
</PhotoGallery>
```

#### 5.3.2 Infinite Scrolling

**Requirements:**
- Load photos in batches (e.g., 50 photos at a time)
- Trigger next batch when user scrolls to bottom
- Show loading skeleton while fetching
- Smooth scroll performance (virtualization if needed)

**Implementation:**
- Use Intersection Observer API or library like `react-infinite-scroll-component`
- Maintain scroll position on navigation back
- Debounce scroll events

#### 5.3.3 Date/Year Navigator

**Requirements:**
- Fixed sidebar or top bar with date ranges
- Show year and month markers
- Smooth scroll to date when clicked
- Highlight current visible date range
- Use Tailwind components (no custom scrollbar needed)

**Design:**
```
2024 ────────────────
  December
  November
  October
  ...
2023 ────────────────
  December
  ...
```

#### 5.3.4 Photo Viewer/Lightbox

**Requirements:**
- Click photo to open fullscreen view
- Display original resolution image
- Navigation: Previous/Next arrows, keyboard support
- Show metadata: filename, date, size, resolution
- Close button and ESC key support
- Smooth transitions and animations
- Video playback support with controls

**Features:**
- Zoom in/out functionality
- Download button
- Delete button (with confirmation)
- Share button (copy link)
- Keyboard shortcuts: ← → for navigation, ESC to close

### 5.4 Video Support

**Requirements:**
- Display video thumbnails in grid (poster frame)
- Play button overlay on thumbnails
- Full video player in lightbox view
- Support common video formats
- Stream videos from S3 (don't require full download)
- Video player controls: play/pause, seek, volume, fullscreen

**Implementation:**
- Generate thumbnail using ffmpeg in backend
- Use HTML5 video player or library like Video.js
- Implement range request support for streaming

## 6. API Design

### 6.1 API Endpoints

#### Photo & Video Management

```
GET /api/photos
  Query params:
    - limit: number of photos to return (default: 50)
    - offset: pagination offset
    - startDate: filter by date range
    - endDate: filter by date range
    - sortBy: 'date' | 'name' (default: 'date')
    - sortOrder: 'asc' | 'desc' (default: 'desc')
  Response: {
    photos: Array<PhotoMetadata>,
    total: number,
    hasMore: boolean
  }

GET /api/photos/:photoId
  Response: PhotoMetadata with full details

GET /api/photos/:photoId/download
  Query params:
    - size: 'thumbnail' | 'preview' | 'original' (default: 'original')
  Response: Binary image data or redirect to cached file

DELETE /api/photos/:photoId
  Response: { success: boolean, message: string }

POST /api/photos/refresh
  Description: Trigger re-scan of S3 bucket
  Response: { success: boolean, indexed: number }

GET /api/photos/dates
  Description: Get all unique dates with photo counts
  Response: {
    dates: Array<{ date: string, count: number }>
  }
```

#### Cache Management

```
GET /api/cache/stats
  Response: {
    totalSize: number,
    itemCount: number,
    limit: number,
    hitRate: number
  }

POST /api/cache/clear
  Response: { success: boolean }

GET /api/health
  Response: {
    status: 'ok' | 'error',
    s3Connected: boolean,
    cacheWritable: boolean
  }
```

### 6.2 Data Models

#### PhotoMetadata

```typescript
interface PhotoMetadata {
  id: string;
  filename: string;
  path: string;
  s3Key: string;
  size: number;
  mimeType: string;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
  duration?: number; // for videos
  createdAt: Date;
  modifiedAt: Date;
  exifData?: {
    camera?: string;
    lens?: string;
    focalLength?: number;
    aperture?: number;
    iso?: number;
    shutterSpeed?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  cached: boolean;
}
```

## 7. Docker Configuration

### 7.1 Dockerfile

```dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/server.js"]
```

### 7.2 docker-compose.yml

```yaml
version: '3.8'

services:
  photo-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - S3_REGION=${S3_REGION:-us-east-1}
      - CACHE_DIR=/app/cache
      - CACHE_SIZE_LIMIT=10GB
      - PRELOAD_COUNT=100
      - NODE_ENV=production
    volumes:
      - photo-cache:/app/cache
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  photo-cache:
    driver: local
```

### 7.3 .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
dist
cache
*.md
.vscode
.idea
```

## 8. Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Set up React + Vite + Tailwind + TypeScript project
- [ ] Configure Docker and docker-compose
- [ ] Implement S3 client connection with multi-provider support
- [ ] Create basic API server structure
- [ ] Implement environment variable configuration

### Phase 2: Photo Indexing & Caching
- [ ] Implement S3 bucket scanning (recursive subdirectory support)
- [ ] Extract and parse EXIF data
- [ ] Build caching system with multiple sizes (thumbnail, preview, original)
- [ ] Implement LRU cache eviction
- [ ] Create preloading mechanism

### Phase 3: UI - Basic Grid
- [ ] Build responsive photo grid with Tailwind
- [ ] Implement date grouping (like Google Photos)
- [ ] Add infinite scrolling
- [ ] Create loading skeletons
- [ ] Implement lazy loading for images

### Phase 4: UI - Navigation & Viewer
- [ ] Build date/year navigator sidebar
- [ ] Implement photo lightbox/viewer (modal)
- [ ] Add keyboard navigation (arrow keys, ESC)
- [ ] Implement zoom functionality
- [ ] Add metadata display

### Phase 5: Photo Management
- [ ] Implement download functionality
- [ ] Add delete with confirmation
- [ ] Create refresh/re-index feature
- [ ] Add cache management UI

### Phase 6: Video Support
- [ ] Implement video thumbnail generation (ffmpeg)
- [ ] Add video playback in viewer
- [ ] Implement video streaming
- [ ] Add video controls (play/pause, seek, volume, fullscreen)

### Phase 7: Polish & Optimization
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Loading states and animations
- [ ] Responsive design refinements
- [ ] Documentation

## 9. Technical Considerations

### 9.1 Performance Optimization
- Use React.memo for photo cards to prevent unnecessary re-renders
- Implement virtualization for large photo collections (react-window or react-virtuoso)
- Use Web Workers for image processing if needed
- Implement progressive image loading (blur-up technique)
- Optimize bundle size with code splitting

### 9.2 Security
- Validate S3 credentials on startup
- Implement rate limiting on API endpoints
- Sanitize file paths to prevent directory traversal
- Use secure headers (helmet.js)
- Implement CORS properly
- Don't expose S3 credentials to frontend
- **S3 Compatibility**: Use `forcePathStyle: true` in S3 client config for non-AWS providers

### 9.3 Error Handling
- Graceful degradation when S3 is unavailable
- Retry logic for failed S3 requests
- User-friendly error messages
- Logging for debugging
- Health check endpoint for monitoring

### 9.4 Testing Strategy
- Unit tests for utility functions
- Integration tests for API endpoints
- E2E tests for critical user flows (upload, view, delete)
- Performance testing for large photo collections (10,000+ photos)
- **S3 Compatibility Testing**: Verify functionality with multiple providers (AWS S3, Backblaze, Wasabi, Cloudflare R2)
- Test with various image formats and sizes
- Test video playback and streaming

## 10. Technology Recommendations

### Frontend Libraries
- Infinite scrolling: `react-infinite-scroll-component` or `react-virtuoso`
- Photo viewer/lightbox: `yet-another-react-lightbox` or `react-photo-view`
- Date handling: `date-fns`
- Image lazy loading: `react-intersection-observer`
- Animations (optional): `framer-motion`

### Backend Libraries
- S3 client: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- API server: `express`
- EXIF extraction: `exifr`
- Image processing: `sharp`
- Video processing: `fluent-ffmpeg`
- Database: `better-sqlite3` (for metadata persistence)
- Caching: `node-cache`
- Security: `helmet` and `cors`

### Development Tools
- Code quality: `eslint` and `prettier`
- Testing: `vitest` (unit), `playwright` (E2E)
- Process management: `concurrently`
- TypeScript: `typescript`, `tsx`, `@types/*` packages

## 11. Future Enhancements

- [ ] Search functionality (by filename, date, location)
- [ ] Facial recognition and tagging
- [ ] Albums and collections
- [ ] Favorites/starring
- [ ] Upload new photos
- [ ] Photo editing (crop, rotate, filters)
- [ ] Sharing via links
- [ ] Mobile app (React Native)
- [ ] Collaborative albums
- [ ] AI-powered auto-tagging
- [ ] RAW format support
- [ ] Photo comparison view
- [ ] Timeline/map view
- [ ] Duplicate detection

## 12. Success Metrics

- Page load time < 2 seconds
- Time to first photo < 1 second
- Smooth scrolling at 60fps
- Support for 10,000+ photos
- Cache hit rate > 80%
- Mobile responsive on all screen sizes

---

## Getting Started

This design specification is intended for implementation by LLM-based code generation tools (Claude Code, GitHub Copilot, etc.).

**Quick Start After Implementation:**

1. Configure S3 credentials in `.env`:
   ```env
   S3_ACCESS_KEY=your_access_key
   S3_SECRET_KEY=your_secret_key
   S3_ENDPOINT=https://your-s3-endpoint.com
   S3_BUCKET_NAME=your-bucket-name
   ```

2. Launch with Docker:
   ```bash
   docker-compose up --build
   ```

3. Access at `http://localhost:3000`

**Development Mode:**
```bash
npm install
npm run dev
# Backend runs on :3001, Frontend on :3000 with proxy
```

**S3 Provider Setup Examples:**

- **AWS S3**: Use IAM credentials and `https://s3.amazonaws.com`
- **Backblaze B2**: Use application key and `https://s3.{region}.backblazeb2.com`
- **Cloudflare R2**: Use API token and `https://{account-id}.r2.cloudflarestorage.com`
- **Wasabi**: Use access key and `https://s3.{region}.wasabisys.com`
