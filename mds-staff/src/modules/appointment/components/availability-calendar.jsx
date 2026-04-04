import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sun, Moon, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Availability Calendar Component
 * Month-view calendar grid showing slot utilization for each day
 * Color-coded: Green (open) / Amber (>70% booked) / Red (full/suspended) / Blue (event override)
 * SRS §3.4.2
 */
const AvailabilityCalendar = ({ selectedDate, onSelectDate, events, slotDefaults, activeScheduler, editForm, customDates = [], onEditSessionLimit, monthAvailability = {}, onMonthChange }) => {
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
    const newMonth = new Date(year, month + delta);
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth()));
  };

  // Today's date string for highlighting
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  }, [year, month]);

  // Notify parent of month changes for data fetching
  useEffect(() => {
    if (onMonthChange) {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      onMonthChange(startDate, endDate);
    }
  }, [year, month, daysInMonth]);

  // Use editForm.schedulePerWeek for immediate reflection of changes, fallback to activeScheduler
  const currentSchedulePerWeek = editForm?.schedulePerWeek || activeScheduler?.schedulePerWeek || [];

  // Create a map of custom dates for quick lookup (date -> custom date info)
  const customDateMap = useMemo(() => {
    const map = {};
    customDates.forEach(cd => {
      const dateStr = cd.scheduledDate?.split('T')[0] || cd.scheduledDate;
      map[dateStr] = cd;
    });
    return map;
  }, [customDates]);

  const customDateSet = useMemo(() => new Set(Object.keys(customDateMap)), [customDateMap]);

  // Build slot data per day using real availability from API
  const bookedSlots = useMemo(() => {
    const checkDayAvailable = (dayOfWeek, dateStr) => {
      const dayName = dayIndexToName[dayOfWeek];
      if (currentSchedulePerWeek.includes(dayName)) return true;
      return customDateSet.has(dateStr);
    };

    const checkIsCustomDate = (dayOfWeek, dateStr) => {
      const dayName = dayIndexToName[dayOfWeek];
      return !currentSchedulePerWeek.includes(dayName) && customDateSet.has(dateStr);
    };

    const data = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();

      if (!checkDayAvailable(dayOfWeek, dateStr)) {
        data[dateStr] = { isClosed: true };
        continue;
      }

      const isCustom = checkIsCustomDate(dayOfWeek, dateStr);
      const dayEvent = events.find((e) => dateStr >= e.startDate && dateStr <= e.endDate);

      if (dayEvent && dayEvent.effect === 'Suspend') {
        data[dateStr] = { isSuspended: true, event: dayEvent, isCustomDate: isCustom };
        continue;
      }

      // Resolve slot data: monthAvailability (real API data) > customDate overrides > scheduler defaults
      const apiData = monthAvailability[dateStr];
      const customEntry = customDateMap[dateStr];

      const morningAllowed = apiData?.morningAllowed ?? customEntry?.morningAllowed ?? slotDefaults?.morning ?? 0;
      const afternoonAllowed = apiData?.afternoonAllowed ?? customEntry?.afternoonAllowed ?? slotDefaults?.afternoon ?? 0;
      const morningRegistered = apiData?.morningRegistered ?? 0;
      const morningPending = apiData?.morningPending ?? 0;
      const afternoonRegistered = apiData?.afternoonRegistered ?? 0;
      const afternoonPending = apiData?.afternoonPending ?? 0;

      data[dateStr] = {
        morningAllowed,
        afternoonAllowed,
        morningBooked: morningRegistered + morningPending,
        afternoonBooked: afternoonRegistered + afternoonPending,
        morningRegistered,
        morningPending,
        afternoonRegistered,
        afternoonPending,
        event: dayEvent || null,
        isCustomDate: isCustom,
      };
    }
    return data;
  }, [year, month, daysInMonth, events, currentSchedulePerWeek, customDateSet, customDateMap, dayIndexToName, monthAvailability, slotDefaults]);

  const getDayStatus = (dateStr) => {
    const info = bookedSlots[dateStr];
    if (!info) return 'none';
    if (info.isClosed) return 'closed';
    if (info.isSuspended) return 'suspended';
    if (info.event) return 'event';

    // Use per-day capacity (already resolved from API > customDate > defaults)
    const totalCapacity = (info.morningAllowed || 0) + (info.afternoonAllowed || 0);
    const totalBooked = (info.morningBooked || 0) + (info.afternoonBooked || 0);

    // Custom date indicator takes priority if no bookings yet
    if (info.isCustomDate && totalBooked === 0) return 'custom';

    const ratio = totalCapacity > 0 ? totalBooked / totalCapacity : 0;

    if (ratio >= 1) return 'full';
    if (ratio >= 0.7) return 'partial';
    if (info.isCustomDate) return 'custom';
    return 'open';
  };

  const statusColors = {
    open: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
    partial: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30',
    full: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30',
    suspended: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200',
    event: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30',
    custom: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30',
    closed: 'bg-neutral-50 dark:bg-neutral-700/50 text-neutral-400 dark:text-neutral-500',
    none: 'bg-transparent text-neutral-300 dark:text-neutral-600',
  };

  const statusDots = {
    open: 'bg-emerald-500',
    partial: 'bg-amber-500',
    full: 'bg-rose-500',
    suspended: 'bg-rose-500',
    event: 'bg-sky-500',
    custom: 'bg-violet-500',
    closed: '',
    none: '',
  };

  // Compute fill ratio for capacity bar
  const getFillRatio = (dateStr) => {
    const info = bookedSlots[dateStr];
    if (!info || info.isClosed || info.isSuspended) return 0;
    const totalCapacity = (info.morningAllowed || 0) + (info.afternoonAllowed || 0);
    const totalBooked = (info.morningBooked || 0) + (info.afternoonBooked || 0);
    return totalCapacity > 0 ? Math.min(totalBooked / totalCapacity, 1) : 0;
  };

  const getFillBarColor = (ratio) => {
    if (ratio >= 1) return 'bg-rose-500';
    if (ratio >= 0.7) return 'bg-amber-500';
    if (ratio > 0) return 'bg-emerald-500';
    return 'bg-neutral-200 dark:bg-neutral-600';
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
    const info = bookedSlots[dateStr];
    const currentValue = session === 'morning'
      ? (info?.morningAllowed ?? slotDefaults?.morning ?? 0)
      : (info?.afternoonAllowed ?? slotDefaults?.afternoon ?? 0);
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
      const val = editValue === '' || editValue == null ? 0 : Number(editValue);
      await onEditSessionLimit(editPopup.dateStr, editPopup.session, val);
      setEditPopup(null);
    } catch (err) {
      console.error('Failed to save session limit:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
      {/* Month navigation */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-secondary-600 dark:text-neutral-300" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-secondary-600 dark:text-neutral-300" />
          </button>
        </div>
        <h3 className="text-base font-bold text-secondary-800 dark:text-white tracking-wide">
          {monthNames[month]} {year}
        </h3>
        {!isCurrentMonth && (
          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors border border-primary-200 dark:border-primary-800"
          >
            Today
          </button>
        )}
        {isCurrentMonth && <div className="w-14" />}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 bg-neutral-50 dark:bg-neutral-750 border-b border-neutral-200 dark:border-neutral-700">
        {dayLabels.map((label) => (
          <div key={label} className="text-center py-2 text-xs sm:text-sm font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
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
              <div key={`other-${idx}`} className="p-1 sm:p-1.5 min-h-[60px] sm:min-h-[80px] border-b border-r border-neutral-100 dark:border-neutral-700/50 bg-neutral-25 dark:bg-neutral-800/50">
                <span className="text-xs sm:text-sm text-neutral-300 dark:text-neutral-600">{cell.day}</span>
              </div>
            );
          }

          const status = getDayStatus(cell.dateStr);
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const isAvailable = status !== 'closed' && status !== 'none';
          const slotInfo = bookedSlots[cell.dateStr];
          const fillRatio = getFillRatio(cell.dateStr);

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr, isAvailable)}
              className={`p-1 sm:p-1.5 min-h-[60px] sm:min-h-[80px] border-b border-r border-neutral-100 dark:border-neutral-700/50 cursor-pointer transition-all relative group ${
                isSelected
                  ? 'ring-2 ring-primary-500 ring-inset bg-primary-50/80 dark:bg-primary-900/20'
                  : statusColors[status]
              }`}
            >
              {/* Date number row */}
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm sm:text-base font-bold leading-none ${
                  isToday
                    ? 'bg-primary-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center'
                    : isSelected
                      ? 'text-primary-700 dark:text-primary-400'
                      : ''
                }`}>
                  {cell.day}
                </span>
                <div className="flex items-center gap-0.5">
                  {slotInfo?.isCustomDate && (
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-violet-500" title="Custom date" />
                  )}
                  {statusDots[status] && !slotInfo?.isCustomDate && (
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusDots[status]}`} />
                  )}
                </div>
              </div>

              {/* Morning/Afternoon counts - compact chips */}
              {status !== 'closed' && status !== 'none' && slotInfo && !slotInfo.isSuspended && (
                <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5">
                  {/* Morning chip */}
                  <button
                    onClick={(e) => handleSessionClick(e, cell.dateStr, 'morning')}
                    className="flex-1 flex items-center justify-center gap-0.5 px-0.5 py-0.5 sm:py-1 rounded-md bg-white/60 dark:bg-neutral-700/60 border border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all group/btn"
                    title="Click to edit morning limit"
                  >
                    <Sun className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-xs sm:text-xs font-bold text-secondary-700 dark:text-neutral-200 group-hover/btn:text-amber-600 dark:group-hover/btn:text-amber-400 tabular-nums">
                      {slotInfo.morningBooked}/{slotInfo.morningAllowed}
                    </span>
                  </button>
                  {/* Afternoon chip */}
                  <button
                    onClick={(e) => handleSessionClick(e, cell.dateStr, 'afternoon')}
                    className="flex-1 flex items-center justify-center gap-0.5 px-0.5 py-0.5 sm:py-1 rounded-md bg-white/60 dark:bg-neutral-700/60 border border-indigo-200/80 dark:border-indigo-800/50 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all group/btn"
                    title="Click to edit afternoon limit"
                  >
                    <Moon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                    <span className="text-xs sm:text-xs font-bold text-secondary-700 dark:text-neutral-200 group-hover/btn:text-indigo-600 dark:group-hover/btn:text-indigo-400 tabular-nums">
                      {slotInfo.afternoonBooked}/{slotInfo.afternoonAllowed}
                    </span>
                  </button>
                </div>
              )}

              {slotInfo?.isSuspended && (
                <p className="text-xs sm:text-xs text-rose-500 dark:text-rose-400 mt-1 font-semibold">Suspended</p>
              )}
              {slotInfo?.event && !slotInfo?.isSuspended && (
                <p className="text-xs sm:text-xs text-sky-600 dark:text-sky-400 mt-0.5 truncate hidden sm:block font-medium">
                  {slotInfo.event.name}
                </p>
              )}

              {/* Capacity utilization bar */}
              {isAvailable && slotInfo && !slotInfo.isSuspended && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-neutral-100 dark:bg-neutral-700">
                  <div
                    className={`h-full transition-all duration-300 ${getFillBarColor(fillRatio)}`}
                    style={{ width: `${Math.max(fillRatio * 100, fillRatio > 0 ? 4 : 0)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Inline Edit Popup */}
        {editPopup && (
          <div
            ref={popupRef}
            className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl p-3.5 min-w-[200px]"
            style={{
              left: `${editPopup.x}px`,
              top: `${editPopup.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  editPopup.session === 'morning'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-indigo-100 dark:bg-indigo-900/30'
                }`}>
                  {editPopup.session === 'morning' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-secondary-800 dark:text-white capitalize block leading-tight">
                    {editPopup.session} Limit
                  </span>
                  <span className="text-xs text-secondary-500 dark:text-neutral-400 leading-tight">
                    {new Date(editPopup.dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditPopup(null)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-secondary-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={editValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') { setEditValue(''); return; }
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num >= 0) setEditValue(num);
                }}
                onBlur={() => { if (editValue === '' || editValue == null) setEditValue(0); }}
                className="flex-1 px-3 py-2 text-base font-bold text-center border border-neutral-200 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSession();
                  if (e.key === 'Escape') setEditPopup(null);
                }}
              />
              <button
                onClick={handleSaveSession}
                disabled={saving}
                className="px-3.5 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mr-1">Status</span>
        {[
          { color: 'bg-emerald-500', label: 'Open' },
          { color: 'bg-amber-500', label: 'Filling (>70%)' },
          { color: 'bg-rose-500', label: 'Full' },
          { color: 'bg-sky-500', label: 'Event' },
          { color: 'bg-violet-500', label: 'Custom Date' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color} ring-1 ring-black/5`} />
            <span className="text-xs sm:text-xs text-secondary-600 dark:text-neutral-400 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
