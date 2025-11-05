import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config.js';

export interface PhotoMetadata {
  id: string;
  filename: string;
  path: string;
  s3Key: string;
  size: number;
  mimeType: string;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
  modifiedAt: string;
  exifData?: string; // JSON string
  cached: boolean;
}

export interface DateCount {
  date: string;
  count: number;
}

class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(config.cache.dir, 'photos.db');
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        s3Key TEXT UNIQUE NOT NULL,
        size INTEGER NOT NULL,
        mimeType TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('photo', 'video')),
        width INTEGER,
        height INTEGER,
        duration REAL,
        createdAt TEXT NOT NULL,
        modifiedAt TEXT NOT NULL,
        exifData TEXT,
        cached INTEGER DEFAULT 0,
        UNIQUE(s3Key)
      );

      CREATE INDEX IF NOT EXISTS idx_createdAt ON photos(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_type ON photos(type);
      CREATE INDEX IF NOT EXISTS idx_cached ON photos(cached);
      CREATE INDEX IF NOT EXISTS idx_s3Key ON photos(s3Key);
    `);
  }

  /**
   * Insert or update photo metadata
   */
  upsertPhoto(photo: PhotoMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO photos (
        id, filename, path, s3Key, size, mimeType, type,
        width, height, duration, createdAt, modifiedAt, exifData, cached
      ) VALUES (
        @id, @filename, @path, @s3Key, @size, @mimeType, @type,
        @width, @height, @duration, @createdAt, @modifiedAt, @exifData, @cached
      )
      ON CONFLICT(s3Key) DO UPDATE SET
        filename = @filename,
        path = @path,
        size = @size,
        mimeType = @mimeType,
        type = @type,
        width = @width,
        height = @height,
        duration = @duration,
        modifiedAt = @modifiedAt,
        exifData = @exifData,
        cached = @cached
    `);

    stmt.run({
      ...photo,
      cached: photo.cached ? 1 : 0,
    });
  }

  /**
   * Get photo by ID
   */
  getPhotoById(id: string): PhotoMetadata | undefined {
    const stmt = this.db.prepare('SELECT * FROM photos WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return undefined;

    return this.rowToPhoto(row);
  }

  /**
   * Get photo by S3 key
   */
  getPhotoByS3Key(s3Key: string): PhotoMetadata | undefined {
    const stmt = this.db.prepare('SELECT * FROM photos WHERE s3Key = ?');
    const row = stmt.get(s3Key) as any;

    if (!row) return undefined;

    return this.rowToPhoto(row);
  }

  /**
   * Get photos with pagination and filters
   */
  getPhotos(params: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    sortBy?: 'date' | 'name';
    sortOrder?: 'asc' | 'desc';
    type?: 'photo' | 'video';
  }): PhotoMetadata[] {
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc',
      type,
    } = params;

    let query = 'SELECT * FROM photos WHERE 1=1';
    const queryParams: any[] = [];

    if (startDate) {
      query += ' AND createdAt >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ' AND createdAt <= ?';
      queryParams.push(endDate);
    }

    if (type) {
      query += ' AND type = ?';
      queryParams.push(type);
    }

    const orderColumn = sortBy === 'date' ? 'createdAt' : 'filename';
    query += ` ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}`;
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as any[];

    return rows.map((row) => this.rowToPhoto(row));
  }

  /**
   * Get total photo count
   */
  getTotalCount(params?: { type?: 'photo' | 'video' }): number {
    let query = 'SELECT COUNT(*) as count FROM photos';
    const queryParams: any[] = [];

    if (params?.type) {
      query += ' WHERE type = ?';
      queryParams.push(params.type);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...queryParams) as any;
    return result.count;
  }

  /**
   * Get dates with photo counts
   */
  getDateCounts(): DateCount[] {
    const stmt = this.db.prepare(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM photos
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `);

    return stmt.all() as DateCount[];
  }

  /**
   * Mark photo as cached
   */
  markAsCached(id: string): void {
    const stmt = this.db.prepare('UPDATE photos SET cached = 1 WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Mark photo as uncached
   */
  markAsUncached(id: string): void {
    const stmt = this.db.prepare('UPDATE photos SET cached = 0 WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete photo
   */
  deletePhoto(id: string): void {
    const stmt = this.db.prepare('DELETE FROM photos WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Clear all photos
   */
  clearAll(): void {
    this.db.exec('DELETE FROM photos');
  }

  /**
   * Get uncached photos (for preloading)
   */
  getUncachedPhotos(limit: number): PhotoMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM photos
      WHERE cached = 0
      ORDER BY createdAt DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map((row) => this.rowToPhoto(row));
  }

  /**
   * Get all photos (for checking indexed status)
   * Returns only id and s3Key for performance
   */
  getAllPhotos(): Array<{ id: string; s3Key: string }> {
    const stmt = this.db.prepare('SELECT id, s3Key FROM photos');
    return stmt.all() as Array<{ id: string; s3Key: string }>;
  }

  /**
   * Convert database row to PhotoMetadata
   */
  private rowToPhoto(row: any): PhotoMetadata {
    return {
      ...row,
      cached: row.cached === 1,
      exifData: row.exifData ? JSON.parse(row.exifData) : undefined,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export const database = new DatabaseService();
