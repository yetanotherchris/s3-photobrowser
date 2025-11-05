import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { DateCount } from '../types';

interface DateNavigatorProps {
  dates: DateCount[];
  currentDate?: string;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  dates,
  currentDate,
}) => {
  const groupedByYear = useMemo(() => {
    const groups = new Map<number, DateCount[]>();

    for (const dateCount of dates) {
      const date = parseISO(dateCount.date);
      const year = date.getFullYear();

      const existing = groups.get(year) || [];
      existing.push(dateCount);
      groups.set(year, existing);
    }

    return groups;
  }, [dates]);

  const scrollToDate = (date: string) => {
    const element = document.getElementById(`date-${date}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="h-screen w-64 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Dates</h3>
      <div className="space-y-4">
        {Array.from(groupedByYear.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, yearDates]) => (
            <div key={year}>
              <div className="mb-2 border-b border-gray-300 pb-1 font-semibold text-gray-700">
                {year}
              </div>
              <div className="space-y-1 pl-2">
                {yearDates.map((dateCount) => {
                  const date = parseISO(dateCount.date);
                  const isActive = currentDate === dateCount.date;

                  return (
                    <button
                      key={dateCount.date}
                      onClick={() => scrollToDate(dateCount.date)}
                      className={`block w-full text-left text-sm transition-colors ${
                        isActive
                          ? 'font-medium text-primary-600'
                          : 'text-gray-600 hover:text-primary-500'
                      }`}
                    >
                      <span>{format(date, 'MMMM d')}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        ({dateCount.count})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
