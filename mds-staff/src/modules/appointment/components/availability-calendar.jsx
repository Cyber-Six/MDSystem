import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sun, Moon, X, Check } from 'lucide-react';

/**
 * Availability Calendar Component
 * Month-view calendar grid showing slot utilization for each day
 * Color-coded: Green (open) / Yellow (>70% booked) / Red (full/suspended) / Blue (event override)
 * SRS §3.4.2
 */
const AvailabilityCalendar = ({ selectedDate, onSelectDate, events, slotDefaults, activeScheduler, editForm, customDates = [], onEditSessionLimit }) => {
  // Inline editor state
  const [editPopup, setEditPopup] = useState(null); // { dateStr, session: 'morning'|'afternoon', x, y }
  const [editValue, setEditValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const popupRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setEditPopup(null);
      }
    };
    if (editPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editPopup]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth()); // Current month
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Map day of week index to day name for schedulePerWeek lookup
  const dayIndexToName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const navigateMonth = (delta) => {
    setCurrentMonth(new Date(year, month + delta));
  };

  // Use editForm.schedulePerWeek for immediate reflection of changes, fallback to activeScheduler
  const currentSchedulePerWeek = editForm?.schedulePerWeek || activeScheduler?.schedulePerWeek || [];

  // Create a set of custom date strings for quick lookup
  const customDateSet = useMemo(() => {
    return new Set(customDates.map(cd => cd.scheduledDate));
  }, [customDates]);

  // Mock booked data per day
  const bookedSlots = useMemo(() => {
    // Check if a day is available based on schedulePerWeek or custom dates
    const checkDayAvailable = (dayOfWeek, dateStr) => {
      const dayName = dayIndexToName[dayOfWeek];
      // First check if it's in the regular weekly schedule
      if (currentSchedulePerWeek.includes(dayName)) {
        return true;
      }
      // Then check if it's a custom date
      return customDateSet.has(dateStr);
    };

    // Check if a date is a custom date (outside regular schedule)
    const checkIsCustomDate = (dayOfWeek, dateStr) => {
      const dayName = dayIndexToName[dayOfWeek];
      // It's a custom date if it's available but not in the regular weekly schedule
      return !currentSchedulePerWeek.includes(dayName) && customDateSet.has(dateStr);
    };

    const data = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();

      // Check if day is available based on scheduler's schedulePerWeek or custom dates
      if (!checkDayAvailable(dayOfWeek, dateStr)) {
        data[dateStr] = { medical: { morning: 0, afternoon: 0 }, dental: { morning: 0, afternoon: 0 }, isClosed: true };
        continue;
      }

      // Check if this is a custom date
      const isCustom = checkIsCustomDate(dayOfWeek, dateStr);

      // Check if event overrides this day
      const dayEvent = events.find((e) => dateStr >= e.startDate && dateStr <= e.endDate);

      if (dayEvent && dayEvent.effect === 'Suspend') {
        data[dateStr] = { medical: { morning: 0, afternoon: 0 }, dental: { morning: 0, afternoon: 0 }, isSuspended: true, event: dayEvent, isCustomDate: isCustom };
        continue;
      }

      // TODO: Replace with real booked slot counts from API (ScheduleDateEntity)
      data[dateStr] = {
        medical: { morning: 0, afternoon: 0 },
        dental: { morning: 0, afternoon: 0 },
        event: dayEvent || null,
        isCustomDate: isCustom,
      };
    }
    return data;
  }, [year, month, daysInMonth, events, currentSchedulePerWeek, customDateSet, dayIndexToName]);

  const getDayStatus = (dateStr) => {
    const info = bookedSlots[dateStr];
    if (!info) return 'none';
    if (info.isClosed) return 'closed';
    if (info.isSuspended) return 'suspended';
    if (info.event) return 'event';

    // Check if it's a custom date (and not a regular weekday)
    if (info.isCustomDate) return 'custom';

    const totalCapacity = (slotDefaults?.morning || 0) + (slotDefaults?.afternoon || 0);
    const totalBooked = info.medical.morning + info.medical.afternoon;
    const ratio = totalCapacity > 0 ? totalBooked / totalCapacity : 0;

    if (ratio >= 1) return 'full';
    if (ratio >= 0.7) return 'partial';
    return 'open';
  };

  const statusColors = {
    open: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/30',
    partial: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30',
    full: 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/30',
    suspended: 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 line-through hover:bg-error-200',
    event: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-900/30',
    custom: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30',
    closed: 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-400 dark:text-neutral-500',
    none: 'bg-transparent text-neutral-300 dark:text-neutral-600',
  };

  const statusDots = {
    open: 'bg-success-500',
    partial: 'bg-primary-500',
    full: 'bg-error-500',
    suspended: 'bg-error-500',
    event: 'bg-accent-500',
    custom: 'bg-violet-500',
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

  // Handle session count click for inline editing
  const handleSessionClick = (e, dateStr, session) => {
    e.stopPropagation(); // Prevent triggering date selection
    const rect = e.currentTarget.getBoundingClientRect();
    const currentValue = session === 'morning'
      ? (slotDefaults?.morning || 0)
      : (slotDefaults?.afternoon || 0);
    setEditValue(currentValue);
    setEditPopup({
      dateStr,
      session,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  };

  // Handle save of edited session limit
  const handleSaveSession = async () => {
    if (!editPopup || !onEditSessionLimit) return;
    setSaving(true);
    try {
      await onEditSessionLimit(editPopup.dateStr, editPopup.session, editValue);
      setEditPopup(null);
    } catch (err) {
      console.error('Failed to save session limit:', err);
    } finally {
      setSaving(false);
    }
  };

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
          <div key={label} className="text-center py-2 text-[10px] sm:text-xs font-medium text-secondary-500 dark:text-neutral-400">
            <span className="sm:hidden">{label.charAt(0)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 relative">
        {calendarCells.map((cell, idx) => {
          if (cell.isOtherMonth) {
            return (
              <div key={`other-${idx}`} className="p-1 sm:p-1.5 min-h-[56px] sm:min-h-[72px] border-b border-r border-neutral-100 dark:border-neutral-700/50">
                <span className="text-xs sm:text-sm text-neutral-300 dark:text-neutral-600">{cell.day}</span>
              </div>
            );
          }

          const status = getDayStatus(cell.dateStr);
          const isSelected = cell.dateStr === selectedDate;
          const isClickable = status !== 'closed' && status !== 'none';
          const slotInfo = bookedSlots[cell.dateStr];

          return (
            <div
              key={cell.dateStr}
              onClick={() => isClickable && onSelectDate(cell.dateStr)}
              className={`p-1 sm:p-1.5 min-h-[56px] sm:min-h-[72px] border-b border-r border-neutral-100 dark:border-neutral-700/50 cursor-pointer transition-all relative ${
                isSelected
                  ? 'ring-2 ring-primary-500 ring-inset bg-primary-50 dark:bg-primary-900/20'
                  : isClickable
                    ? statusColors[status]
                    : statusColors[status]
              }`}
            >
              {/* Date number - bigger */}
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm sm:text-base font-semibold ${isSelected ? 'text-primary-700 dark:text-primary-400' : ''}`}>
                  {cell.day}
                </span>
                {statusDots[status] && (
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusDots[status]}`} />
                )}
              </div>

              {/* Morning/Afternoon counts - side by side, morning left, afternoon right */}
              {status !== 'closed' && status !== 'none' && slotInfo && !slotInfo.isSuspended && (
                <div className="flex items-center justify-between gap-1 mt-1">
                  {/* Morning count - LEFT */}
                  <button
                    onClick={(e) => handleSessionClick(e, cell.dateStr, 'morning')}
                    className="flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded border border-accent-300 dark:border-accent-700 hover:bg-accent-100 dark:hover:bg-accent-900/40 transition-colors group"
                    title="Click to edit morning limit"
                  >
                    <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-500 dark:text-accent-400 flex-shrink-0" />
                    <span className="text-[9px] sm:text-xs font-semibold text-secondary-700 dark:text-neutral-200 group-hover:text-accent-600 dark:group-hover:text-accent-400">
                      {slotInfo.medical.morning}/{slotDefaults?.morning || 0}
                    </span>
                  </button>
                  {/* Afternoon count - RIGHT */}
                  <button
                    onClick={(e) => handleSessionClick(e, cell.dateStr, 'afternoon')}
                    className="flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded border border-warning-300 dark:border-warning-700 hover:bg-warning-100 dark:hover:bg-warning-900/40 transition-colors group"
                    title="Click to edit afternoon limit"
                  >
                    <Moon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-warning-500 dark:text-warning-400 flex-shrink-0" />
                    <span className="text-[9px] sm:text-xs font-semibold text-secondary-700 dark:text-neutral-200 group-hover:text-warning-600 dark:group-hover:text-warning-400">
                      {slotInfo.medical.afternoon}/{slotDefaults?.afternoon || 0}
                    </span>
                  </button>
                </div>
              )}

              {slotInfo?.isSuspended && (
                <p className="text-[9px] sm:text-[10px] text-error-500 dark:text-error-400 mt-1 font-medium">Closed</p>
              )}
              {slotInfo?.event && !slotInfo?.isSuspended && (
                <p className="text-[7px] sm:text-[9px] text-accent-600 dark:text-accent-400 mt-0.5 truncate hidden sm:block">
                  {slotInfo.event.name}
                </p>
              )}
            </div>
          );
        })}

        {/* Inline Edit Popup */}
        {editPopup && (
          <div
            ref={popupRef}
            className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl p-3 min-w-[180px]"
            style={{
              left: `${editPopup.x}px`,
              top: `${editPopup.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {editPopup.session === 'morning' ? (
                  <Sun className="w-4 h-4 text-accent-500" />
                ) : (
                  <Moon className="w-4 h-4 text-warning-500" />
                )}
                <span className="text-xs font-semibold text-secondary-800 dark:text-white capitalize">
                  {editPopup.session} Limit
                </span>
              </div>
              <button
                onClick={() => setEditPopup(null)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
              >
                <X className="w-3.5 h-3.5 text-secondary-400" />
              </button>
            </div>
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 mb-2">
              {new Date(editPopup.dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="200"
                value={editValue}
                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-1.5 text-sm font-medium text-center border border-neutral-200 dark:border-neutral-600 rounded-md bg-neutral-50 dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSession();
                  if (e.key === 'Escape') setEditPopup(null);
                }}
              />
              <button
                onClick={handleSaveSession}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {saving ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-2 sm:gap-3">
        {[
          { color: 'bg-success-500', label: 'Open' },
          { color: 'bg-primary-500', label: '>70%' },
          { color: 'bg-error-500', label: 'Full' },
          { color: 'bg-accent-500', label: 'Event' },
          { color: 'bg-violet-500', label: 'Custom' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1 sm:gap-1.5">
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${color}`} />
            <span className="text-[9px] sm:text-[10px] text-secondary-500 dark:text-neutral-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
