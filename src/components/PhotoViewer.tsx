import React, { useEffect, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { PhotoMetadata } from '../types';
import { formatFileSize, formatDuration, downloadFile, copyToClipboard } from '../utils';
import { api } from '../api';

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
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }

    try {
      await api.deletePhoto(currentPhoto.id);
      // Close and notify parent to refresh
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('Failed to delete photo');
    }
  };

  const handleDownload = () => {
    downloadFile(currentPhoto.originalUrl, currentPhoto.filename);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${currentPhoto.originalUrl}`;
    const success = await copyToClipboard(url);
    if (success) {
      alert('Link copied to clipboard');
    }
  };

  // Convert photos to lightbox slides
  const slides = photos.map((photo) => {
    if (photo.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          {
            src: photo.originalUrl,
            type: photo.mimeType,
          },
        ],
        width: photo.width || 1920,
        height: photo.height || 1080,
      };
    }

    return {
      src: photo.previewUrl,
      alt: photo.filename,
      width: photo.width || 1920,
      height: photo.height || 1080,
    };
  });

  return (
    <>
      <Lightbox
        open={isOpen}
        close={onClose}
        slides={slides}
        index={currentIndex}
        on={{
          view: ({ index }) => setCurrentIndex(index),
        }}
        carousel={{
          finite: false,
        }}
        render={{
          buttonPrev: photos.length > 1 ? undefined : () => null,
          buttonNext: photos.length > 1 ? undefined : () => null,
        }}
      />

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
                className="rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
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
              <button
                onClick={handleDelete}
                className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                  deleteConfirm
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {deleteConfirm ? 'Confirm Delete?' : 'Delete'}
              </button>
            </div>
          </div>

          {showMetadata && currentPhoto.exif && (
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
    </>
  );
};
