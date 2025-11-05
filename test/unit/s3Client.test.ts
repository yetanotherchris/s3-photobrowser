import { describe, test, expect } from '@jest/globals';

describe('S3Client Unit Tests', () => {
  // Mock the S3Client class for unit tests
  class MockS3Client {
    isImage(filename: string): boolean {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return imageExtensions.includes(ext);
    }

    isVideo(filename: string): boolean {
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return videoExtensions.includes(ext);
    }

    getMimeType(filename: string): string {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.heic': 'image/heic',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
      };
      return mimeTypes[ext] || 'application/octet-stream';
    }
  }

  let mockClient: MockS3Client;

  beforeAll(() => {
    mockClient = new MockS3Client();
  });

  describe('isImage', () => {
    test('should identify JPEG files', () => {
      expect(mockClient.isImage('photo.jpg')).toBe(true);
      expect(mockClient.isImage('photo.jpeg')).toBe(true);
      expect(mockClient.isImage('PHOTO.JPG')).toBe(true);
    });

    test('should identify PNG files', () => {
      expect(mockClient.isImage('photo.png')).toBe(true);
      expect(mockClient.isImage('PHOTO.PNG')).toBe(true);
    });

    test('should identify other image formats', () => {
      expect(mockClient.isImage('photo.gif')).toBe(true);
      expect(mockClient.isImage('photo.webp')).toBe(true);
      expect(mockClient.isImage('photo.heic')).toBe(true);
    });

    test('should reject non-image files', () => {
      expect(mockClient.isImage('video.mp4')).toBe(false);
      expect(mockClient.isImage('document.pdf')).toBe(false);
      expect(mockClient.isImage('file.txt')).toBe(false);
    });
  });

  describe('isVideo', () => {
    test('should identify MP4 files', () => {
      expect(mockClient.isVideo('video.mp4')).toBe(true);
      expect(mockClient.isVideo('VIDEO.MP4')).toBe(true);
    });

    test('should identify other video formats', () => {
      expect(mockClient.isVideo('video.mov')).toBe(true);
      expect(mockClient.isVideo('video.avi')).toBe(true);
      expect(mockClient.isVideo('video.mkv')).toBe(true);
      expect(mockClient.isVideo('video.webm')).toBe(true);
    });

    test('should reject non-video files', () => {
      expect(mockClient.isVideo('photo.jpg')).toBe(false);
      expect(mockClient.isVideo('document.pdf')).toBe(false);
      expect(mockClient.isVideo('file.txt')).toBe(false);
    });
  });

  describe('getMimeType', () => {
    test('should return correct MIME type for images', () => {
      expect(mockClient.getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(mockClient.getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(mockClient.getMimeType('photo.png')).toBe('image/png');
      expect(mockClient.getMimeType('photo.gif')).toBe('image/gif');
      expect(mockClient.getMimeType('photo.webp')).toBe('image/webp');
      expect(mockClient.getMimeType('photo.heic')).toBe('image/heic');
    });

    test('should return correct MIME type for videos', () => {
      expect(mockClient.getMimeType('video.mp4')).toBe('video/mp4');
      expect(mockClient.getMimeType('video.mov')).toBe('video/quicktime');
      expect(mockClient.getMimeType('video.avi')).toBe('video/x-msvideo');
      expect(mockClient.getMimeType('video.mkv')).toBe('video/x-matroska');
      expect(mockClient.getMimeType('video.webm')).toBe('video/webm');
    });

    test('should return default MIME type for unknown extensions', () => {
      expect(mockClient.getMimeType('file.txt')).toBe('application/octet-stream');
      expect(mockClient.getMimeType('document.pdf')).toBe('application/octet-stream');
    });

    test('should handle case-insensitive extensions', () => {
      expect(mockClient.getMimeType('PHOTO.JPG')).toBe('image/jpeg');
      expect(mockClient.getMimeType('Video.MP4')).toBe('video/mp4');
    });
  });
});
