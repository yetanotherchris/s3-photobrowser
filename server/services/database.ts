import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

export interface ExifData {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLength?: number;
  aperture?: number;
  iso?: number;
  shutterSpeed?: string;
  exposureTime?: number;
  latitude?: number;
  longitude?: number;
}

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
  exif?: ExifData;
  cached: boolean;
}

export interface DateCount {
  date: string;
  count: number;
}

class DatabaseService {
  private db: Database.Database;

  constructor() {
    // Ensure the cache directory exists before creating the database
    if (!fs.existsSync(config.cache.dir)) {
      fs.mkdirSync(config.cache.dir, { recursive: true });
    }

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
        cameraMake TEXT,
        cameraModel TEXT,
        lensModel TEXT,
        focalLength REAL,
        aperture REAL,
        iso INTEGER,
        shutterSpeed TEXT,
        exposureTime REAL,
        latitude REAL,
        longitude REAL,
        cached INTEGER DEFAULT 0,
        UNIQUE(s3Key)
      );

      CREATE INDEX IF NOT EXISTS idx_createdAt ON photos(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_type ON photos(type);
      CREATE INDEX IF NOT EXISTS idx_cached ON photos(cached);
      CREATE INDEX IF NOT EXISTS idx_s3Key ON photos(s3Key);
      CREATE INDEX IF NOT EXISTS idx_cameraMake ON photos(cameraMake);
      CREATE INDEX IF NOT EXISTS idx_cameraModel ON photos(cameraModel);
      CREATE INDEX IF NOT EXISTS idx_iso ON photos(iso);
    `);

    // Migrate from old exifData JSON column if it exists
    this.migrateExifData();
  }

  /**
   * Migrate old exifData JSON column to new schema
   */
  private migrateExifData(): void {
    try {
      // Check if old exifData column exists
      const columns = this.db.pragma('table_info(photos)') as Array<{ name: string }>;
      const hasExifData = columns.some((col) => col.name === 'exifData');

      if (!hasExifData) return;

      console.log('Migrating EXIF data from JSON to columns...');

      // Get all photos with exifData
      const stmt = this.db.prepare('SELECT id, s3Key, exifData FROM photos WHERE exifData IS NOT NULL');
      const rows = stmt.all() as Array<{ id: string; s3Key: string; exifData: string }>;

      let migratedCount = 0;
      for (const row of rows) {
        try {
          const exifData = JSON.parse(row.exifData);

          // Parse camera from "Make Model" format
          let cameraMake = exifData.camera?.split(' ')[0];
          let cameraModel = exifData.camera?.substring(cameraMake?.length || 0).trim();

          this.db.prepare(`
            UPDATE photos SET
              cameraMake = ?,
              cameraModel = ?,
              lensModel = ?,
              focalLength = ?,
              aperture = ?,
              iso = ?,
              shutterSpeed = ?,
              latitude = ?,
              longitude = ?
            WHERE s3Key = ?
          `).run(
            cameraMake || null,
            cameraModel || null,
            exifData.lens || null,
            exifData.focalLength || null,
            exifData.aperture || null,
            exifData.iso || null,
            exifData.shutterSpeed || null,
            exifData.location?.latitude || null,
            exifData.location?.longitude || null,
            row.s3Key
          );

          migratedCount++;
        } catch (error) {
          console.warn(`Failed to migrate EXIF for ${row.s3Key}:`, error);
        }
      }

      if (migratedCount > 0) {
        console.log(`Migrated ${migratedCount} photos from JSON to column-based EXIF`);
      }

      // Drop the old exifData column
      this.db.exec(`
        CREATE TABLE photos_new AS SELECT
          id, filename, path, s3Key, size, mimeType, type,
          width, height, duration, createdAt, modifiedAt,
          cameraMake, cameraModel, lensModel, focalLength, aperture, iso,
          shutterSpeed, exposureTime, latitude, longitude, cached
        FROM photos;

        DROP TABLE photos;
        ALTER TABLE photos_new RENAME TO photos;

        CREATE INDEX idx_createdAt ON photos(createdAt DESC);
        CREATE INDEX idx_type ON photos(type);
        CREATE INDEX idx_cached ON photos(cached);
        CREATE INDEX idx_s3Key ON photos(s3Key);
        CREATE INDEX idx_cameraMake ON photos(cameraMake);
        CREATE INDEX idx_cameraModel ON photos(cameraModel);
        CREATE INDEX idx_iso ON photos(iso);
      `);

      console.log('Migration complete, old exifData column dropped');
    } catch (error) {
      console.warn('EXIF migration failed:', error);
    }
  }

  /**
   * Insert or update photo metadata
   */
  upsertPhoto(photo: PhotoMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO photos (
        id, filename, path, s3Key, size, mimeType, type,
        width, height, duration, createdAt, modifiedAt,
        cameraMake, cameraModel, lensModel, focalLength, aperture, iso,
        shutterSpeed, exposureTime, latitude, longitude, cached
      ) VALUES (
        @id, @filename, @path, @s3Key, @size, @mimeType, @type,
        @width, @height, @duration, @createdAt, @modifiedAt,
        @cameraMake, @cameraModel, @lensModel, @focalLength, @aperture, @iso,
        @shutterSpeed, @exposureTime, @latitude, @longitude, @cached
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
        cameraMake = @cameraMake,
        cameraModel = @cameraModel,
        lensModel = @lensModel,
        focalLength = @focalLength,
        aperture = @aperture,
        iso = @iso,
        shutterSpeed = @shutterSpeed,
        exposureTime = @exposureTime,
        latitude = @latitude,
        longitude = @longitude,
        cached = @cached
    `);

