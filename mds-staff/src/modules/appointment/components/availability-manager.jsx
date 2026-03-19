import React, { useState, useEffect, useCallback } from 'react';
import AvailabilityCalendar from './availability-calendar';
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Availability Manager Component
 * Redesigned for better UX - bigger scheduler display with inline editing
 * SRS §3.4.2
 */
const AvailabilityManager = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalDate, setEventModalDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [dayOverrides, setDayOverrides] = useState({});
  const [schedulers, setSchedulers] = useState([]);
  const [activeScheduler, setActiveScheduler] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Scheduler modal (for creating new)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [editingScheduler, setEditingScheduler] = useState(null);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);

  // Derive slot defaults from the active scheduler
  const slotDefaults = activeScheduler
    ? { morning: activeScheduler.morningAllowed, afternoon: activeScheduler.afternoonAllowed }
    : { morning: 60, afternoon: 60 };

  // Load schedulers from API
  const loadSchedulers = useCallback(async (preserveId = null) => {
    setLoading(true);
    setError('');
    try {
      const list = await listAllSchedulers();
      setSchedulers(list || []);
      if (list?.length > 0) {
        const kept = preserveId ? list.find((s) => String(s.id) === String(preserveId)) : null;
        setActiveScheduler(kept || list[0]);
      } else {
        setActiveScheduler(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load schedulers');
      console.error('Error loading schedulers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedulers();
  }, [loadSchedulers]);

  const [events, setEvents] = useState([]);

  const handleSaveDay = async (dayData) => {
    if (activeScheduler && dayData.date) {
      try {
        await updateDateIdentity(activeScheduler.id, dayData.date, {
          morningAllowed: dayData.morning,
          afternoonAllowed: dayData.afternoon,
          scheduledDate: dayData.date,
        });
        setDayOverrides((prev) => ({ ...prev, [dayData.date]: dayData }));
      } catch (err) {
        setError(err.message || 'Failed to update date');
        console.error('Error updating date identity:', err);
      }
    }
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

  const handleOpenSchedulerModal = (scheduler = null) => {
    setEditingScheduler(scheduler);
    setShowSchedulerModal(true);
  };

  const handleSaveScheduler = async (formData, pendingReqs) => {
    setSaving(true);
    setError('');
    try {
      if (formData.id) {
        const updated = await updateScheduler(formData.id, {
          label: formData.label,
          location: formData.location,
          patientType: formData.patientType ?? null,
          schedulePerWeek: formData.schedulePerWeek,
          morningAllowed: formData.morningAllowed,
          afternoonAllowed: formData.afternoonAllowed,
          notes: formData.notes || null,
          isActive: formData.isActive,
          whitelistOnly: formData.whitelistOnly,
        });
        await loadSchedulers(updated?.id ?? formData.id);
      } else {
        const created = await createScheduler({
          label: formData.label,
          location: formData.location,
          patientType: formData.patientType ?? null,
          schedulePerWeek: formData.schedulePerWeek,
          morningAllowed: formData.morningAllowed,
          afternoonAllowed: formData.afternoonAllowed,
          notes: formData.notes || null,
          whitelistOnly: formData.whitelistOnly ?? false,
          slotCustomDates: [],
          whiteLists: [],
        });
        if (pendingReqs?.length > 0 && created?.id) {
          for (const req of pendingReqs) {
            await updateRequirement(created.id, { label: req.label, isDigital: true, isActive: true });
          }
        }
        await loadSchedulers(created?.id);
      }
      setShowSchedulerModal(false);
      setEditingScheduler(null);
    } catch (err) {
      setError(err.message || 'Failed to save scheduler');
      console.error('Error saving scheduler:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScheduler = async (schedulerId) => {
    setSaving(true);
    setError('');
    try {
      await deleteScheduler(schedulerId);
      await loadSchedulers();
      setShowSchedulerModal(false);
      setEditingScheduler(null);
    } catch (err) {
      setError(err.message || 'Failed to delete scheduler');
      console.error('Error deleting scheduler:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading schedulers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Scheduler Selector Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Scheduler Dropdown */}
            <div className="relative flex-1 w-full sm:w-auto">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {activeScheduler ? (
                    <>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeScheduler.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-secondary-900 dark:text-white truncate">{activeScheduler.label}</p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate">
                          {activeScheduler.location} • AM {activeScheduler.morningAllowed} • PM {activeScheduler.afternoonAllowed}
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="text-secondary-500 dark:text-neutral-400">Select a scheduler...</span>
                  )}
                </div>
                <svg className={`w-5 h-5 text-secondary-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {schedulers.length > 0 ? (
                    schedulers.map((sched) => {
                      const isSelected = activeScheduler?.id === sched.id;
                      return (
                        <button
                          key={sched.id}
                          onClick={() => { setActiveScheduler(sched); setShowDropdown(false); }}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
                            isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sched.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium truncate ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-secondary-800 dark:text-white'}`}>
                                {sched.label}
                              </span>
                              {sched.patientType && (
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                  sched.patientType === 'Employee'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                }`}>
                                  {sched.patientType}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                              {sched.location} • AM {sched.morningAllowed} • PM {sched.afternoonAllowed}
                              {sched.schedulePerWeek?.length > 0 && ` • ${sched.schedulePerWeek.map((d) => d.slice(0, 3)).join(', ')}`}
                            </p>
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-secondary-500 dark:text-neutral-400">
                      No schedulers configured
                    </div>
                  )}
                  {/* Add New Scheduler Option */}
                  <button
                    onClick={() => { handleOpenSchedulerModal(null); setShowDropdown(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left border-t border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    <span className="font-medium text-primary-600 dark:text-primary-400">Create New Scheduler</span>
                  </button>
                </div>
              )}
            </div>

            {/* Settings Button */}
            {activeScheduler && (
              <button
                onClick={() => handleOpenSchedulerModal(activeScheduler)}
                className="px-4 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
            )}
          </div>

          {/* Compact Info Bar */}
          {activeScheduler && (
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {/* Slots Info */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-accent-600 dark:text-accent-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="font-medium">AM: {activeScheduler.morningAllowed}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-warning-600 dark:text-warning-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span className="font-medium">PM: {activeScheduler.afternoonAllowed}</span>
                  </div>
                </div>
                {/* Divider */}
                <span className="hidden sm:inline text-neutral-300 dark:text-neutral-600">|</span>
                {/* Days */}
                <div className="flex items-center gap-1.5">
                  {DAYS.map((day) => {
                    const isActive = activeScheduler.schedulePerWeek?.includes(day);
                    return (
                      <span
                        key={day}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 line-through'
                        }`}
                      >
                        {day.slice(0, 2)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* No Scheduler State */}
      {!activeScheduler && schedulers.length === 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-secondary-700 dark:text-neutral-300 mb-2">No Schedulers</h3>
          <p className="text-sm text-secondary-500 dark:text-neutral-400 mb-4">Create a scheduler to start managing appointments</p>
          <button
            onClick={() => handleOpenSchedulerModal(null)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Create Scheduler
          </button>
        </div>
      )}

      {/* Calendar */}
      {activeScheduler && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <AvailabilityCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            events={events}
            slotDefaults={slotDefaults}
            activeScheduler={activeScheduler}
          />
        </div>
      )}

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
        saving={saving}
      />
    </div>
  );
};

export default AvailabilityManager;
