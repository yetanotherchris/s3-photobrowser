import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { DateCount } from '../types';

interface DateNavigatorProps {
  dates: DateCount[];
  currentDate?: string;
}

interface MonthGroup {
  yearMonth: string; // Format: "YYYY-MM"
  monthName: string; // Format: "January", "February", etc.
  totalCount: number;
  firstDate: string; // ISO date string of first date in this month
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  dates,
  currentDate,
}) => {
  const groupedByYearAndMonth = useMemo(() => {
    const groups = new Map<number, MonthGroup[]>();

    // Group dates by year and month
    const monthGroups = new Map<string, MonthGroup>();

    for (const dateCount of dates) {
      const date = parseISO(dateCount.date);
      const year = date.getFullYear();
      const yearMonth = format(date, 'yyyy-MM');

      if (!monthGroups.has(yearMonth)) {
        monthGroups.set(yearMonth, {
          yearMonth,
          monthName: format(date, 'MMMM'),
          totalCount: 0,
          firstDate: dateCount.date,
        });
      }

      const monthGroup = monthGroups.get(yearMonth)!;
      monthGroup.totalCount += dateCount.count;

      // Keep track of the earliest date in the month
      if (dateCount.date < monthGroup.firstDate) {
        monthGroup.firstDate = dateCount.date;
      }
    }

    // Group months by year
    for (const monthGroup of monthGroups.values()) {
      const year = parseInt(monthGroup.yearMonth.split('-')[0]);
      const existing = groups.get(year) || [];
      existing.push(monthGroup);
      groups.set(year, existing);
    }

    // Sort months within each year (newest first)
    for (const [year, months] of groups.entries()) {
      months.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
      groups.set(year, months);
    }

    return groups;
  }, [dates]);

  const scrollToMonth = (firstDate: string) => {
    const element = document.getElementById(`date-${firstDate}`);
    const scrollableDiv = document.getElementById('scrollableDiv');

    if (element && scrollableDiv) {
      // Calculate the position of the element relative to the scrollable container
      const elementRect = element.getBoundingClientRect();
      const containerRect = scrollableDiv.getBoundingClientRect();
      const scrollTop = scrollableDiv.scrollTop;

      // Calculate target scroll position (element position + current scroll - container top)
      const targetScroll = elementRect.top - containerRect.top + scrollTop;

      // Scroll to the target position
      scrollableDiv.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="h-screen w-64 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Dates</h3>
      <div className="space-y-4">
        {Array.from(groupedByYearAndMonth.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, months]) => (
            <div key={year}>
              <div className="mb-2 border-b border-gray-300 pb-1 font-semibold text-gray-700">
                {year}
              </div>
              <div className="space-y-1 pl-2">
                {months.map((monthGroup) => {
                  const currentMonth = currentDate ? format(parseISO(currentDate), 'yyyy-MM') : null;
                  const isActive = currentMonth === monthGroup.yearMonth;

                  return (
                    <button
                      key={monthGroup.yearMonth}
                      onClick={() => scrollToMonth(monthGroup.firstDate)}
                      className={`block w-full text-left text-sm transition-colors ${
                        isActive
                          ? 'font-medium text-primary-600'
                          : 'text-gray-600 hover:text-primary-500'
                      }`}
                    >
                      <span>{monthGroup.monthName}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        ({monthGroup.totalCount})
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
