import React from 'react';
import { PhotoMetadata } from '../types';
import { formatDuration } from '../utils';
import { useInView } from 'react-intersection-observer';

interface PhotoCardProps {
  photo: PhotoMetadata;
  onClick: () => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onClick }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const isVideo = photo.type === 'video';

  return (
    <div
      ref={ref}
      className="photo-card cursor-pointer"
      onClick={onClick}
      style={{ aspectRatio: '1 / 1' }}
    >
      {inView ? (
        <div className="relative h-full w-full">
          <img
            src={photo.thumbnailUrl}
            alt={photo.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="rounded-full bg-white/90 p-3 shadow-lg">
                <svg
                  className="h-8 w-8 text-gray-800"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {isVideo && photo.duration && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
              {formatDuration(photo.duration)}
            </div>
          )}
        </div>
      ) : (
        <div className="skeleton h-full w-full" />
      )}
    </div>
  );
};
