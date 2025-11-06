import React from 'react';
import { IndexingStatus } from '../types';

interface IndexingBannerProps {
  status: IndexingStatus;
}

export const IndexingBanner: React.FC<IndexingBannerProps> = ({ status }) => {
  if (!status.isIndexing && status.phase === 'complete') {
    return null;
  }

  const getPhaseText = () => {
    switch (status.phase) {
      case 'initial':
        return 'Loading recent photos';
      case 'background':
        return 'Indexing remaining photos';
      case 'complete':
        return 'Indexing complete';
      default:
        return 'Indexing photos';
    }
  };

  const getStatusColor = () => {
    if (status.failed > 0) {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className={`border-b ${getStatusColor()} px-4 py-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {status.isIndexing && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {getPhaseText()}
            </p>
            <p className="text-xs text-gray-600">
              {status.indexed} of {status.total} photos indexed
              {status.failed > 0 && ` (${status.failed} failed)`}
            </p>
          </div>
        </div>
        <div className="text-sm font-semibold text-gray-900">
          {status.progress}%
        </div>
      </div>
      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${status.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
