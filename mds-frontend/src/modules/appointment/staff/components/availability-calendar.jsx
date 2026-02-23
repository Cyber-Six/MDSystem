import React, { useState, useMemo } from 'react';

/**
 * Availability Calendar Component
 * Month-view calendar grid showing slot utilization for each day
 * Color-coded: Green (open) / Yellow (>70% booked) / Red (full/suspended) / Blue (event override)
 * SRS §3.4.2
 */
const AvailabilityCalendar = ({ selectedDate, onSelectDate, events, slotDefaults }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1)); // Feb 2026

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (delta) => {
    setCurrentMonth(new Date(year, month + delta));
  };

  // Mock booked data per day
  const bookedSlots = useMemo(() => {
    const data = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      
      // No slots on weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        data[dateStr] = { medical: { morning: 0, afternoon: 0 }, dental: { morning: 0, afternoon: 0 }, isClosed: true };
        continue;
      }

      // Check if event overrides this day
      const dayEvent = events.find((e) => dateStr >= e.startDate && dateStr <= e.endDate);
      
      if (dayEvent && dayEvent.effect === 'Suspend') {
        data[dateStr] = { medical: { morning: 0, afternoon: 0 }, dental: { morning: 0, afternoon: 0 }, isSuspended: true, event: dayEvent };
        continue;
      }

      // TODO: Replace with real booked slot counts from API (ScheduleDateEntity)
      data[dateStr] = {
        medical: { morning: 0, afternoon: 0 },
        dental: { morning: 0, afternoon: 0 },
        event: dayEvent || null,
      };
    }
    return data;
  }, [year, month, daysInMonth, events, slotDefaults]);

  const getDayStatus = (dateStr) => {
    const info = bookedSlots[dateStr];
    if (!info) return 'none';
    if (info.isClosed) return 'closed';
    if (info.isSuspended) return 'suspended';
    if (info.event) return 'event';

    const totalCapacity = slotDefaults.medical.morning + slotDefaults.medical.afternoon;
    const totalBooked = info.medical.morning + info.medical.afternoon;
    const ratio = totalBooked / totalCapacity;

    if (ratio >= 1) return 'full';
    if (ratio >= 0.7) return 'partial';
    return 'open';
  };

  const statusColors = {
    open: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/30',
    partial: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 hover:bg-warning-100 dark:hover:bg-warning-900/30',
    full: 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/30',
    suspended: 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 line-through hover:bg-error-200',
    event: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-900/30',
    closed: 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-400 dark:text-neutral-500',
    none: 'bg-transparent text-neutral-300 dark:text-neutral-600',
  };

  const statusDots = {
    open: 'bg-success-500',
    partial: 'bg-warning-500',
    full: 'bg-error-500',
    suspended: 'bg-error-500',
    event: 'bg-accent-500',
    closed: '',
    none: '',
  };

  // Build calendar grid
  const calendarCells = [];

  // Previous month buffer
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isOtherMonth: true });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ day: d, isOtherMonth: false, dateStr });
  }

  // Next month buffer
  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({ day: i, isOtherMonth: true });
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Month navigation */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
        >
          <svg className="w-4 h-4 text-secondary-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
        >
          <svg className="w-4 h-4 text-secondary-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700">
        {dayLabels.map((label) => (
          <div key={label} className="text-center py-2 text-xs font-medium text-secondary-500 dark:text-neutral-400">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarCells.map((cell, idx) => {
          if (cell.isOtherMonth) {
            return (
              <div key={`other-${idx}`} className="p-1.5 min-h-[52px] border-b border-r border-neutral-100 dark:border-neutral-700/50">
                <span className="text-xs text-neutral-300 dark:text-neutral-600">{cell.day}</span>
              </div>
            );
          }

          const status = getDayStatus(cell.dateStr);
          const isSelected = cell.dateStr === selectedDate;
          const isClickable = status !== 'closed' && status !== 'none';

          return (
            <div
              key={cell.dateStr}
              onClick={() => isClickable && onSelectDate(cell.dateStr)}
              className={`p-1.5 min-h-[52px] border-b border-r border-neutral-100 dark:border-neutral-700/50 cursor-pointer transition-all relative ${
                isSelected
                  ? 'ring-2 ring-primary-500 ring-inset bg-primary-50 dark:bg-primary-900/20'
                  : isClickable
                    ? statusColors[status]
                    : statusColors[status]
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isSelected ? 'text-primary-700 dark:text-primary-400' : ''}`}>
                  {cell.day}
                </span>
                {statusDots[status] && (
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]}`} />
                )}
              </div>
              {status !== 'closed' && status !== 'none' && bookedSlots[cell.dateStr] && !bookedSlots[cell.dateStr].isSuspended && (
                <div className="mt-1">
                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 leading-tight">
                    {bookedSlots[cell.dateStr].medical.morning + bookedSlots[cell.dateStr].medical.afternoon}/
                    {slotDefaults.medical.morning + slotDefaults.medical.afternoon}
                  </p>
                </div>
              )}
              {bookedSlots[cell.dateStr]?.isSuspended && (
                <p className="text-[10px] text-error-500 dark:text-error-400 mt-1 leading-tight">Closed</p>
              )}
              {bookedSlots[cell.dateStr]?.event && !bookedSlots[cell.dateStr]?.isSuspended && (
                <p className="text-[10px] text-accent-600 dark:text-accent-400 mt-0.5 truncate leading-tight">
                  {bookedSlots[cell.dateStr].event.name}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-3">
        {[
          { color: 'bg-success-500', label: 'Open' },
          { color: 'bg-warning-500', label: '>70% Booked' },
          { color: 'bg-error-500', label: 'Full / Suspended' },
          { color: 'bg-accent-500', label: 'Event Override' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-secondary-500 dark:text-neutral-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
