import React, { useMemo, useState, useEffect } from 'react';
import { Spinner, BackButton } from './shared';
import { SESSION } from '../patient-appointment-service';

const MS_PER_DAY = 86400000;
const CALENDAR_CELLS = 42;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtDate = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const DateSessionPicker = ({
  scheduler,
  selectedDate,
  selectedSession,
  customDates,
  availability,
  loadingAvailability,
  today,
  maxDate,
  monthAvailability = {},
  onDateChange,
  onSessionSelect,
  onMonthChange,
  onNext,
  onBack,
}) => {
  const now = new Date();
  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const maxDateObj = new Date(maxDate + 'T00:00:00');
  const maxMonth = maxDateObj.getMonth();
  const maxYear = maxDateObj.getFullYear();
  const spansNextMonth = maxYear > currentYear || maxMonth > currentMonth;

  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);

  const canGoPrev = viewYear > currentYear || viewMonth > currentMonth;
  const canGoNext = spansNextMonth && (viewYear < maxYear || viewMonth < maxMonth);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  // Notify parent of month changes for data fetching
  useEffect(() => {
    if (onMonthChange) {
      const startDate = fmtDate(viewYear, viewMonth, 1);
      const endDate = fmtDate(viewYear, viewMonth, daysInMonth);
      onMonthChange(startDate, endDate);
    }
  }, [viewYear, viewMonth, daysInMonth]);

  const schedulingDays = useMemo(() =>
    Math.round((maxDateObj - new Date(today + 'T00:00:00')) / MS_PER_DAY),
    [maxDateObj, today]
  );

  // Build custom date map for quick lookup (handles both string and object formats)
  // Map: dateStr → { type, morningAllowed, afternoonAllowed }
  const customDateMap = useMemo(() => {
    const map = new Map();
    const toLocal = (s) => {
      if (!s) return '';
      if (!s.includes('T') && !s.endsWith('Z')) return s;
      const d = new Date(s);
      if (isNaN(d.getTime())) return s.split('T')[0];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    (customDates || []).forEach(cd => {
      if (typeof cd === 'string') {
        const key = toLocal(cd);
        if (key) map.set(key, { type: 'Include' });
      } else if (cd?.scheduledDate) {
        const key = toLocal(String(cd.scheduledDate));
        if (key) map.set(key, {
          type: cd.type || 'Include',
          morningAllowed: cd.morningAllowed,
          afternoonAllowed: cd.afternoonAllowed,
        });
      }
    });
    return map;
  }, [customDates]);

  const isScheduleMatch = (dateStr) => {
    if (!scheduler) return false;

    // Check for Exclude custom date first — blocks even regular schedule days
    const customEntry = customDateMap.get(dateStr);
    if (customEntry?.type === 'Exclude') return false;

    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    if (scheduler.schedulePerWeek?.includes(dayName)) return true;

    // Include custom date opens the day
    if (customEntry?.type === 'Include') return true;

    return false;
  };

  const isDateAllowed = (dateStr) => {
    if (dateStr < today || dateStr > maxDate) return false;
    return isScheduleMatch(dateStr);
  };

  // Determine day status using real month availability data
  const getDayStatus = (dateStr) => {
    if (!isDateAllowed(dateStr)) return 'unavailable';

    const apiData = monthAvailability[dateStr];
    if (!apiData) return 'available'; // No booking data yet = open

    const totalAllowed = (apiData.morningAllowed || 0) + (apiData.afternoonAllowed || 0);

    // Staff disabled this date (both sessions explicitly set to 0) — treat as unavailable, not full
    if (totalAllowed === 0) return 'unavailable';

    const totalBooked = (apiData.morningRegistered || 0) + (apiData.morningPending || 0) +
                        (apiData.afternoonRegistered || 0) + (apiData.afternoonPending || 0);

    if (totalBooked >= totalAllowed) return 'full';
    if (totalBooked / totalAllowed >= 0.7) return 'partial';
    return 'available';
  };

  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--)
      cells.push({ day: prevMonthDays - i, isOtherMonth: true });
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ day: d, isOtherMonth: false, dateStr: fmtDate(viewYear, viewMonth, d) });
    const remaining = CALENDAR_CELLS - cells.length;
    for (let i = 1; i <= remaining; i++)
      cells.push({ day: i, isOtherMonth: true });
    return cells;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek, prevMonthDays]);

  const morningRemaining = availability
    ? availability.morningAllowed - availability.morningRegistered - availability.morningPending
    : 0;
  const afternoonRemaining = availability
    ? availability.afternoonAllowed - availability.afternoonRegistered - availability.afternoonPending
    : 0;

  const handleDayClick = (dateStr) => {
    if (getDayStatus(dateStr) === 'unavailable') return;
    onDateChange(dateStr);
  };

  const cellStyle = {
    available:   'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer',
    partial:     'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer',
    full:        'bg-red-50 dark:bg-red-900/20 text-red-400 dark:text-red-500',
    unavailable: 'text-neutral-300 dark:text-neutral-600',
  };

  const dotColor = {
    available: 'bg-green-500',
    partial: 'bg-amber-500',
    full: 'bg-red-500',
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Select Date &amp; Session</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{scheduler.label} — {scheduler.location}</p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
        Available days: {scheduler.schedulePerWeek?.join(', ')} | Bookings up to {schedulingDays} day{schedulingDays !== 1 ? 's' : ''} ahead
      </p>

      {/* Calendar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-6">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          {spansNextMonth ? (
            <button onClick={handlePrevMonth} disabled={!canGoPrev} className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          ) : <span />}
          <h3 className="text-base font-semibold text-neutral-800 dark:text-white" style={{ margin: 0 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          {spansNextMonth ? (
            <button onClick={handleNextMonth} disabled={!canGoNext} className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          ) : <span />}
        </div>
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarCells.map((cell, idx) => {
            if (cell.isOtherMonth) {
              return (
                <div key={`buf-${idx}`} className="p-2 min-h-[64px] border-b border-r border-neutral-100 dark:border-neutral-700/50 flex items-center justify-center">
                  <span className="text-xs text-neutral-300 dark:text-neutral-600">{cell.day}</span>
                </div>
              );
            }
            const status = getDayStatus(cell.dateStr);
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;
            const isClickable = status === 'available' || status === 'partial';
            return (
              <div
                key={cell.dateStr}
                onClick={() => isClickable && handleDayClick(cell.dateStr)}
                className={`p-2 min-h-[64px] border-b border-r border-neutral-100 dark:border-neutral-700/50 transition-all relative flex flex-col items-center justify-center ${status === 'full' ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${isSelected
                    ? 'ring-2 ring-primary-500 ring-inset bg-primary-50 dark:bg-primary-900/20'
                    : cellStyle[status] || cellStyle.unavailable}`}
              >
                <span className={`text-sm font-semibold
                  ${isSelected ? 'text-primary-700 dark:text-primary-400' : ''}
                  ${isToday && !isSelected ? 'text-primary-600 dark:text-primary-300 font-bold' : ''}`}>
                  {cell.day}
                  {isToday && <span className="ml-0.5 text-[8px] align-super">●</span>}
                </span>
                {status === 'available' && selectedDate !== cell.dateStr && (
                  <p className="text-[8px] text-green-600 dark:text-green-400 leading-tight mt-0.5">Open</p>
                )}
                {status === 'partial' && selectedDate !== cell.dateStr && (
                  <p className="text-[8px] text-amber-600 dark:text-amber-400 leading-tight mt-0.5">Filling up</p>
                )}
                {status === 'full' && (
                  <p className="text-[8px] text-red-500 dark:text-red-400 leading-tight mt-0.5 font-medium">Full</p>
                )}
                {dotColor[status] && (
                  <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dotColor[status]}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          {[
            { color: 'bg-green-500', label: 'Available' },
            { color: 'bg-amber-500', label: 'Filling up' },
            { color: 'bg-red-500', label: 'Full' },
            { color: 'bg-neutral-300 dark:bg-neutral-600', label: 'Unavailable' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loadingAvailability && (
        <div className="flex items-center space-x-2 mb-4">
          <Spinner />
          <span className="text-sm text-neutral-500">Checking availability...</span>
        </div>
      )}

      {/* ── Session picker — only this part was changed ── */}
      {availability && selectedDate && isDateAllowed(selectedDate) && getDayStatus(selectedDate) !== 'unavailable' && (
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Select session for <span className="font-semibold text-neutral-900 dark:text-white">{selectedDate}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Morning */}
            <div
              onClick={() => morningRemaining > 0 && onSessionSelect(SESSION.MORNING)}
              className={`cursor-pointer bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col gap-3 transition-all duration-200
                ${morningRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-lg'}
                ${selectedSession === SESSION.MORNING ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-md bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-13l-.87.5M4.21 17.5l-.87.5M20.66 17.5l-.87-.5M4.21 6.5l-.87-.5M21 12h-1M4 12H3m15.36-6.36l-.7.7M6.34 17.66l-.7.7M17.66 17.66l-.7-.7M6.34 6.34l-.7-.7" />
                  </svg>
                </div>
                <p className={`text-lg font-bold leading-none m-0 transition-colors duration-200 ${morningRemaining > 0 ? 'hover:text-yellow-500' : ''} text-secondary-800 dark:text-white`}>Morning</p>
              </div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">8:00 AM — 12:00 PM</p>
              <p className={`text-sm font-semibold m-0 ${morningRemaining <= 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {morningRemaining <= 0 ? 'Full' : `${morningRemaining} slot${morningRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </div>

            {/* Afternoon */}
            <div
              onClick={() => afternoonRemaining > 0 && onSessionSelect(SESSION.AFTERNOON)}
              className={`cursor-pointer bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col gap-3 transition-all duration-200
                ${afternoonRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-lg'}
                ${selectedSession === SESSION.AFTERNOON ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                <p className={`text-lg font-bold leading-none m-0 transition-colors duration-200 ${afternoonRemaining > 0 ? 'hover:text-yellow-500' : ''} text-secondary-800 dark:text-white`}>Afternoon</p>
              </div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">1:00 PM — 5:00 PM</p>
              <p className={`text-sm font-semibold m-0 ${afternoonRemaining <= 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {afternoonRemaining <= 0 ? 'Full' : `${afternoonRemaining} slot${afternoonRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <BackButton onClick={onBack} />
        <button
          disabled={!selectedDate || !selectedSession || !isDateAllowed(selectedDate)}
          onClick={onNext}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
};

export default DateSessionPicker;
