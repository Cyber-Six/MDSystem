import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Plus, Minus, X, Check, Calendar, Trash2, Clock, Ban, RotateCcw } from 'lucide-react';

/**
 * Normalize a date value (string, Date, or number) to YYYY-MM-DD format.
 */
const normalizeDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    // Already YYYY-MM-DD or ISO string — extract date portion
    return val.split('T')[0];
  }
  if (val instanceof Date || typeof val === 'number') {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
  return '';
};

/**
 * Day Slot Editor Component - Above calendar panel
 * Fixed-height, always-inline editable. No edit button needed.
 */
const DaySlotEditor = ({
  selectedDate: rawSelectedDate,
  scheduler,
  dayOverride,
  onSave,
  loading,
  events = [],
  customDates = [],
  isDateAvailable = true,
  onAddCustomDate,
  onRemoveCustomDate,
  onDisableDate,
  onResetDate,
}) => {
  const selectedDate = normalizeDate(rawSelectedDate);

  // Compute whether the selected date is strictly before today (local date)
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  const isPastDate = !!selectedDate && selectedDate < todayStr;
  const [morningSlots, setMorningSlots] = useState(0);
  const [afternoonSlots, setAfternoonSlots] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Default values from scheduler
  const defaultMorning = scheduler?.morningAllowed ?? 25;
  const defaultAfternoon = scheduler?.afternoonAllowed ?? 25;

  // Check if this date is a custom date (normalize for comparison)
  const customDateEntry = customDates.find(cd => normalizeDate(cd.scheduledDate) === selectedDate);
  const isCustomDate = !!customDateEntry;

  // Display values: override > custom date > defaults
  const displayMorning = dayOverride?.morningAllowed ?? customDateEntry?.morningAllowed ?? defaultMorning;
  const displayAfternoon = dayOverride?.afternoonAllowed ?? customDateEntry?.afternoonAllowed ?? defaultAfternoon;
  const displayMorningRegistered = dayOverride?.morningRegistered ?? 0;
  const displayAfternoonRegistered = dayOverride?.afternoonRegistered ?? 0;
  const displayMorningPending = dayOverride?.morningPending ?? 0;
  const displayAfternoonPending = dayOverride?.afternoonPending ?? 0;

  // Totals
  const totalMorning = displayMorningRegistered + displayMorningPending;
  const totalAfternoon = displayAfternoonRegistered + displayAfternoonPending;
  const morningAvailable = Math.max(0, displayMorning - totalMorning);
  const afternoonAvailable = Math.max(0, displayAfternoon - totalAfternoon);

  // Check if values are customized from defaults
  const isCustomized = dayOverride && (
    dayOverride.morningAllowed !== defaultMorning ||
    dayOverride.afternoonAllowed !== defaultAfternoon
  );

  // Track whether the user has modified the slot values
  const hasSlotChanges = morningSlots !== displayMorning || afternoonSlots !== displayAfternoon;

  // Sync slot values when date or override changes
  useEffect(() => {
    setMorningSlots(displayMorning);
    setAfternoonSlots(displayAfternoon);
  }, [selectedDate, displayMorning, displayAfternoon]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  const handleSave = async () => {
    if (!hasSlotChanges) return;
    setSaving(true);
    try {
      await onSave?.({
        morningAllowed: morningSlots,
        afternoonAllowed: afternoonSlots,
      });
    } catch (err) {
      console.error('Failed to save day override:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAsCustomDate = async () => {
    if (onAddCustomDate) {
      setSaving(true);
      try {
        await onAddCustomDate(selectedDate, defaultMorning, defaultAfternoon);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRemoveAsCustomDate = async () => {
    if (onRemoveCustomDate) {
      setSaving(true);
      try {
        await onRemoveCustomDate(selectedDate);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDisableDate = async () => {
    if (onDisableDate) {
      setSaving(true);
      try {
        await onDisableDate(selectedDate);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleResetDate = async () => {
    if (onResetDate) {
      setSaving(true);
      try {
        await onResetDate(selectedDate);
      } finally {
        setSaving(false);
      }
    }
  };

  // Check if date is explicitly disabled (both sessions = 0)
  const isExplicitlyDisabled = isDateAvailable && displayMorning === 0 && displayAfternoon === 0;

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const normalized = normalizeDate(dateStr);
    if (!normalized) return '';
    const d = new Date(normalized + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    const normalized = normalizeDate(dateStr);
    if (!normalized) return '';
    const d = new Date(normalized + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Find events that overlap this date
  const dayEvents = events.filter((e) => selectedDate >= normalizeDate(e.startDate) && selectedDate <= normalizeDate(e.endDate));

  // Slot input handler - allows empty string for typing, treats empty as 0 on blur
  const handleSlotChange = (setter) => (e) => {
    const val = e.target.value;
    if (val === '') {
      setter(0);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setter(num);
    }
  };

  // Fixed-height container - always same size regardless of state
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 h-[140px] flex flex-col">
      {/* No date selected */}
      {!selectedDate ? (
        <div className="flex-1 flex items-center justify-center px-3">
          <div className="flex items-center gap-2 text-secondary-400 dark:text-neutral-500">
            <Calendar className="w-4 h-4" />
            <p className="text-sm font-medium">Click a date on the calendar to view and edit</p>
          </div>
        </div>
      ) : loading ? (
        /* Loading */
        <div className="flex-1 flex items-center justify-center px-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading...</span>
          </div>
        </div>
      ) : !isDateAvailable && !isCustomDate ? (
        /* Closed day - enable as custom date */
        <div className="flex-1 flex flex-col justify-center px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-secondary-800 dark:text-white truncate">{formatDateShort(selectedDate)}</span>
                <span className="px-1.5 py-px text-xs font-semibold bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 rounded-full uppercase">
                  Closed
                </span>
              </div>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 ml-5">
                {isPastDate
                  ? 'Past date — cannot add, create, or change past dates.'
                  : `${getDayOfWeek(selectedDate)} is not in the regular schedule. Add it as a custom date to accept appointments.`}
              </p>
            </div>
            {!isPastDate && (
              <button
                onClick={handleAddAsCustomDate}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors disabled:opacity-50 shadow-sm flex-shrink-0 ml-2"
              >
                {saving ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add Custom Date
              </button>
            )}
          </div>
        </div>
      ) : isExplicitlyDisabled ? (
        /* Disabled day - re-enable */
        <div className="flex-1 flex flex-col justify-center px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Ban className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-secondary-800 dark:text-white truncate">{formatDateShort(selectedDate)}</span>
                <span className="px-1.5 py-px text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full uppercase">
                  Disabled
                </span>
                {isCustomDate && (
                  <span className="px-1.5 py-px text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full flex-shrink-0">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 ml-5">
                {isPastDate
                  ? 'Past date — cannot add, create, or change past dates.'
                  : 'This date is disabled. Patients cannot book appointments on this day.'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {!isPastDate && (
                <button
                  onClick={handleResetDate}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Re-enable
                </button>
              )}
              {isCustomDate && (
                <button
                  onClick={handleRemoveAsCustomDate}
                  disabled={saving}
                  className="p-1 text-error-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors disabled:opacity-50"
                  title="Remove custom date"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Active day - inline editable */
        <>
          {/* Header row */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-secondary-800 dark:text-white truncate">{formatDateShort(selectedDate)}</span>
              {isPastDate && (
                <span className="px-1.5 py-px text-xs font-semibold bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 rounded-full flex-shrink-0">
                  Past
                </span>
              )}
              {isCustomDate && (
                <span className="px-1.5 py-px text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full flex-shrink-0">
                  Custom
                </span>
              )}
              {isCustomized && !isCustomDate && (
                <span className="px-1.5 py-px text-xs font-semibold bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 rounded-full flex-shrink-0">
                  Modified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasSlotChanges && !isPastDate && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Save
                </button>
              )}
              {!isPastDate && (
                <button
                  onClick={handleDisableDate}
                  disabled={saving}
                  className="p-1 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors disabled:opacity-50"
                  title="Disable this date"
                >
                  <Ban className="w-3.5 h-3.5" />
                </button>
              )}
              {isCustomDate && (
                <button
                  onClick={handleRemoveAsCustomDate}
                  disabled={saving}
                  className="p-1 text-error-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors disabled:opacity-50"
                  title="Remove custom date"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Slot cards - compact inline editable */}
          <div className="grid grid-cols-2 gap-2 px-3 pb-2 flex-1">
            {/* Morning */}
            <div className="bg-accent-50/50 dark:bg-accent-900/10 rounded-lg px-2.5 py-1.5 border border-accent-100 dark:border-accent-900/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Sun className="w-3 h-3 text-accent-500" />
                  <span className="text-xs font-semibold text-secondary-700 dark:text-neutral-300">Morning</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => !isPastDate && setMorningSlots(Math.max(0, morningSlots - 1))}
                    disabled={isPastDate}
                    className="p-0.5 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded text-secondary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={morningSlots}
                    readOnly={isPastDate}
                    onChange={isPastDate ? undefined : handleSlotChange(setMorningSlots)}
                    className={`w-10 text-center px-1 py-0.5 text-sm font-bold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${isPastDate ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <button
                    onClick={() => !isPastDate && setMorningSlots(morningSlots + 1)}
                    disabled={isPastDate}
                    className="p-0.5 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded text-secondary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-secondary-400">
                  {displayMorningRegistered}<span className="text-secondary-300 mx-0.5">/</span>{displayMorningPending}p
                </span>
                <span className={`font-semibold ${morningAvailable === 0 ? 'text-error-500' : 'text-success-600 dark:text-success-400'}`}>
                  {morningAvailable} left
                </span>
              </div>
            </div>

            {/* Afternoon */}
            <div className="bg-warning-50/50 dark:bg-warning-900/10 rounded-lg px-2.5 py-1.5 border border-warning-100 dark:border-warning-900/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Moon className="w-3 h-3 text-warning-500" />
                  <span className="text-xs font-semibold text-secondary-700 dark:text-neutral-300">Afternoon</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => !isPastDate && setAfternoonSlots(Math.max(0, afternoonSlots - 1))}
                    disabled={isPastDate}
                    className="p-0.5 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded text-secondary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={afternoonSlots}
                    readOnly={isPastDate}
                    onChange={isPastDate ? undefined : handleSlotChange(setAfternoonSlots)}
                    className={`w-10 text-center px-1 py-0.5 text-sm font-bold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${isPastDate ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <button
                    onClick={() => !isPastDate && setAfternoonSlots(afternoonSlots + 1)}
                    disabled={isPastDate}
                    className="p-0.5 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded text-secondary-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-secondary-400">
                  {displayAfternoonRegistered}<span className="text-secondary-300 mx-0.5">/</span>{displayAfternoonPending}p
                </span>
                <span className={`font-semibold ${afternoonAvailable === 0 ? 'text-error-500' : 'text-success-600 dark:text-success-400'}`}>
                  {afternoonAvailable} left
                </span>
              </div>
            </div>
          </div>

          {/* Events indicator - compact */}
          {dayEvents.length > 0 && (
            <div className="px-3 pb-1.5 flex items-center gap-1.5 overflow-hidden">
              <Clock className="w-3 h-3 text-secondary-400 flex-shrink-0" />
              {dayEvents.map((ev) => (
                <span
                  key={ev.id}
                  className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    ev.effect === 'Suspend'
                      ? 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400'
                      : 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400'
                  }`}
                >
                  {ev.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DaySlotEditor;
