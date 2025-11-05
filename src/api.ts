import {
  PhotoMetadata,
  PhotosResponse,
  DateCount,
  CacheStats,
  HealthStatus,
} from './types';

const API_BASE = '/api';

export const api = {
  /**
   * Get photos with pagination and filters
   */
  async getPhotos(params: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    sortBy?: 'date' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PhotosResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/photos?${query}`);
    if (!response.ok) {
      throw new Error('Failed to fetch photos');
    }
    return response.json();
  },

  /**
   * Get single photo
   */
  async getPhoto(id: string): Promise<PhotoMetadata> {
    const response = await fetch(`${API_BASE}/photos/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch photo');
    }
    return response.json();
  },

  /**
   * Delete photo
   */
  async deletePhoto(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/photos/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete photo');
    }
    return response.json();
  },

  /**
   * Refresh photo index
   */
  async refreshPhotos(): Promise<{
    success: boolean;
    indexed: number;
    total: number;
    failed: number;
  }> {
    const response = await fetch(`${API_BASE}/photos/refresh`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to refresh photos');
    }
    return response.json();
  },

  /**
   * Get dates with counts
   */
  async getDates(): Promise<{ dates: DateCount[] }> {
    const response = await fetch(`${API_BASE}/photos/dates`);
    if (!response.ok) {
      throw new Error('Failed to fetch dates');
    }
    return response.json();
  },

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<CacheStats> {
    const response = await fetch(`${API_BASE}/cache/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch cache stats');
    }
    return response.json();
  },

  /**
   * Clear cache
   */
  async clearCache(): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/cache/clear`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to clear cache');
    }
    return response.json();
  },

  /**
   * Health check
   */
  async getHealth(): Promise<HealthStatus> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },
};
