import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';
import NodeCache from 'node-cache';

export type CacheSize = 'thumbnail' | 'preview' | 'original';

interface CacheStats {
  totalSize: number;
  itemCount: number;
  limit: number;
  hitRate: number;
}

interface CacheEntry {
  path: string;
  size: number;
  accessTime: number;
}

class CacheManagerService {
  private cacheDir: string;
  private thumbnailDir: string;
  private previewDir: string;
  private originalDir: string;
  private sizeLimit: number;
  private currentSize: number = 0;
  private cacheMap: Map<string, CacheEntry> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private memoryCache: NodeCache;

  constructor() {
    this.cacheDir = config.cache.dir;
    this.thumbnailDir = path.join(this.cacheDir, 'thumbnails');
    this.previewDir = path.join(this.cacheDir, 'previews');
    this.originalDir = path.join(this.cacheDir, 'originals');
    this.sizeLimit = this.parseSizeLimit(config.cache.sizeLimit);
    this.memoryCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

    this.initializeCache();
  }

  /**
   * Initialize cache directories
   */
  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.thumbnailDir, { recursive: true });
      await fs.mkdir(this.previewDir, { recursive: true });
      await fs.mkdir(this.originalDir, { recursive: true });
      console.log('Cache directories initialized');
      await this.calculateCurrentSize();
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  /**
   * Parse size limit string (e.g., "10GB") to bytes
   */
  private parseSizeLimit(sizeStr: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) {
      console.warn(`Invalid size format: ${sizeStr}, using default 10GB`);
      return 10 * 1024 ** 3;
    }

    const [, value, unit] = match;
    const multiplier = units[unit.toUpperCase()] || 1;
    return parseFloat(value) * multiplier;
  }

  /**
   * Calculate current cache size
   */
  private async calculateCurrentSize(): Promise<void> {
    this.currentSize = 0;
    this.cacheMap.clear();

    const dirs = [this.thumbnailDir, this.previewDir, this.originalDir];

    for (const dir of dirs) {
      try {
        const files = await this.getAllFiles(dir);
        for (const file of files) {
          const stats = await fs.stat(file);
          this.currentSize += stats.size;
          this.cacheMap.set(file, {
            path: file,
            size: stats.size,
            accessTime: stats.atimeMs,
          });
        }
      } catch (error) {
        console.error(`Error calculating size for ${dir}:`, error);
      }
    }

    console.log(`Current cache size: ${this.formatSize(this.currentSize)}`);
  }

  /**
   * Get all files recursively
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await this.getAllFiles(fullPath)));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }

    return files;
  }

  /**
   * Get hash of S3 key for organizing cache
   */
  private getHash(s3Key: string): string {
    return crypto.createHash('md5').update(s3Key).digest('hex').substring(0, 8);
  }

  /**
   * Get cache path for a file
   */
  getCachePath(s3Key: string, size: CacheSize): string {
    const hash = this.getHash(s3Key);
    const filename = path.basename(s3Key);
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);

    let dir: string;
    let suffix: string;

    switch (size) {
      case 'thumbnail':
        dir = this.thumbnailDir;
        suffix = '_thumb';
        break;
      case 'preview':
        dir = this.previewDir;
        suffix = '_preview';
        break;
      case 'original':
        dir = this.originalDir;
        suffix = '';
        break;
    }

    const cacheFilename = `${name}${suffix}${ext}`;
    return path.join(dir, hash, cacheFilename);
  }

  /**
   * Check if file is cached
   */
  async isCached(s3Key: string, size: CacheSize): Promise<boolean> {
    const cachePath = this.getCachePath(s3Key, size);

    try {
      await fs.access(cachePath);
      this.hits++;
      return true;
    } catch {
      this.misses++;
      return false;
    }
  }

  /**
   * Get cached file
   */
  async getCachedFile(s3Key: string, size: CacheSize): Promise<Buffer | null> {
    const cachePath = this.getCachePath(s3Key, size);

    try {
      // Update access time
      const entry = this.cacheMap.get(cachePath);
      if (entry) {
        entry.accessTime = Date.now();
      }

      this.hits++;
      return await fs.readFile(cachePath);
    } catch {
      this.misses++;
      return null;
    }
  }

  /**
   * Save file to cache
   */
  async saveToCac(s3Key: string, size: CacheSize, data: Buffer): Promise<string> {
    const cachePath = this.getCachePath(s3Key, size);
    const dir = path.dirname(cachePath);

    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(cachePath, data);

    // Update cache metadata
    const fileSize = data.length;
    this.currentSize += fileSize;
    this.cacheMap.set(cachePath, {
      path: cachePath,
      size: fileSize,
      accessTime: Date.now(),
    });

    // Evict if needed
    await this.evictIfNeeded();

    return cachePath;
  }

  /**
   * Evict least recently used files if cache is over limit
   */
  private async evictIfNeeded(): Promise<void> {
    if (this.currentSize <= this.sizeLimit) {
      return;
    }

    console.log('Cache limit exceeded, starting eviction...');

    // Sort by access time (LRU)
    const entries = Array.from(this.cacheMap.values()).sort(
      (a, b) => a.accessTime - b.accessTime
    );

    for (const entry of entries) {
      if (this.currentSize <= this.sizeLimit * 0.8) {
        // Evict until we're at 80% capacity
        break;
      }

      try {
        await fs.unlink(entry.path);
        this.currentSize -= entry.size;
        this.cacheMap.delete(entry.path);
        console.log(`Evicted: ${entry.path}`);
      } catch (error) {
        console.error(`Failed to evict ${entry.path}:`, error);
      }
    }

    console.log(`Eviction complete. New size: ${this.formatSize(this.currentSize)}`);
  }

  /**
   * Clear entire cache
   */
  async clearCache(): Promise<void> {
    const dirs = [this.thumbnailDir, this.previewDir, this.originalDir];

    for (const dir of dirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to clear ${dir}:`, error);
      }
    }

    this.currentSize = 0;
    this.cacheMap.clear();
    this.memoryCache.flushAll();
    console.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      totalSize: this.currentSize,
      itemCount: this.cacheMap.size,
      limit: this.sizeLimit,
      hitRate,
    };
  }

  /**
   * Format size for display
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Check if cache directory is writable
   */
  async isWritable(): Promise<boolean> {
    try {
      const testFile = path.join(this.cacheDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }
}

export const cacheManager = new CacheManagerService();
