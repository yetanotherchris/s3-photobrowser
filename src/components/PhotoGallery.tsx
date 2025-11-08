import React, { useState, useEffect, useMemo } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { PhotoMetadata, DateCount, IndexingStatus } from '../types';
import { api } from '../api';
import { groupPhotosByDate } from '../utils';
import { DateGroup } from './DateGroup';
import { DateNavigator } from './DateNavigator';
import { PhotoViewer } from './PhotoViewer';
import { IndexingBanner } from './IndexingBanner';

export const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [dates, setDates] = useState<DateCount[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);

  // Group photos by date
  const photosByDate = useMemo(() => {
    return groupPhotosByDate(photos);
  }, [photos]);

  // Load initial photos
  useEffect(() => {
    loadPhotos();
    loadDates();
  }, []);

  // Poll indexing status
  useEffect(() => {
    const checkIndexingStatus = async () => {
      try {
        const status = await api.getIndexingStatus();
        setIndexingStatus(status);

        // If indexing is complete, reload photos and dates
        if (!status.isIndexing && status.phase === 'complete' && indexingStatus?.isIndexing) {
          loadPhotos();
          loadDates();
        }
      } catch (err) {
        console.error('Failed to get indexing status:', err);
      }
    };

    // Check immediately
    checkIndexingStatus();

    // Poll every 2 seconds while indexing
    const interval = setInterval(() => {
      if (indexingStatus?.isIndexing || indexingStatus === null) {
        checkIndexingStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [indexingStatus?.isIndexing]);

  // Keyboard navigation for PageUp/PageDown with continuous scrolling
  useEffect(() => {
    let scrollIntervalId: number | null = null;
    let isScrolling = false;
    let scrollDirection = 0; // -1 for up, 1 for down, 0 for none

    const startContinuousScroll = (direction: number) => {
      const scrollableDiv = document.getElementById('scrollableDiv');
      if (!scrollableDiv || isScrolling) return;

      isScrolling = true;
      scrollDirection = direction;

      // Scroll speed: 15px per frame at ~60fps
      const scrollSpeed = 15;

      const scroll = () => {
        if (!isScrolling) return;

        const scrollableDiv = document.getElementById('scrollableDiv');
        if (scrollableDiv) {
          scrollableDiv.scrollBy({
            top: scrollSpeed * scrollDirection,
            behavior: 'instant',
          });
        }

        scrollIntervalId = requestAnimationFrame(scroll);
      };

      scroll();
    };

    const stopContinuousScroll = () => {
      isScrolling = false;
      scrollDirection = 0;
      if (scrollIntervalId !== null) {
        cancelAnimationFrame(scrollIntervalId);
        scrollIntervalId = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent repeat events from being processed
      if (event.repeat && (event.key === 'PageDown' || event.key === 'PageUp')) {
        event.preventDefault();
        return;
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        startContinuousScroll(1);
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        startContinuousScroll(-1);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault();
        stopContinuousScroll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      stopContinuousScroll();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-primary disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Photo Browser</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {photos.length} photos loaded
          </p>
        </div>

        {indexingStatus && <IndexingBanner status={indexingStatus} />}

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
