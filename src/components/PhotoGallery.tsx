import React, { useState, useEffect, useMemo } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { PhotoMetadata, DateCount } from '../types';
import { api } from '../api';
import { groupPhotosByDate } from '../utils';
import { DateGroup } from './DateGroup';
import { DateNavigator } from './DateNavigator';
import { PhotoViewer } from './PhotoViewer';

export const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [dates, setDates] = useState<DateCount[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Group photos by date
  const photosByDate = useMemo(() => {
    return groupPhotosByDate(photos);
  }, [photos]);

  // Load initial photos
  useEffect(() => {
    loadPhotos();
    loadDates();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const response = await api.getPhotos({
        limit: 50,
        offset: 0,
        sortBy: 'date',
        sortOrder: 'desc',
      });

      setPhotos(response.photos);
      setHasMore(response.hasMore);
      setError(null);
    } catch (err) {
      setError('Failed to load photos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDates = async () => {
    try {
      const response = await api.getDates();
      setDates(response.dates);
    } catch (err) {
      console.error('Failed to load dates:', err);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;

    try {
      const response = await api.getPhotos({
        limit: 50,
        offset: photos.length,
        sortBy: 'date',
        sortOrder: 'desc',
      });

      setPhotos([...photos, ...response.photos]);
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Failed to load more photos:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshPhotos();
      await loadPhotos();
      await loadDates();
      alert('Photos refreshed successfully!');
    } catch (err) {
      alert('Failed to refresh photos');
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePhotoClick = (photo: PhotoMetadata, indexInGroup: number) => {
    // Find global index
    const globalIndex = photos.findIndex((p) => p.id === photo.id);
    setSelectedPhotoIndex(globalIndex);
  };

  if (loading && photos.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading photos...</p>
        </div>
      </div>
    );
  }

  if (error && photos.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button onClick={loadPhotos} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <DateNavigator dates={dates} />

      <div className="flex-1 overflow-hidden">
        <div className="border-b border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Photo Browser</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-primary disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {photos.length} photos loaded
          </p>
        </div>

        <div id="scrollableDiv" className="h-[calc(100vh-80px)] overflow-y-auto p-6">
          <InfiniteScroll
            dataLength={photos.length}
            next={loadMore}
            hasMore={hasMore}
            loader={
              <div className="py-8 text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
                <p className="text-sm text-gray-600">Loading more photos...</p>
              </div>
            }
            scrollableTarget="scrollableDiv"
            endMessage={
              <p className="py-8 text-center text-gray-500">
                {photos.length === 0
                  ? 'No photos found'
                  : "You've reached the end!"}
              </p>
            }
          >
            {Array.from(photosByDate.entries())
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, datePhotos]) => (
                <DateGroup
                  key={date}
                  date={date}
                  photos={datePhotos}
                  onPhotoClick={handlePhotoClick}
                />
              ))}
          </InfiniteScroll>
        </div>
      </div>

      {selectedPhotoIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={selectedPhotoIndex}
          isOpen={selectedPhotoIndex !== null}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}
    </div>
  );
};
