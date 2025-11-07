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

  // Only show years that have photos
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    dates.forEach(dateCount => {
      const year = new Date(dateCount.date).getFullYear();
      yearSet.add(year);
    });
    // Convert to sorted array (newest first)
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [dates]);

  // Track scroll position of main photo gallery
  useEffect(() => {
    const scrollableDiv = document.getElementById('scrollableDiv');
    if (!scrollableDiv) return;

    const handleScroll = () => {
      // Find the current visible date group
      const dateGroups = document.querySelectorAll('[id^="date-"]');
      let foundYear: number | null = null;

      // Find the date group that's most visible in the viewport
      // We'll use the top 1/3 of the viewport as the detection zone
      const viewportHeight = window.innerHeight;
      const detectionZone = viewportHeight / 3;

      for (const group of Array.from(dateGroups)) {
        const rect = group.getBoundingClientRect();
        // Check if this date group intersects with the top detection zone
        if (rect.top >= 0 && rect.top <= detectionZone) {
          const dateId = group.id.replace('date-', '');
          const year = new Date(dateId).getFullYear();
          foundYear = year;
          break;
        }
        // Also check if the group is already scrolled past but still visible
        if (rect.top < 0 && rect.bottom > detectionZone) {
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
      className="flex h-screen w-20 flex-col items-center justify-center bg-white border-r border-gray-200 py-4 shadow-sm"
    >
      <div ref={timelineRef} className="relative flex flex-col items-center space-y-4">
        {years.map((year) => {
          const isActive = currentYear === year;

          return (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              className={`group relative flex h-10 w-full items-center justify-center transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'scale-125 font-bold text-blue-600'
                  : 'text-gray-700 hover:scale-110 hover:text-blue-500'
              }`}
              title={`${year}`}
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
                {!isActive && (
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
