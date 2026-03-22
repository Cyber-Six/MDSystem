import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, ChevronDown, Sun, Moon, Calendar, MapPin, Users, Check, X, Trash2, Save, FileText, Trash } from 'lucide-react';
import AvailabilityCalendar from './availability-calendar';
import EventModal from './event-modal';
import WhitelistManager from './whitelist-manager';
import DaySlotEditor from './day-slot-editor';
import {
  listAllSchedulers,
  createScheduler,
  updateScheduler,
  deleteScheduler,
  updateRequirement,
  deleteRequirement,
  listAllRequirements,
  updateDateIdentity,
  listWhitelist,
  getScheduleAvailability,
} from '../staff-appointment-service';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Availability Manager Component
 * Redesigned for better UX - compact selector, inline editing, side-by-side layout
 * SRS §3.4.2
 */
const AvailabilityManager = () => {
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalDate, setEventModalDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [schedulers, setSchedulers] = useState([]);
  const [activeScheduler, setActiveScheduler] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);

  // Inline edit form state
  const [editForm, setEditForm] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [events, setEvents] = useState([]);

  // Requirements state
  const [requirements, setRequirements] = useState([]);
  const [pendingRequirements, setPendingRequirements] = useState([]); // For new scheduler
  const [requirementForm, setRequirementForm] = useState({ label: '', isActive: true });
  const [requirementSaving, setRequirementSaving] = useState(false);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Whitelist state
  const [showWhitelistPanel, setShowWhitelistPanel] = useState(false);
  const [whitelistCount, setWhitelistCount] = useState(0);

  // Day slot editor state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [dayOverrideData, setDayOverrideData] = useState(null);
  const [loadingDayData, setLoadingDayData] = useState(false);

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
        const selected = kept || list[0];
        setActiveScheduler(selected);
        setEditForm(selected);
        setIsCreatingNew(false);
      } else {
        setActiveScheduler(null);
        setEditForm(null);
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

  // Update edit form when scheduler changes
  useEffect(() => {
    if (activeScheduler && !isCreatingNew) {
      setEditForm({ ...activeScheduler });
      // Load requirements for this scheduler
      loadRequirements(activeScheduler.id);
      // Load whitelist count
      loadWhitelistCount(activeScheduler.id);
    }
  }, [activeScheduler, isCreatingNew]);

  // Load whitelist count for display
  const loadWhitelistCount = async (schedulerId) => {
    try {
      const entries = await listWhitelist(schedulerId, 0, 1000);
      setWhitelistCount(entries?.length || 0);
    } catch (err) {
      setWhitelistCount(0);
    }
  };

  // Handle calendar date selection - load day-specific data
  const handleDateSelect = async (dateStr) => {
    setSelectedCalendarDate(dateStr);
    if (!activeScheduler?.id || !dateStr) {
      setDayOverrideData(null);
      return;
    }
    setLoadingDayData(true);
    try {
      const data = await getScheduleAvailability(activeScheduler.id, dateStr);
      setDayOverrideData(data);
    } catch (err) {
      console.error('Failed to load day data:', err);
      setDayOverrideData(null);
    } finally {
      setLoadingDayData(false);
    }
  };

  // Handle saving day override
  const handleSaveDayOverride = async (input) => {
    if (!activeScheduler?.id || !selectedCalendarDate) return;
    try {
      const updated = await updateDateIdentity(activeScheduler.id, selectedCalendarDate, input);
      setDayOverrideData(updated);
    } catch (err) {
      setError(err.message || 'Failed to update day settings');
      throw err;
    }
  };

  const handleSelectScheduler = (sched) => {
    setActiveScheduler(sched);
    setEditForm({ ...sched });
    setIsCreatingNew(false);
    setShowDropdown(false);
    // Clear day slot editor state
    setSelectedCalendarDate(null);
    setDayOverrideData(null);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    // Clear day slot editor state
    setSelectedCalendarDate(null);
    setDayOverrideData(null);
    setEditForm({
      label: '',
      location: 'Arlegui',
      patientType: null,
      schedulePerWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      morningAllowed: 60,
      afternoonAllowed: 60,
      notes: '',
      isActive: true,
      whitelistOnly: false,
    });
    setRequirements([]);
    setPendingRequirements([]);
    setRequirementForm({ label: '', isActive: true });
    setShowDropdown(false);
  };

  const handleSaveScheduler = async () => {
    if (!editForm) return;
    if (!editForm.label?.trim()) {
      setError('Scheduler name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editForm.id) {
        // Update existing
        const updated = await updateScheduler(editForm.id, {
          label: editForm.label,
          location: editForm.location,
          patientType: editForm.patientType ?? null,
          schedulePerWeek: editForm.schedulePerWeek,
          morningAllowed: editForm.morningAllowed,
          afternoonAllowed: editForm.afternoonAllowed,
          notes: editForm.notes || null,
          isActive: editForm.isActive,
          whitelistOnly: editForm.whitelistOnly,
        });
        await loadSchedulers(updated?.id ?? editForm.id);
      } else {
        // Create new
        const created = await createScheduler({
          label: editForm.label,
          location: editForm.location,
          patientType: editForm.patientType ?? null,
          schedulePerWeek: editForm.schedulePerWeek,
          morningAllowed: editForm.morningAllowed,
          afternoonAllowed: editForm.afternoonAllowed,
          notes: editForm.notes || null,
          whitelistOnly: editForm.whitelistOnly ?? false,
          slotCustomDates: [],
          whiteLists: [],
        });

        // After scheduler created, add any pending requirements
        if (created?.id && pendingRequirements.length > 0) {
          for (const req of pendingRequirements) {
            await updateRequirement(created.id, {
              label: req.label,
              isActive: req.isActive
            });
          }
          setPendingRequirements([]);
        }

        await loadSchedulers(created?.id);
        setIsCreatingNew(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to save scheduler');
      console.error('Error saving scheduler:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScheduler = async () => {
    if (!editForm?.id) return;
    setDeleteTarget({ type: 'scheduler', id: editForm.id, label: editForm.label });
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError('');
    try {
      if (deleteTarget.type === 'scheduler') {
        await deleteScheduler(deleteTarget.id);
        await loadSchedulers();
        setIsCreatingNew(false);
      } else if (deleteTarget.type === 'requirement') {
        await deleteRequirement(activeScheduler.id, deleteTarget.label);
        await loadRequirements(activeScheduler.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete');
      console.error('Error deleting:', err);
    } finally {
      setSaving(false);
      setDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelEdit = () => {
    if (isCreatingNew) {
      setIsCreatingNew(false);
      setPendingRequirements([]);
      setRequirementForm({ label: '', isActive: true });
      if (activeScheduler) {
        setEditForm({ ...activeScheduler });
      } else {
        setEditForm(null);
      }
    } else if (activeScheduler) {
      setEditForm({ ...activeScheduler });
    }
  };

  const toggleDay = (day) => {
    if (!editForm) return;
    const current = editForm.schedulePerWeek || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setEditForm({ ...editForm, schedulePerWeek: updated });
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

  // Load requirements for a scheduler
  const loadRequirements = useCallback(async (schedulerId) => {
    if (!schedulerId) {
      setRequirements([]);
      return;
    }
    try {
      const reqs = await listAllRequirements(schedulerId, 0, 50);
      setRequirements(reqs || []);
    } catch (err) {
      console.error('Failed to load requirements:', err);
    }
  }, []);

  // Save requirement
  const handleSaveRequirement = async () => {
    if (!requirementForm.label?.trim()) {
      setError('Requirement label is required');
      return;
    }

    try {
      setRequirementSaving(true);

      if (isCreatingNew) {
        // Add to pending requirements (will be saved when scheduler is created)
        setPendingRequirements([...pendingRequirements, {
          label: requirementForm.label.trim(),
          isActive: requirementForm.isActive
        }]);
      } else if (activeScheduler?.id) {
        // Save immediately for existing scheduler
        await updateRequirement(activeScheduler.id, {
          label: requirementForm.label.trim(),
          isActive: requirementForm.isActive
        });
        await loadRequirements(activeScheduler.id);
      }

      setRequirementForm({ label: '', isActive: true });
    } catch (err) {
      console.error('Failed to save requirement:', err);
      setError(err.message || 'Failed to save requirement');
    } finally {
      setRequirementSaving(false);
    }
  };

  // Delete requirement
  const handleDeleteRequirement = async (label) => {
    if (isCreatingNew) {
      // Remove from pending requirements
      setPendingRequirements(pendingRequirements.filter(r => r.label !== label));
    } else if (activeScheduler?.id) {
      setDeleteTarget({ type: 'requirement', id: activeScheduler.id, label });
      setDeleteModal(true);
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

  // Check if form has unsaved changes
  const hasChanges = editForm && activeScheduler && JSON.stringify(editForm) !== JSON.stringify(activeScheduler);

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Top Bar: Compact Scheduler Selector + Create Button */}
      <div className="flex items-center gap-3">
        {/* Compact Scheduler Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors shadow-sm min-w-[180px] max-w-[280px]"
          >
            {activeScheduler ? (
              <>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeScheduler.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                <span className="text-sm font-medium text-secondary-900 dark:text-white truncate">
                  {activeScheduler.label}
                </span>
              </>
            ) : (
              <span className="text-sm text-secondary-500 dark:text-neutral-400">Select scheduler...</span>
            )}
            <ChevronDown className={`w-4 h-4 text-secondary-400 ml-auto transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu - Longer to show more schedulers */}
          {showDropdown && (
            <div className="absolute z-30 top-full left-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl min-w-[280px] max-h-[400px] overflow-y-auto">
              {schedulers.length > 0 ? (
                schedulers.map((sched) => {
                  const isSelected = activeScheduler?.id === sched.id;
                  return (
                    <button
                      key={sched.id}
                      onClick={() => handleSelectScheduler(sched)}
                      className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sched.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-secondary-800 dark:text-white'}`}>
                            {sched.label}
                          </span>
                          {sched.patientType && (
                            <span className={`px-1 py-0.5 text-[9px] font-medium rounded ${
                              sched.patientType === 'Employee'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            }`}>
                              {sched.patientType}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-secondary-500 dark:text-neutral-400 mt-0.5">
                          {sched.location} • AM {sched.morningAllowed} • PM {sched.afternoonAllowed}
                        </p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-sm text-secondary-500 dark:text-neutral-400">
                  No schedulers yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create New Scheduler Button - Always visible */}
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Scheduler</span>
        </button>
      </div>

      {/* No Scheduler State */}
      {!activeScheduler && schedulers.length === 0 && !isCreatingNew && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <h3 className="text-lg font-semibold text-secondary-700 dark:text-neutral-300 mb-2">No Schedulers</h3>
          <p className="text-sm text-secondary-500 dark:text-neutral-400 mb-4">Create a scheduler to start managing appointments</p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Create Scheduler
          </button>
        </div>
      )}

      {/* Main Content: Calendar (Left) + Settings Panel (Right) */}
      {(activeScheduler || isCreatingNew) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Calendar Panel - 2/3 width */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Scheduler Stats Card */}
            {!isCreatingNew && activeScheduler && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Morning Slots */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                      <Sun className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                    </div>
                    <div>
                      <p className="text-xs text-secondary-600 dark:text-neutral-400 font-medium">Morning Slots</p>
                      <p className="text-lg font-semibold text-secondary-900 dark:text-white">{activeScheduler.morningAllowed}</p>
                    </div>
                  </div>

                  {/* Afternoon Slots */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                    </div>
                    <div>
                      <p className="text-xs text-secondary-600 dark:text-neutral-400 font-medium">Afternoon Slots</p>
                      <p className="text-lg font-semibold text-secondary-900 dark:text-white">{activeScheduler.afternoonAllowed}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeScheduler.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-neutral-100 dark:bg-neutral-700'
                    }`}>
                      <Check className={`w-5 h-5 ${
                        activeScheduler.isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-secondary-600 dark:text-neutral-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-xs text-secondary-600 dark:text-neutral-400 font-medium">Status</p>
                      <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                        {activeScheduler.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-secondary-600 dark:text-neutral-400 font-medium">Available Days</p>
                      <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                        {activeScheduler.schedulePerWeek?.length || 0}/7
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden flex-1">
              {!isCreatingNew && activeScheduler ? (
                <AvailabilityCalendar
                  selectedDate={selectedCalendarDate}
                  onSelectDate={handleDateSelect}
                  events={events}
                  slotDefaults={slotDefaults}
                  activeScheduler={activeScheduler}
                />
              ) : (
                <div className="p-8 text-center text-secondary-500 dark:text-neutral-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-sm">Save the scheduler to view calendar</p>
                </div>
              )}
            </div>

            {/* Day Slot Editor - Show when a date is selected */}
            {!isCreatingNew && activeScheduler && (
              <div className="mt-4">
                <DaySlotEditor
                  selectedDate={selectedCalendarDate}
                  scheduler={activeScheduler}
                  dayOverride={dayOverrideData}
                  onSave={handleSaveDayOverride}
                  loading={loadingDayData}
                  events={events}
                />
              </div>
            )}
          </div>

          {/* Settings Panel - 1/3 width */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-secondary-500 dark:text-neutral-400" />
                  <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
                    {isCreatingNew ? 'New Scheduler' : 'Scheduler Settings'}
                  </h3>
                </div>
                {hasChanges && !isCreatingNew && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded">
                    Unsaved changes
                  </span>
                )}
              </div>

              {/* Edit Form */}
              {editForm && (
                <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Scheduler Name *
                    </label>
                    <input
                      type="text"
                      value={editForm.label || ''}
                      onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      placeholder="e.g., General Consultation"
                      className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {/* Location & Patient Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                        <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
                        Location
                      </label>
                      <select
                        value={editForm.location || 'Arlegui'}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Arlegui">Arlegui</option>
                        <option value="Casal">Casal</option>
                        <option value="QuezonCity">Quezon City</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                        <Users className="w-3.5 h-3.5 inline mr-1.5" />
                        Patient Type
                      </label>
                      <select
                        value={editForm.patientType || ''}
                        onChange={(e) => setEditForm({ ...editForm, patientType: e.target.value || null })}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Types</option>
                        <option value="Student">Student</option>
                        <option value="Employee">Employee</option>
                      </select>
                    </div>
                  </div>

                  {/* Slots */}
                  <div>
                    <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Available Slots per Session
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-1.5 bg-accent-50 dark:bg-accent-900/20 rounded-lg border border-accent-200 dark:border-accent-800">
                        <Sun className="w-4 h-4 text-accent-600 dark:text-accent-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-accent-600 dark:text-accent-400 min-w-fit">Morning</p>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={editForm.morningAllowed || 0}
                          onChange={(e) => setEditForm({ ...editForm, morningAllowed: parseInt(e.target.value) || 0 })}
                          className="w-12 px-1.5 py-0.5 text-sm font-semibold bg-white dark:bg-neutral-700 border border-accent-200 dark:border-accent-700 rounded text-secondary-900 dark:text-white focus:ring-1 focus:ring-accent-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
                        <Moon className="w-4 h-4 text-warning-600 dark:text-warning-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-warning-600 dark:text-warning-400 min-w-fit">Afternoon</p>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={editForm.afternoonAllowed || 0}
                          onChange={(e) => setEditForm({ ...editForm, afternoonAllowed: parseInt(e.target.value) || 0 })}
                          className="w-12 px-1.5 py-0.5 text-sm font-semibold bg-white dark:bg-neutral-700 border border-warning-200 dark:border-warning-700 rounded text-secondary-900 dark:text-white focus:ring-1 focus:ring-warning-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div>
                    <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Available Days
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day) => {
                        const isActive = editForm.schedulePerWeek?.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                              isActive
                                ? 'bg-primary-500 text-white shadow-sm'
                                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 p-1 bg-neutral-50 dark:bg-neutral-700/50 rounded cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={editForm.isActive ?? true}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary-500 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500"
                      />
                      <div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300 leading-tight">Active</p>
                        <p className="text-[8px] text-secondary-500 dark:text-neutral-400 leading-tight">Accepting appointments</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-1 bg-neutral-50 dark:bg-neutral-700/50 rounded cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={editForm.whitelistOnly ?? false}
                        onChange={(e) => setEditForm({ ...editForm, whitelistOnly: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary-500 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500"
                      />
                      <div>
                        <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300 leading-tight">Whitelist Only</p>
                        <p className="text-[8px] text-secondary-500 dark:text-neutral-400 leading-tight">Only whitelisted patients</p>
                      </div>
                    </label>
                    {/* Manage Whitelist Button */}
                    {editForm.whitelistOnly && !isCreatingNew && activeScheduler?.id && (
                      <button
                        type="button"
                        onClick={() => setShowWhitelistPanel(true)}
                        className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Manage Whitelist ({whitelistCount})
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Internal notes about this scheduler..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>

                  {/* Requirements Section */}
                  <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <label className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-3">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Required Documents
                    </label>

                    <>
                      {/* Add Requirement Form - Inline */}
                      <div className="mb-3 flex gap-2">
                        <input
                          type="text"
                          value={requirementForm.label}
                          onChange={(e) => setRequirementForm({ ...requirementForm, label: e.target.value })}
                          placeholder="e.g., Medical Certificate"
                          className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={handleSaveRequirement}
                          disabled={requirementSaving || !requirementForm.label.trim()}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          title="Add requirement"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                      </div>

                      {/* Requirements List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(isCreatingNew ? pendingRequirements : requirements).length === 0 ? (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2 text-center">
                            No requirements added yet
                          </p>
                        ) : (
                          (isCreatingNew ? pendingRequirements : requirements).map((req) => (
                            <div
                              key={req.label}
                              className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={req.isActive ?? req.isRequired ?? false}
                                  readOnly
                                  className="w-3.5 h-3.5 rounded"
                                />
                                <span className="text-sm text-secondary-700 dark:text-neutral-300 truncate">
                                  {req.label}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteRequirement(req.label)}
                                disabled={saving}
                                className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                title="Delete requirement"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2">
                {/* Delete Button (only for existing) */}
                {!isCreatingNew && editForm?.id && (
                  <button
                    onClick={handleDeleteScheduler}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {/* Cancel Button */}
                  {(hasChanges || isCreatingNew) && (
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSaveScheduler}
                    disabled={saving || (!hasChanges && !isCreatingNew)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        {isCreatingNew ? 'Create' : 'Save Changes'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
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

      {/* Delete Confirmation Modal */}
      {deleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-sm mx-4 p-6 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                Confirm Deletion
              </h3>
            </div>

            <p className="text-secondary-700 dark:text-neutral-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-secondary-900 dark:text-white">"{deleteTarget.label}"</span>?
              {deleteTarget.type === 'scheduler' && ' This cannot be undone.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteTarget(null);
                }}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-secondary-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whitelist Manager Modal */}
      <WhitelistManager
        schedulerId={activeScheduler?.id}
        isOpen={showWhitelistPanel}
        onClose={() => setShowWhitelistPanel(false)}
        onUpdate={() => loadWhitelistCount(activeScheduler?.id)}
      />
    </div>
  );
};

export default AvailabilityManager;
