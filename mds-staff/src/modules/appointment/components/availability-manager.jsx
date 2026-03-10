import React, { useState, useEffect, useCallback } from 'react';
import AvailabilityCalendar from './availability-calendar';
import DaySlotEditor from './day-slot-editor';
import EventModal from './event-modal';
import SchedulerModal from './scheduler-modal';
import {
  listAllSchedulers,
  createScheduler,
  updateScheduler,
  deleteScheduler,
  updateRequirement,
  updateDateIdentity,
} from '../staff-appointment-service';

/**
 * Availability Manager Component
 * Calendar + Day Detail Panel side by side
 * Manages slot capacities, event overrides, and scheduling rules
 * SRS §3.4.2
 */
const AvailabilityManager = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalDate, setEventModalDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [dayOverrides, setDayOverrides] = useState({}); // { [date]: { medical, dental, status, notes } }
  const [schedulers, setSchedulers] = useState([]);
  const [activeScheduler, setActiveScheduler] = useState(null);
  const [error, setError] = useState('');

  // Scheduler modal
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [editingScheduler, setEditingScheduler] = useState(null);

  // Derive slot defaults from the first active scheduler (or fallback)
  const slotDefaults = activeScheduler
    ? {
        medical: { morning: activeScheduler.morningAllowed, afternoon: activeScheduler.afternoonAllowed },
        dental: { morning: 1, afternoon: 1 },
      }
    : { medical: { morning: 60, afternoon: 60 }, dental: { morning: 1, afternoon: 1 } };

  // Load schedulers from API
  const loadSchedulers = useCallback(async () => {
    try {
      const list = await listAllSchedulers();
      setSchedulers(list || []);
      if (list?.length > 0) setActiveScheduler(list[0]);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSchedulers();
  }, [loadSchedulers]);

  // TODO: Load events from API (ScheduleDateEntity / slotScheduler override records)
  const [events, setEvents] = useState([]);

  const handleSaveDay = async (dayData) => {
    // Persist to backend via updateDateIdentity
    if (activeScheduler && dayData.date) {
      try {
        await updateDateIdentity(activeScheduler.id, dayData.date, {
          morningAllowed: dayData.medical?.morning,
          afternoonAllowed: dayData.medical?.afternoon,
          scheduledDate: dayData.date,
        });
      } catch (err) {
        setError(err.message);
      }
    }
    // Store override locally so view mode reflects saved values
    setDayOverrides((prev) => ({ ...prev, [dayData.date]: dayData }));
  };

  const handleCreateEvent = (date) => {
    setEventModalDate(date);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = (eventData) => {
    setEvents((prev) => {
      const existing = prev.findIndex((e) => e.id === eventData.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = eventData;
        return updated;
      }
      return [...prev, eventData];
    });
  };

  const handleDeleteEvent = (eventId) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const handleOpenSchedulerModal = (scheduler = null) => {
    setEditingScheduler(scheduler);
    setShowSchedulerModal(true);
  };

  const handleSaveScheduler = async (formData, pendingReqs) => {
    try {
      if (formData.id) {
        // Update existing
        await updateScheduler(formData.id, {
          label: formData.label,
          location: formData.location,
          schedulePerWeek: formData.schedulePerWeek,
          morningAllowed: formData.morningAllowed,
          afternoonAllowed: formData.afternoonAllowed,
          notes: formData.notes || null,
          isActive: formData.isActive,
          whitelistOnly: formData.whitelistOnly,
        });
      } else {
        // Create new
        const created = await createScheduler({
          label: formData.label,
          location: formData.location,
          schedulePerWeek: formData.schedulePerWeek,
          morningAllowed: formData.morningAllowed,
          afternoonAllowed: formData.afternoonAllowed,
          notes: formData.notes || null,
          whitelistOnly: formData.whitelistOnly ?? false,
          slotCustomDates: [],
          whiteLists: [],
        });
        // Save any pending requirements for the new scheduler
        if (pendingReqs?.length > 0 && created?.id) {
          for (const req of pendingReqs) {
            await updateRequirement(created.id, { label: req.label, isDigital: true, isActive: true });
          }
        }
      }
      await loadSchedulers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteScheduler = async (schedulerId) => {
    if (!window.confirm('Are you sure you want to delete this scheduler?')) return;
    try {
      await deleteScheduler(schedulerId);
      await loadSchedulers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Scheduler Selector + Default Slots Summary */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        {schedulers.length > 1 && (
          <div className="mb-3">
            <label className="text-xs font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Active Scheduler</label>
            <select
              value={activeScheduler?.id || ''}
              onChange={(e) => setActiveScheduler(schedulers.find((s) => s.id === e.target.value) || null)}
              className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {schedulers.map((s) => (
                <option key={s.id} value={s.id}>{s.label} — {s.location}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
            {activeScheduler ? `${activeScheduler.label} — Slots` : 'Default Slot Configuration'}
          </h3>
          <span className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase tracking-wider">
            {activeScheduler?.location || ''}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-accent-50 dark:bg-accent-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-accent-700 dark:text-accent-400">{slotDefaults.medical.morning}</p>
            <p className="text-[10px] text-accent-600 dark:text-accent-400">Medical AM</p>
          </div>
          <div className="bg-accent-50 dark:bg-accent-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-accent-700 dark:text-accent-400">{slotDefaults.medical.afternoon}</p>
            <p className="text-[10px] text-accent-600 dark:text-accent-400">Medical PM</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{slotDefaults.dental.morning}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">Dental AM</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{slotDefaults.dental.afternoon}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">Dental PM</p>
          </div>
        </div>
      </div>

      {/* Calendar + Day Editor */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <AvailabilityCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            events={events}
            slotDefaults={slotDefaults}
          />
        </div>
        <div>
          <DaySlotEditor
            selectedDate={selectedDate}
            slotDefaults={slotDefaults}
            dayOverride={selectedDate ? dayOverrides[selectedDate] : null}
            onSave={handleSaveDay}
            onCreateEvent={handleCreateEvent}
            events={events}
          />
        </div>
      </div>

      {/* Active Schedulers List */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Active Schedulers</h3>
          <button
            onClick={() => handleOpenSchedulerModal(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scheduler
          </button>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {schedulers.length > 0 ? (
            schedulers.map((sched) => (
              <div key={sched.id} className="px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sched.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                  <span className="text-sm font-medium text-secondary-800 dark:text-white truncate">{sched.label}</span>
                  <span className="text-xs text-secondary-400 dark:text-neutral-500">·</span>
                  <span className="text-xs text-secondary-500 dark:text-neutral-400 whitespace-nowrap">
                    {sched.location} · AM {sched.morningAllowed} · PM {sched.afternoonAllowed}
                    {sched.schedulePerWeek?.length > 0 && ` · ${sched.schedulePerWeek.map((d) => d.slice(0, 3)).join(', ')}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenSchedulerModal(sched)}
                    className="p-1.5 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteScheduler(sched.id)}
                    className="p-1.5 text-error-400 hover:text-error-600 dark:text-error-500 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-secondary-500 dark:text-neutral-400">No schedulers configured</p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Create a scheduler to start managing appointments</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        initialDate={eventModalDate}
        editingEvent={editingEvent}
      />

      {/* Scheduler Modal */}
      <SchedulerModal
        isOpen={showSchedulerModal}
        onClose={() => { setShowSchedulerModal(false); setEditingScheduler(null); }}
        onSave={handleSaveScheduler}
        onDelete={handleDeleteScheduler}
        editingScheduler={editingScheduler}
      />
    </div>
  );
};

export default AvailabilityManager;
