import React, { useState, useEffect } from 'react';

/**
 * Day Slot Editor Component
 * Right-side panel for editing slot capacity on specific dates.
 * Allows override of morning/afternoon capacity for the active scheduler.
 */
const DaySlotEditor = ({ selectedDate, scheduler, dayOverride, onSave, loading, events = [] }) => {
  const [editing, setEditing] = useState(false);
  const [morningSlots, setMorningSlots] = useState(0);
  const [afternoonSlots, setAfternoonSlots] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Default values from scheduler
  const defaultMorning = scheduler?.morningAllowed ?? 60;
  const defaultAfternoon = scheduler?.afternoonAllowed ?? 60;

  // Display values: override > defaults
  const displayMorning = dayOverride?.morningAllowed ?? defaultMorning;
  const displayAfternoon = dayOverride?.afternoonAllowed ?? defaultAfternoon;
  const displayMorningRegistered = dayOverride?.morningRegistered ?? 0;
  const displayAfternoonRegistered = dayOverride?.afternoonRegistered ?? 0;
  const displayMorningPending = dayOverride?.morningPending ?? 0;
  const displayAfternoonPending = dayOverride?.afternoonPending ?? 0;

  // Check if values are customized from defaults
  const isCustomized = dayOverride && (
    dayOverride.morningAllowed !== defaultMorning ||
    dayOverride.afternoonAllowed !== defaultAfternoon
  );

  // Reset to view mode when date changes, initialise from override if exists
  useEffect(() => {
    setEditing(false);
    setMorningSlots(dayOverride?.morningAllowed ?? defaultMorning);
    setAfternoonSlots(dayOverride?.afternoonAllowed ?? defaultAfternoon);
    setHasChanges(false);
  }, [selectedDate, scheduler, dayOverride, defaultMorning, defaultAfternoon]);

  const handleChange = (setter) => (e) => {
    setter(parseInt(e.target.value) || 0);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.({
        morningAllowed: morningSlots,
        afternoonAllowed: afternoonSlots,
      });
      setHasChanges(false);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save day override:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMorningSlots(defaultMorning);
    setAfternoonSlots(defaultAfternoon);
    setHasChanges(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Find events that overlap this date
  const dayEvents = events.filter((e) => selectedDate >= e.startDate && selectedDate <= e.endDate);

  if (!selectedDate) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col items-center justify-center min-h-[200px]">
        <svg className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400 text-center">Select a date from the calendar<br />to view and edit slot details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-3" />
        <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading day details...</p>
      </div>
    );
  }

  /* ─── Read-only view (default) ─── */
  if (!editing) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Header */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Day Details</h3>
            {isCustomized && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 rounded">
                Customized
              </span>
            )}
          </div>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{formatDate(selectedDate)}</p>
        </div>

        <div className="p-3 space-y-3">
          {/* Slot Capacity */}
          <div>
            <p className="text-xs font-medium text-secondary-600 dark:text-neutral-300 flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-primary-500" />
              Slot Capacity
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Morning</p>
                  <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayMorning}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-success-600 dark:text-success-400">{displayMorningRegistered} booked</span>
                  <span className="text-warning-600 dark:text-warning-400">{displayMorningPending} pending</span>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Afternoon</p>
                  <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayAfternoon}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-success-600 dark:text-success-400">{displayAfternoonRegistered} booked</span>
                  <span className="text-warning-600 dark:text-warning-400">{displayAfternoonPending} pending</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scheduler defaults info */}
          <div className="text-[10px] text-secondary-400 dark:text-neutral-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Default: {defaultMorning} morning / {defaultAfternoon} afternoon
          </div>

          {/* Events for this date */}
          {dayEvents.length > 0 && (
            <div>
              <hr className="border-neutral-100 dark:border-neutral-700 mb-2" />
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 mb-1.5">Events on this date</p>
              {dayEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    ev.effect === 'Suspend' ? 'bg-error-500' : ev.effect === 'Reduce' ? 'bg-warning-500' : 'bg-success-500'
                  }`} />
                  <span className="text-xs text-secondary-700 dark:text-neutral-300 font-medium">{ev.name}</span>
                  <span className="text-[10px] text-secondary-400 dark:text-neutral-500">· {ev.effect}</span>
                </div>
              ))}
            </div>
          )}

          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors mt-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Day Capacity
          </button>
        </div>
      </div>
    );
  }

  /* ─── Edit mode ─── */
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Edit Day Capacity</h3>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{formatDate(selectedDate)}</p>
        </div>
        <button
          onClick={() => { setEditing(false); }}
          className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Morning Slots */}
        <div>
          <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-2 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-500" />
            Morning Slots
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMorningSlots(Math.max(0, morningSlots - 5)); setHasChanges(true); }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              value={morningSlots}
              onChange={handleChange(setMorningSlots)}
              className="flex-1 text-center px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              min={0}
            />
            <button
              onClick={() => { setMorningSlots(morningSlots + 5); setHasChanges(true); }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Afternoon Slots */}
        <div>
          <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-2 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning-500" />
            Afternoon Slots
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setAfternoonSlots(Math.max(0, afternoonSlots - 5)); setHasChanges(true); }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              value={afternoonSlots}
              onChange={handleChange(setAfternoonSlots)}
              className="flex-1 text-center px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              min={0}
            />
            <button
              onClick={() => { setAfternoonSlots(afternoonSlots + 5); setHasChanges(true); }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Reset to defaults button */}
        <button
          onClick={handleReset}
          className="w-full text-xs text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300 py-1"
        >
          Reset to scheduler defaults ({defaultMorning}/{defaultAfternoon})
        </button>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              hasChanges && !saving
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DaySlotEditor;
