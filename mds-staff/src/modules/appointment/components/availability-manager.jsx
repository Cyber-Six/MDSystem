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

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Scheduler modal (for creating new)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [editingScheduler, setEditingScheduler] = useState(null);

  // Derive slot defaults from the active scheduler
  const slotDefaults = activeScheduler
    ? {
        medical: { morning: activeScheduler.morningAllowed, afternoon: activeScheduler.afternoonAllowed },
        dental: { morning: 1, afternoon: 1 },
      }
    : { medical: { morning: 60, afternoon: 60 }, dental: { morning: 1, afternoon: 1 } };

  // Load schedulers from API
  const loadSchedulers = useCallback(async (preserveId = null) => {
    try {
      const list = await listAllSchedulers();
      setSchedulers(list || []);
      if (list?.length > 0) {
        const kept = preserveId ? list.find((s) => String(s.id) === String(preserveId)) : null;
        setActiveScheduler(kept || list[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSchedulers();
  }, [loadSchedulers]);

  // Initialize edit form when active scheduler changes
  useEffect(() => {
    if (activeScheduler) {
      setEditForm({
        morningAllowed: activeScheduler.morningAllowed,
        afternoonAllowed: activeScheduler.afternoonAllowed,
        schedulePerWeek: activeScheduler.schedulePerWeek || [],
        isActive: activeScheduler.isActive,
      });
    }
  }, [activeScheduler]);

  const [events, setEvents] = useState([]);

  const handleSaveDay = async (dayData) => {
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

  const handleOpenSchedulerModal = (scheduler = null) => {
    setEditingScheduler(scheduler);
    setShowSchedulerModal(true);
  };

  const handleSaveScheduler = async (formData, pendingReqs) => {
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
  };

  const handleDeleteScheduler = async (schedulerId) => {
    try {
      await deleteScheduler(schedulerId);
      await loadSchedulers();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Inline save handler
  const handleInlineSave = async () => {
    if (!activeScheduler) return;
    try {
      await updateScheduler(activeScheduler.id, {
        morningAllowed: editForm.morningAllowed,
        afternoonAllowed: editForm.afternoonAllowed,
        schedulePerWeek: editForm.schedulePerWeek,
        isActive: editForm.isActive,
      });
      await loadSchedulers(activeScheduler.id);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleDay = (day) => {
    setEditForm((prev) => ({
      ...prev,
      schedulePerWeek: prev.schedulePerWeek.includes(day)
        ? prev.schedulePerWeek.filter((d) => d !== day)
        : [...prev.schedulePerWeek, day],
    }));
  };

  const typeStyle = {};

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Active Scheduler - Main Display */}
      {activeScheduler ? (
        <div className={`bg-white dark:bg-neutral-800 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 shadow-sm`}>
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-secondary-900 dark:text-white truncate">
                    {activeScheduler.label}
                  </h2>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    activeScheduler.isActive
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}>
                    {activeScheduler.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-secondary-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {activeScheduler.location}
                  </span>
                  {activeScheduler.patientType && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      activeScheduler.patientType === 'Employee'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {activeScheduler.patientType}s Only
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Quick Edit
                    </button>
                    <button
                      onClick={() => handleOpenSchedulerModal(activeScheduler)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Full Settings
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          morningAllowed: activeScheduler.morningAllowed,
                          afternoonAllowed: activeScheduler.afternoonAllowed,
                          schedulePerWeek: activeScheduler.schedulePerWeek || [],
                          isActive: activeScheduler.isActive,
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInlineSave}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-success-500 hover:bg-success-600 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Slot Configuration */}
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Slots */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-3">Daily Slot Capacity</h3>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1.5 block">Morning Slots</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditForm(p => ({ ...p, morningAllowed: Math.max(0, p.morningAllowed - 5) }))}
                          className="p-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md text-secondary-600 dark:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          value={editForm.morningAllowed}
                          onChange={(e) => setEditForm(p => ({ ...p, morningAllowed: parseInt(e.target.value) || 0 }))}
                          className="flex-1 text-center text-lg font-bold px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          min={0}
                        />
                        <button
                          onClick={() => setEditForm(p => ({ ...p, morningAllowed: p.morningAllowed + 5 }))}
                          className="p-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md text-secondary-600 dark:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1.5 block">Afternoon Slots</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditForm(p => ({ ...p, afternoonAllowed: Math.max(0, p.afternoonAllowed - 5) }))}
                          className="p-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md text-secondary-600 dark:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          value={editForm.afternoonAllowed}
                          onChange={(e) => setEditForm(p => ({ ...p, afternoonAllowed: parseInt(e.target.value) || 0 }))}
                          className="flex-1 text-center text-lg font-bold px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          min={0}
                        />
                        <button
                          onClick={() => setEditForm(p => ({ ...p, afternoonAllowed: p.afternoonAllowed + 5 }))}
                          className="p-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md text-secondary-600 dark:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-accent-50 dark:bg-accent-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-xs font-medium text-accent-600 dark:text-accent-400 uppercase">Morning</span>
                      </div>
                      <p className="text-3xl font-bold text-accent-700 dark:text-accent-400">{activeScheduler.morningAllowed}</p>
                      <p className="text-xs text-accent-500 dark:text-accent-500">slots per day</p>
                    </div>
                    <div className="bg-warning-50 dark:bg-warning-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                        <span className="text-xs font-medium text-warning-600 dark:text-warning-400 uppercase">Afternoon</span>
                      </div>
                      <p className="text-3xl font-bold text-warning-700 dark:text-warning-400">{activeScheduler.afternoonAllowed}</p>
                      <p className="text-xs text-warning-500 dark:text-warning-500">slots per day</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule Days */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-3">Available Days</h3>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                          editForm.schedulePerWeek.includes(day)
                            ? 'bg-primary-500 text-white shadow-md'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-400 dark:text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const isActive = activeScheduler.schedulePerWeek?.includes(day);
                      return (
                        <div
                          key={day}
                          className={`px-4 py-2.5 text-sm font-medium rounded-lg ${
                            isActive
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                              : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-400 dark:text-neutral-500 line-through'
                          }`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                )}
                {isEditing && (
                  <label className="flex items-center gap-2 mt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                      className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-secondary-700 dark:text-neutral-300">Scheduler is Active</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-secondary-700 dark:text-neutral-300 mb-2">No Scheduler Selected</h3>
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
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <AvailabilityCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          events={events}
          slotDefaults={slotDefaults}
          activeScheduler={activeScheduler}
        />
      </div>

      {/* All Schedulers List */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">All Schedulers</h3>
          <button
            onClick={() => handleOpenSchedulerModal(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scheduler
          </button>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
          {schedulers.length > 0 ? (
            schedulers.map((sched) => {
              const isSelected = activeScheduler?.id === sched.id;
              return (
                <div
                  key={sched.id}
                  onClick={() => setActiveScheduler(sched)}
                  className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${sched.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                    <div className="min-w-0">
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
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenSchedulerModal(sched); }}
                    className="p-2 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-secondary-500 dark:text-neutral-400">No schedulers configured</p>
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