    stmt.run({
      id: photo.id,
      filename: photo.filename,
      path: photo.path,
      s3Key: photo.s3Key,
      size: photo.size,
      mimeType: photo.mimeType,
      type: photo.type,
      width: photo.width || null,
      height: photo.height || null,
      duration: photo.duration || null,
      createdAt: photo.createdAt,
      modifiedAt: photo.modifiedAt,
      cameraMake: photo.exif?.cameraMake || null,
      cameraModel: photo.exif?.cameraModel || null,
      lensModel: photo.exif?.lensModel || null,
      focalLength: photo.exif?.focalLength || null,
      aperture: photo.exif?.aperture || null,
      iso: photo.exif?.iso || null,
      shutterSpeed: photo.exif?.shutterSpeed || null,
      exposureTime: photo.exif?.exposureTime || null,
      latitude: photo.exif?.latitude || null,
      longitude: photo.exif?.longitude || null,
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
   * Update photo with EXIF data and refined date
   * Called when photo is downloaded and EXIF is extracted
   */
  updatePhotoExif(
    s3Key: string,
    data: {
      exif?: ExifData;
      createdAt?: string;
      width?: number;
      height?: number;
    }
  ): void {
    const updates: string[] = [];
    const params: any = {};

    if (data.exif !== undefined) {
      if (data.exif.cameraMake !== undefined) {
        updates.push('cameraMake = @cameraMake');
        params.cameraMake = data.exif.cameraMake;
      }
      if (data.exif.cameraModel !== undefined) {
        updates.push('cameraModel = @cameraModel');
        params.cameraModel = data.exif.cameraModel;
      }
      if (data.exif.lensModel !== undefined) {
        updates.push('lensModel = @lensModel');
        params.lensModel = data.exif.lensModel;
      }
      if (data.exif.focalLength !== undefined) {
        updates.push('focalLength = @focalLength');
        params.focalLength = data.exif.focalLength;
      }
      if (data.exif.aperture !== undefined) {
        updates.push('aperture = @aperture');
        params.aperture = data.exif.aperture;
      }
      if (data.exif.iso !== undefined) {
        updates.push('iso = @iso');
        params.iso = data.exif.iso;
      }
      if (data.exif.shutterSpeed !== undefined) {
        updates.push('shutterSpeed = @shutterSpeed');
        params.shutterSpeed = data.exif.shutterSpeed;
      }
      if (data.exif.exposureTime !== undefined) {
        updates.push('exposureTime = @exposureTime');
        params.exposureTime = data.exif.exposureTime;
      }
      if (data.exif.latitude !== undefined) {
        updates.push('latitude = @latitude');
        params.latitude = data.exif.latitude;
      }
      if (data.exif.longitude !== undefined) {
        updates.push('longitude = @longitude');
        params.longitude = data.exif.longitude;
      }
    }

    if (data.createdAt !== undefined) {
      updates.push('createdAt = @createdAt');
      params.createdAt = data.createdAt;
    }

    if (data.width !== undefined) {
      updates.push('width = @width');
      params.width = data.width;
    }

    if (data.height !== undefined) {
      updates.push('height = @height');
      params.height = data.height;
    }

    if (updates.length === 0) return;

    params.s3Key = s3Key;

    const query = `UPDATE photos SET ${updates.join(', ')} WHERE s3Key = @s3Key`;
    const stmt = this.db.prepare(query);
    stmt.run(params);
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
    const exif: ExifData | undefined =
      row.cameraMake || row.cameraModel || row.lensModel || row.focalLength ||
      row.aperture || row.iso || row.shutterSpeed || row.latitude || row.longitude
        ? {
            cameraMake: row.cameraMake || undefined,
            cameraModel: row.cameraModel || undefined,
            lensModel: row.lensModel || undefined,
            focalLength: row.focalLength || undefined,
            aperture: row.aperture || undefined,
            iso: row.iso || undefined,
            shutterSpeed: row.shutterSpeed || undefined,
            exposureTime: row.exposureTime || undefined,
            latitude: row.latitude || undefined,
            longitude: row.longitude || undefined,
          }
        : undefined;

    return {
      id: row.id,
      filename: row.filename,
      path: row.path,
      s3Key: row.s3Key,
      size: row.size,
      mimeType: row.mimeType,
      type: row.type,
      width: row.width || undefined,
      height: row.height || undefined,
      duration: row.duration || undefined,
      createdAt: row.createdAt,
      modifiedAt: row.modifiedAt,
      exif,
      cached: row.cached === 1,
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
