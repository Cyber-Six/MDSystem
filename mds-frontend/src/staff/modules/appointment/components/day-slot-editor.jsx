import React, { useState, useEffect } from 'react';

/**
 * Day Slot Editor Component
 * Right-side panel — read-only by default, edit mode on button click
 * SRS §3.4.2 — Medical (default 60/60), Dental (default 1/1)
 */
const DaySlotEditor = ({ selectedDate, slotDefaults, dayOverride, onSave, onCreateEvent, events = [] }) => {
  const [editing, setEditing] = useState(false);
  const [medicalMorning, setMedicalMorning] = useState(slotDefaults.medical.morning);
  const [medicalAfternoon, setMedicalAfternoon] = useState(slotDefaults.medical.afternoon);
  const [dentalMorning, setDentalMorning] = useState(slotDefaults.dental.morning);
  const [dentalAfternoon, setDentalAfternoon] = useState(slotDefaults.dental.afternoon);
  const [dayStatus, setDayStatus] = useState('open');
  const [notes, setNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Resolve display values: override > defaults
  const displayMedMorning = dayOverride?.medical?.morning ?? slotDefaults.medical.morning;
  const displayMedAfternoon = dayOverride?.medical?.afternoon ?? slotDefaults.medical.afternoon;
  const displayDenMorning = dayOverride?.dental?.morning ?? slotDefaults.dental.morning;
  const displayDenAfternoon = dayOverride?.dental?.afternoon ?? slotDefaults.dental.afternoon;
  const displayStatus = dayOverride?.status ?? 'open';

  // Reset to view mode when date changes, initialise from override if exists
  useEffect(() => {
    setEditing(false);
    setMedicalMorning(dayOverride?.medical?.morning ?? slotDefaults.medical.morning);
    setMedicalAfternoon(dayOverride?.medical?.afternoon ?? slotDefaults.medical.afternoon);
    setDentalMorning(dayOverride?.dental?.morning ?? slotDefaults.dental.morning);
    setDentalAfternoon(dayOverride?.dental?.afternoon ?? slotDefaults.dental.afternoon);
    setDayStatus(dayOverride?.status ?? 'open');
    setNotes(dayOverride?.notes ?? '');
    setHasChanges(false);
  }, [selectedDate, slotDefaults, dayOverride]);

  const handleChange = (setter) => (e) => {
    setter(parseInt(e.target.value) || 0);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave?.({
      date: selectedDate,
      medical: { morning: medicalMorning, afternoon: medicalAfternoon },
      dental: { morning: dentalMorning, afternoon: dentalAfternoon },
      status: dayStatus,
      notes,
    });
    setHasChanges(false);
    setEditing(false);
  };

  const handleReset = () => {
    setMedicalMorning(slotDefaults.medical.morning);
    setMedicalAfternoon(slotDefaults.medical.afternoon);
    setDentalMorning(slotDefaults.dental.morning);
    setDentalAfternoon(slotDefaults.dental.afternoon);
    setDayStatus('open');
    setNotes('');
    setHasChanges(false);
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
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <svg className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400 text-center">Select a date from the calendar<br />to view its details</p>
      </div>
    );
  }

  /* ─── Read-only view (default) ─── */
  if (!editing) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Header */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Day Details</h3>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{formatDate(selectedDate)}</p>
        </div>

        <div className="p-3 space-y-3">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-secondary-500 dark:text-neutral-400">Status</span>
            <span className={`text-xs font-semibold capitalize ${
              displayStatus === 'open' ? 'text-success-600 dark:text-success-400' :
              displayStatus === 'suspended' ? 'text-error-600 dark:text-error-400' :
              'text-warning-600 dark:text-warning-400'
            }`}>{displayStatus === 'open' ? 'Open' : displayStatus === 'suspended' ? 'Suspended' : 'Event Override'}</span>
          </div>

          <hr className="border-neutral-100 dark:border-neutral-700" />

          {/* Medical Slots */}
          <div>
            <p className="text-xs font-medium text-secondary-600 dark:text-neutral-300 flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-500" />
              Medical Slots
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2 text-center">
                <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayMedMorning}</p>
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Morning</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2 text-center">
                <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayMedAfternoon}</p>
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Afternoon</p>
              </div>
            </div>
          </div>

          {/* Dental Slots */}
          <div>
            <p className="text-xs font-medium text-secondary-600 dark:text-neutral-300 flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Dental Slots
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2 text-center">
                <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayDenMorning}</p>
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Morning</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/40 rounded-md px-3 py-2 text-center">
                <p className="text-lg font-bold text-secondary-800 dark:text-white">{displayDenAfternoon}</p>
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Afternoon</p>
              </div>
            </div>
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
            Edit Day Details
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
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Edit Day Details</h3>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{formatDate(selectedDate)}</p>
        </div>
        <button
          onClick={() => { setEditing(false); handleReset(); }}
          className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Day Status */}
        <div>
          <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Status</label>
          <select
            value={dayStatus}
            onChange={(e) => { setDayStatus(e.target.value); setHasChanges(true); }}
            className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="open">Open</option>
            <option value="suspended">Suspended (No Service)</option>
            <option value="event">Event Override</option>
          </select>
        </div>

        {dayStatus !== 'suspended' && (
          <>
            {/* Medical Slots */}
            <div>
              <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-2 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-500" />
                Medical Slots
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Morning</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setMedicalMorning(Math.max(0, medicalMorning - 5)); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <input type="number" value={medicalMorning} onChange={handleChange(setMedicalMorning)} className="w-full text-center px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" min={0} />
                    <button onClick={() => { setMedicalMorning(medicalMorning + 5); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Afternoon</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setMedicalAfternoon(Math.max(0, medicalAfternoon - 5)); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <input type="number" value={medicalAfternoon} onChange={handleChange(setMedicalAfternoon)} className="w-full text-center px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" min={0} />
                    <button onClick={() => { setMedicalAfternoon(medicalAfternoon + 5); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dental Slots */}
            <div>
              <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-2 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Dental Slots
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Morning</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setDentalMorning(Math.max(0, dentalMorning - 1)); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <input type="number" value={dentalMorning} onChange={handleChange(setDentalMorning)} className="w-full text-center px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" min={0} />
                    <button onClick={() => { setDentalMorning(dentalMorning + 1); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Afternoon</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setDentalAfternoon(Math.max(0, dentalAfternoon - 1)); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <input type="number" value={dentalAfternoon} onChange={handleChange(setDentalAfternoon)} className="w-full text-center px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" min={0} />
                    <button onClick={() => { setDentalAfternoon(dentalAfternoon + 1); setHasChanges(true); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-secondary-500 dark:text-neutral-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }}
            rows={2}
            placeholder="Reason for changes..."
            className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              hasChanges
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            Save Changes
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Create Event shortcut */}
        <button
          onClick={() => onCreateEvent?.(selectedDate)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-800 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Event for This Date
        </button>
      </div>
    </div>
  );
};

export default DaySlotEditor;
