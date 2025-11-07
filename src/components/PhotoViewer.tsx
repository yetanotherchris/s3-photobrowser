import React, { useEffect, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { PhotoMetadata } from '../types';
import { formatFileSize, formatDuration, downloadFile, copyToClipboard } from '../utils';
import { api } from '../api';
import { VideoPlayer } from './VideoPlayer';

interface PhotoViewerProps {
  photos: PhotoMetadata[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const currentPhoto = photos[currentIndex];
  const isVideo = currentPhoto?.type === 'video';

  // Check if there's meaningful EXIF data to display
  const hasExifData = currentPhoto?.exif && (
    currentPhoto.exif.cameraMake ||
    currentPhoto.exif.cameraModel ||
    currentPhoto.exif.lensModel ||
    currentPhoto.exif.focalLength ||
    currentPhoto.exif.aperture ||
    currentPhoto.exif.iso ||
    currentPhoto.exif.shutterSpeed
  );

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose]);

  const handleDownload = () => {
    downloadFile(currentPhoto.originalUrl, currentPhoto.filename);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${currentPhoto.originalUrl}`;
    const success = await copyToClipboard(url);
    if (success) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Convert photos to lightbox slides (images only)
  const slides = photos
    .filter((photo) => photo.type !== 'video')
    .map((photo) => ({
      src: photo.previewUrl,
      alt: photo.filename,
      width: photo.width || 1920,
      height: photo.height || 1080,
    }));

  // Find the lightbox index for the current photo (if it's an image)
  const lightboxIndex = !isVideo
    ? photos.slice(0, currentIndex).filter((p) => p.type !== 'video').length
    : 0;

  return (
    <>
      {/* Lightbox for images only */}
      {!isVideo && (
        <Lightbox
          open={isOpen}
          close={onClose}
          slides={slides}
          index={lightboxIndex}
          on={{
            view: ({ index }) => {
              // Map lightbox index back to photos array index
              let photoIndex = 0;
              let lightboxCount = 0;
              while (lightboxCount < index && photoIndex < photos.length) {
                if (photos[photoIndex].type !== 'video') {
                  lightboxCount++;
                }
                photoIndex++;
              }
              // Find the next non-video photo
              while (photoIndex < photos.length && photos[photoIndex].type === 'video') {
                photoIndex++;
              }
              setCurrentIndex(photoIndex);
            },
          }}
          carousel={{
            finite: false,
          }}
          render={{
            buttonPrev: photos.length > 1 ? undefined : () => null,
            buttonNext: photos.length > 1 ? undefined : () => null,
          }}
        />
      )}

      {/* Custom video viewer */}
      {isVideo && isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation buttons */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Previous"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {currentIndex < photos.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Next"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Video player */}
          <div className="h-full w-full max-w-7xl px-16 pb-32">
            <VideoPlayer url={currentPhoto.originalUrl} className="h-full w-full" />
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/80 p-4 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{currentPhoto.filename}</h3>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-300">
                <span>{formatFileSize(currentPhoto.size)}</span>
                {currentPhoto.width && currentPhoto.height && (
                  <span>
                    {currentPhoto.width} × {currentPhoto.height}
                  </span>
                )}
                {currentPhoto.duration && (
                  <span>{formatDuration(currentPhoto.duration)}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                disabled={!hasExifData}
                className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                  !hasExifData
                    ? 'cursor-not-allowed bg-white/5 text-gray-500'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                Info
              </button>
              <button
                onClick={handleDownload}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
              >
                Download
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
              >
                Copy Link
              </button>
            </div>
          </div>

          {showMetadata && hasExifData && (
            <div className="mx-auto mt-4 max-w-7xl rounded-lg bg-black/60 p-4">
              <h4 className="mb-2 font-semibold">EXIF Data</h4>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                {(currentPhoto.exif.cameraMake || currentPhoto.exif.cameraModel) && (
                  <div>
                    <span className="text-gray-400">Camera:</span>{' '}
                    {[currentPhoto.exif.cameraMake, currentPhoto.exif.cameraModel]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                )}
                {currentPhoto.exif.lensModel && (
                  <div>
                    <span className="text-gray-400">Lens:</span>{' '}
                    {currentPhoto.exif.lensModel}
                  </div>
                )}
                {currentPhoto.exif.focalLength && (
                  <div>
                    <span className="text-gray-400">Focal Length:</span>{' '}
                    {currentPhoto.exif.focalLength}mm
                  </div>
                )}
                {currentPhoto.exif.aperture && (
                  <div>
                    <span className="text-gray-400">Aperture:</span> f/
                    {currentPhoto.exif.aperture}
                  </div>
                )}
                {currentPhoto.exif.iso && (
                  <div>
                    <span className="text-gray-400">ISO:</span>{' '}
                    {currentPhoto.exif.iso}
                  </div>
                )}
                {currentPhoto.exif.shutterSpeed && (
                  <div>
                    <span className="text-gray-400">Shutter:</span>{' '}
                    {currentPhoto.exif.shutterSpeed}s
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast notification */}
      {showToast && (
        <div className="fixed right-4 top-4 z-[200] animate-slide-in-right rounded-lg bg-green-600 px-6 py-3 text-white shadow-lg transition-all duration-300">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Link copied to clipboard</span>
          </div>
        </div>
      )}
    </>
  );
};
