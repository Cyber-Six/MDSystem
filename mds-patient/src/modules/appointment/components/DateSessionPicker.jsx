import React, { useMemo } from 'react';
import { Spinner, BackButton } from './shared';
import { SESSION } from '../patient-appointment-service';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtDate = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// ── Component ─────────────────────────────────────────────────────────────────

const DateSessionPicker = ({
  scheduler,
  selectedDate,
  selectedSession,
  customDates,
  availability,
  loadingAvailability,
  today,
  maxDate,
  onDateChange,
  onSessionSelect,
  onNext,
  onBack,
}) => {
  // ── Current month (fixed — no navigation) ─────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const prevMonthDays = new Date(year, month, 0).getDate();
  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Date helpers ──────────────────────────────────────────────────────────

  /** Does the date match the scheduler's weekly schedule or custom dates? */
  const isScheduleMatch = (dateStr) => {
    if (!scheduler) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    if (scheduler.schedulePerWeek?.includes(dayName)) return true;
    if (customDates.some((cd) => cd === dateStr || cd?.split('T')[0] === dateStr)) return true;
    return false;
  };

  /** Full eligibility: within booking window + schedule match */
  const isDateAllowed = (dateStr) => {
    if (dateStr < today || dateStr > maxDate) return false;
    return isScheduleMatch(dateStr);
  };

  // ── Day status (for cell colouring — schedule-based only, no pre-fetch) ──

  const getDayStatus = (dateStr) => {
    if (!isDateAllowed(dateStr)) return 'unavailable';
    // Slot-level full/limited status is only known after the user clicks the date
    // and the parent fetches real availability. Until then every schedule-valid
    // day shows as 'available'.
    return 'available';
  };

  // ── Build 42-cell grid (6 weeks × 7 days) ────────────────────────────────

  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--)
      cells.push({ day: prevMonthDays - i, isOtherMonth: true });
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ day: d, isOtherMonth: false, dateStr: fmtDate(year, month, d) });
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++)
      cells.push({ day: i, isOtherMonth: true });
    return cells;
  }, [year, month, daysInMonth, firstDayOfWeek, prevMonthDays]);

  // ── Session slot counts for the *selected* date ──────────────────────────

  const morningRemaining = availability
    ? availability.morningAllowed - availability.morningRegistered - availability.morningPending
    : 0;
  const afternoonRemaining = availability
    ? availability.afternoonAllowed - availability.afternoonRegistered - availability.afternoonPending
    : 0;

  // ── Click handler ─────────────────────────────────────────────────────────

  const handleDayClick = (dateStr) => {
    if (getDayStatus(dateStr) === 'unavailable') return;
    onDateChange(dateStr);
  };

  // ── Style maps ────────────────────────────────────────────────────────────

  const cellStyle = {
    available:   'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer',
    unavailable: 'text-neutral-300 dark:text-neutral-600',
  };

  const dotColor = {
    available: 'bg-green-500',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Select Date &amp; Session</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{scheduler.label} — {scheduler.location}</p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
        Available days: {scheduler.schedulePerWeek?.join(', ')} | Bookings up to 7 days ahead
      </p>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-6">
        {/* Month title — no navigation (patient is locked to current month) */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 text-center">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white" style={{ margin: 0 }}>
            {MONTH_NAMES[month]} {year}
          </h3>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {calendarCells.map((cell, idx) => {
            // Other-month filler cells
            if (cell.isOtherMonth) {
              return (
                <div key={`buf-${idx}`} className="p-1.5 min-h-[48px] border-b border-r border-neutral-100 dark:border-neutral-700/50">
                  <span className="text-xs text-neutral-300 dark:text-neutral-600">{cell.day}</span>
                </div>
              );
            }

            const status = getDayStatus(cell.dateStr);
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;
            const isClickable = status === 'available';

            return (
              <div
                key={cell.dateStr}
                onClick={() => isClickable && handleDayClick(cell.dateStr)}
                className={`p-1.5 min-h-[48px] border-b border-r border-neutral-100 dark:border-neutral-700/50 transition-all relative
                  ${isSelected
                    ? 'ring-2 ring-primary-500 ring-inset bg-primary-50 dark:bg-primary-900/20'
                    : cellStyle[status] || cellStyle.unavailable
                  }`}
              >
                {/* Day number + dot */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium
                    ${isSelected ? 'text-primary-700 dark:text-primary-400' : ''}
                    ${isToday && !isSelected ? 'text-primary-600 dark:text-primary-300 font-bold' : ''}
                  `}>
                    {cell.day}
                    {isToday && <span className="ml-0.5 text-[8px] align-super">●</span>}
                  </span>
                  {dotColor[status] && (
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor[status]}`} />
                  )}
                </div>

                {/* Dot for available days */}
                {status === 'available' && selectedDate !== cell.dateStr && (
                  <div className="mt-0.5">
                    <p className="text-[9px] text-green-600 dark:text-green-400 leading-tight">Open</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-3">
          {[
            { color: 'bg-green-500', label: 'Available' },
            { color: 'bg-neutral-300 dark:bg-neutral-600', label: 'Unavailable' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Loading indicator (per-date fetch on click) ───────────────────── */}
      {loadingAvailability && (
        <div className="flex items-center space-x-2 mb-4">
          <Spinner />
          <span className="text-sm text-neutral-500">Checking availability...</span>
        </div>
      )}

      {/* ── Session picker (shown after date is selected) ─────────────────── */}
      {availability && selectedDate && isDateAllowed(selectedDate) && (
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Select session for <span className="font-semibold text-neutral-900 dark:text-white">{selectedDate}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Morning */}
            <button
              disabled={morningRemaining <= 0}
              onClick={() => onSessionSelect(SESSION.MORNING)}
              className={`p-4 rounded-lg border-2 text-left transition-all
                ${selectedSession === SESSION.MORNING
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : morningRemaining <= 0
                    ? 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer'}`}
            >
              <p className="font-semibold text-neutral-900 dark:text-white">Morning</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">8:00 AM — 12:00 PM</p>
              <p className={`text-sm mt-1 ${morningRemaining <= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {morningRemaining <= 0 ? 'Full' : `${morningRemaining} slot${morningRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </button>
            {/* Afternoon */}
            <button
              disabled={afternoonRemaining <= 0}
              onClick={() => onSessionSelect(SESSION.AFTERNOON)}
              className={`p-4 rounded-lg border-2 text-left transition-all
                ${selectedSession === SESSION.AFTERNOON
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : afternoonRemaining <= 0
                    ? 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer'}`}
            >
              <p className="font-semibold text-neutral-900 dark:text-white">Afternoon</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">1:00 PM — 5:00 PM</p>
              <p className={`text-sm mt-1 ${afternoonRemaining <= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {afternoonRemaining <= 0 ? 'Full' : `${afternoonRemaining} slot${afternoonRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
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
