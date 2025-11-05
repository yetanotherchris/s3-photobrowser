import React from 'react';
import { PhotoMetadata } from '../types';
import { PhotoCard } from './PhotoCard';
import { formatDateHeader } from '../utils';

interface DateGroupProps {
  date: string;
  photos: PhotoMetadata[];
  onPhotoClick: (photo: PhotoMetadata, index: number) => void;
}

export const DateGroup: React.FC<DateGroupProps> = ({
  date,
  photos,
  onPhotoClick,
}) => {
  return (
    <div className="mb-8" id={`date-${date}`}>
      <h2 className="mb-4 text-xl font-semibold text-gray-800">
        {formatDateHeader(date)}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(photo, index)}
          />
        ))}
      </div>
    </div>
  );
};
