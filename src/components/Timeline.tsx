import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DateCount } from '../types';

interface TimelineProps {
  dates: DateCount[];
  onYearClick: (year: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ dates, onYearClick }) => {
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate years from 1970 to current year
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearList: number[] = [];
    for (let year = currentYear; year >= 1970; year--) {
      yearList.push(year);
    }
    return yearList;
  }, []);

  // Get years that have photos
  const yearsWithPhotos = useMemo(() => {
    const yearSet = new Set<number>();
    dates.forEach(dateCount => {
      const year = new Date(dateCount.date).getFullYear();
      yearSet.add(year);
    });
    return yearSet;
  }, [dates]);

  // Track scroll position of main photo gallery
  useEffect(() => {
    const scrollableDiv = document.getElementById('scrollableDiv');
    if (!scrollableDiv) return;

    const handleScroll = () => {
      // Find the current visible date group
      const dateGroups = document.querySelectorAll('[id^="date-"]');
      let foundYear: number | null = null;

      for (const group of Array.from(dateGroups)) {
        const rect = group.getBoundingClientRect();
        // Check if this date group is visible in the viewport
        if (rect.top <= 150 && rect.bottom >= 0) {
          const dateId = group.id.replace('date-', '');
          const year = new Date(dateId).getFullYear();
          foundYear = year;
          break;
        }
      }

      if (foundYear !== null && foundYear !== currentYear) {
        setCurrentYear(foundYear);
      }
    };

    scrollableDiv.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call

    return () => scrollableDiv.removeEventListener('scroll', handleScroll);
  }, [currentYear]);

  const handleYearClick = (year: number) => {
    // Find the first date in this year
    const firstDateInYear = dates.find(dateCount => {
      const dateYear = new Date(dateCount.date).getFullYear();
      return dateYear === year;
    });

    if (firstDateInYear) {
      onYearClick(year);
      const element = document.getElementById(`date-${firstDateInYear.date}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className="fixed right-0 top-0 z-20 flex h-screen w-16 flex-col items-center overflow-y-auto bg-gradient-to-l from-gray-50 to-transparent py-4 hover:w-20 transition-all duration-200"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#9CA3AF transparent',
      }}
    >
      <div ref={timelineRef} className="relative flex flex-col items-center space-y-8">
        {years.map((year) => {
          const hasPhotos = yearsWithPhotos.has(year);
          const isActive = currentYear === year;

          return (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              disabled={!hasPhotos}
              className={`group relative flex h-12 w-full items-center justify-center transition-all duration-150 ${
                hasPhotos ? 'cursor-pointer' : 'cursor-default opacity-30'
              } ${
                isActive
                  ? 'scale-125 font-bold text-blue-600'
                  : hasPhotos
                  ? 'text-gray-700 hover:scale-110 hover:text-blue-500'
                  : 'text-gray-400'
              }`}
              title={hasPhotos ? `${year}` : `${year} (no photos)`}
            >
              <div className="flex items-center">
                {/* Year label */}
                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {year}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -left-2 h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                )}

                {/* Dot for years with photos */}
                {hasPhotos && !isActive && (
                  <div className="absolute -left-1 h-1 w-1 rounded-full bg-gray-400 group-hover:bg-blue-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
