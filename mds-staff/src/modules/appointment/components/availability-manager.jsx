import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, Settings, ChevronDown, Sun, Clock, Calendar, MapPin, Users, Check, X, Trash2 } from 'lucide-react';

/**
 * Normalize a date value (string, Date, or number) to YYYY-MM-DD format.
 * Uses LOCAL date getters so UTC-offset ISO timestamps (e.g. "2026-04-07T16:00:00.000Z"
 * from a UTC+8 server) resolve to the correct local calendar date ("2026-04-08").
 */
const normalizeDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    // Pure date string "YYYY-MM-DD" — return as-is
    if (!val.includes('T') && !val.endsWith('Z')) return val;
    // ISO timestamp — parse and use LOCAL date parts to avoid UTC offset shifting the date
    const d = new Date(val);
    if (isNaN(d.getTime())) return val.split('T')[0];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (val instanceof Date || typeof val === 'number') {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};
import AvailabilityCalendar from './availability-calendar';
import EventModal from './event-modal';
import WhitelistManager from './whitelist-manager';
import DateOccupancyModal from './date-occupancy-modal';
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
  getMonthAvailability,
  listCustomDates,
  setCustomDates as setCustomDatesAPI,
  unsetCustomDates as unsetCustomDatesAPI,
  checkDateOccupancy,
  cancelDateAppointments,
} from '../staff-appointment-service';
import { useStaffProfile } from '../../../hooks/use-staff-profile';
import { getLocationsByBranch } from '../../../utils/branch-utils';

// Include Sunday in the days list - Sunday disabled by default, only enabled via custom dates
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Availability Manager Component
 * Redesigned for better UX - compact selector, inline editing, side-by-side layout
 * SRS §3.4.2
 */
const AvailabilityManager = () => {
  const { profile } = useStaffProfile();
  const allowedLocations = useMemo(() => getLocationsByBranch(profile?.branch), [profile?.branch]);

  const [showEventModal, setShowEventModal] = useState(false);
  const [_eventModalDate, _setEventModalDate] = useState(null); // Reserved for future use
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

  // Custom dates state
  const [customDates, setCustomDates] = useState([]);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateInput, setCustomDateInput] = useState({
    scheduledDate: '',
    morningAllowed: '',
    afternoonAllowed: '',
  });

  // Date occupancy modal — shown when a date being disabled/removed still has active bookings
  const [occupancyModal, setOccupancyModal] = useState(null); // null | { date, count, actionLabel, onKeep, onCancelAll }

  // Month availability state (real booking data for calendar)
  const [monthAvailability, setMonthAvailability] = useState({});
  const [currentMonthRange, setCurrentMonthRange] = useState(null); // { startDate, endDate }
  const [requiredDocsEnabled, setRequiredDocsEnabled] = useState(false);

  // Derive slot defaults from the active scheduler (or editForm for immediate reflection)
  const slotDefaults = editForm
    ? { morning: editForm.morningAllowed, afternoon: editForm.afternoonAllowed }
    : { morning: 25, afternoon: 25 };

  // Load schedulers from API
  const loadSchedulers = useCallback(async (preserveId = null) => {
    setLoading(true);
    setError('');
    try {
      const raw = await listAllSchedulers();
      // Filter schedulers to only those in this staff member's allowed locations
      const list = (raw || []).filter(s => allowedLocations.includes(s.location));
      setSchedulers(list);
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
  }, [allowedLocations]);

  useEffect(() => {
    if (allowedLocations.length > 0) loadSchedulers();
  }, [loadSchedulers, allowedLocations]);

  // Update edit form and reload data when active scheduler ID changes.
  // Use activeScheduler?.id (not the full object) so optimistic updates
  // (e.g. containsCustomDates toggling) don't trigger a redundant reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeScheduler && !isCreatingNew) {
      setEditForm({ ...activeScheduler });
      setMonthAvailability({});
      loadRequirements(activeScheduler.id);
      loadWhitelistCount(activeScheduler.id);
      loadCustomDates(activeScheduler.id);
      // Reload month availability for the current calendar range
      // (currentMonthRange is intentionally read from closure, not in deps)
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    }
  }, [activeScheduler?.id, isCreatingNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load custom dates for a scheduler
  const loadCustomDates = async (schedulerId) => {
    try {
      const entries = await listCustomDates(schedulerId, 0, 500);
      setCustomDates(entries || []);
    } catch (err) {
      console.error('Failed to load custom dates:', err);
      setCustomDates([]);
    }
  };

  // Load month availability (real booking data) for the calendar
  const loadMonthAvailability = async (schedulerId, startDate, endDate) => {
    if (!schedulerId || !startDate || !endDate) return;
    try {
      const data = await getMonthAvailability(schedulerId, startDate, endDate);
      const lookup = {};
      for (const entry of (data || [])) {
        const dateStr = normalizeDate(entry.scheduledDate);
        if (dateStr) lookup[dateStr] = entry;
      }
      setMonthAvailability(lookup);
    } catch (err) {
      console.error('Failed to load month availability:', err);
    }
  };

  // Handle calendar month change
  const handleMonthChange = useCallback((startDate, endDate) => {
    setCurrentMonthRange({ startDate, endDate });
    if (activeScheduler?.id) {
      loadMonthAvailability(activeScheduler.id, startDate, endDate);
    }
  }, [activeScheduler?.id]);

  // Load whitelist count for display
  const loadWhitelistCount = async (schedulerId) => {
    try {
      const entries = await listWhitelist(schedulerId, 0, 1000);
      setWhitelistCount(entries?.length || 0);
    } catch {
      setWhitelistCount(0);
    }
  };

  // Keep selected date in sync for calendar highlight state.
  const handleDateSelect = (dateStr) => {
    setSelectedCalendarDate(dateStr || null);
  };

  // Returns true if dateStr is strictly before today (past date)
  const isPastDate = (dateStr) => {
    if (!dateStr) return false;
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return normalizeDate(dateStr) < todayStr;
  };

  // Handle adding a date as custom date from the calendar inline dropdown.
  const handleAddCustomDateFromEditor = async (dateStr, morning, afternoon) => {
    if (!activeScheduler?.id) return;
    if (isPastDate(dateStr)) {
      setError('Cannot add, create, or change past dates');
      return;
    }
    try {
      await setCustomDatesAPI(activeScheduler.id, [{
        scheduledDate: dateStr,
        morningAllowed: morning,
        afternoonAllowed: afternoon,
      }]);
      await loadCustomDates(activeScheduler.id);
      // Sync containsCustomDates flag locally
      setActiveScheduler(prev => prev ? { ...prev, containsCustomDates: true } : prev);
      setSchedulers(prev => prev.map(s => s.id === activeScheduler.id ? { ...s, containsCustomDates: true } : s));
      // Refresh month availability
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    } catch (err) {
      setError(err.message || 'Failed to add custom date');
    }
  };

  // Handle removing a custom date from DaySlotEditor
  const handleRemoveCustomDateFromEditor = async (dateStr) => {
    if (!activeScheduler?.id) return;
    const normalized = normalizeDate(dateStr);
    await _withOccupancyCheck(
      normalized,
      'Remove this custom date',
      async () => {
        try {
          await _doUnsetCustomDate(normalized);
        } catch (err) {
          setError(err.message || 'Failed to remove custom date');
        }
      },
      async () => {
        try {
          await cancelDateAppointments(activeScheduler.id, normalized);
          await _doUnsetCustomDate(normalized);
        } catch (err) {
          setError(err.message || 'Failed to cancel appointments and remove custom date');
        }
      },
    );
  };

  // Save both slot values for a date from the inline dropdown.
  const handleSaveDateSlots = async (dateStr, morningAllowed, afternoonAllowed) => {
    if (!activeScheduler?.id || !dateStr) return;
    if (isPastDate(dateStr)) {
      setError('Cannot add, create, or change past dates');
      throw new Error('Cannot add, create, or change past dates');
    }
    try {
      await updateDateIdentity(activeScheduler.id, dateStr, {
        morningAllowed,
        afternoonAllowed,
      });
      // Refresh month availability to update calendar view
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    } catch (err) {
      setError(err.message || 'Failed to update day settings');
      throw err;
    }
  };

  const _doUnsetCustomDate = async (normalized) => {
    await unsetCustomDatesAPI(activeScheduler.id, [normalized]);
    const remaining = await listCustomDates(activeScheduler.id, 0, 1);
    const stillHas = (remaining?.length || 0) > 0;
    setCustomDates(prev => prev.filter(d => normalizeDate(d.scheduledDate) !== normalized));
    setActiveScheduler(prev => prev ? { ...prev, containsCustomDates: stillHas } : prev);
    setSchedulers(prev => prev.map(s => s.id === activeScheduler.id ? { ...s, containsCustomDates: stillHas } : s));
    if (currentMonthRange) {
      loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
    }
  };

  // Shared: show the occupancy modal if the date has active bookings, else run immediately
  const _withOccupancyCheck = async (dateStr, actionLabel, onKeep, onCancelAll) => {
    try {
      const { count } = await checkDateOccupancy(activeScheduler.id, dateStr);
      if (count > 0) {
        setOccupancyModal({ date: dateStr, count, actionLabel, onKeep, onCancelAll });
      } else {
        await onKeep(); // No bookings — proceed silently with the "keep" path (safe no-op)
      }
    } catch (err) {
      setError(err.message || 'Failed to check date occupancy');
    }
  };

  const handleSelectScheduler = (sched) => {
    setActiveScheduler(sched);
    setEditForm({ ...sched });
    setIsCreatingNew(false);
    setShowDropdown(false);
    // Clear selected calendar state
    setSelectedCalendarDate(null);
    // Immediately clear stale data from previous scheduler so calendar shows clean state
    setMonthAvailability({});
    setCustomDates([]);
    // Load fresh data for the newly selected scheduler
    loadCustomDates(sched.id);
    if (currentMonthRange) {
      loadMonthAvailability(sched.id, currentMonthRange.startDate, currentMonthRange.endDate);
    }
    // Clear custom date picker state
    setShowCustomDatePicker(false);
    setCustomDateInput({
      scheduledDate: '',
      morningAllowed: '',
      afternoonAllowed: '',
    });
    setRequiredDocsEnabled(false);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    // Clear selected calendar state
    setSelectedCalendarDate(null);
    // Clear custom dates state
    setCustomDates([]);
    setShowCustomDatePicker(false);
    setCustomDateInput({
      scheduledDate: '',
      morningAllowed: '',
      afternoonAllowed: '',
    });
    setEditForm({
      label: '',
      location: allowedLocations[0] || 'Arlegui',
      patientType: null,
      schedulePerWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      morningAllowed: 25,
      afternoonAllowed: 25,
      notes: '',
      isActive: true,
      whitelistOnly: false,
      purposeRequired: false,
    });
    setRequirements([]);
    setPendingRequirements([]);
    setRequirementForm({ label: '', isActive: true });
    setRequiredDocsEnabled(false);
    setShowDropdown(false);
  };

  // Handle adding a custom date
  const handleAddCustomDate = async () => {
    if (!customDateInput.scheduledDate) return;
    if (isPastDate(customDateInput.scheduledDate)) {
      setError('Cannot add, create, or change past dates');
      return;
    }

    const morning = customDateInput.morningAllowed === '' || customDateInput.morningAllowed == null
      ? editForm?.morningAllowed ?? 25
      : parseInt(customDateInput.morningAllowed, 10) || 0;
    const afternoon = customDateInput.afternoonAllowed === '' || customDateInput.afternoonAllowed == null
      ? editForm?.afternoonAllowed ?? 25
      : parseInt(customDateInput.afternoonAllowed, 10) || 0;
    const derivedType = (morning === 0 && afternoon === 0) ? 'Exclude' : 'Include';

    if (isCreatingNew) {
      // For new scheduler, just add to local state (will be saved with scheduler)
      setCustomDates(prev => [...prev, {
        scheduledDate: customDateInput.scheduledDate,
        morningAllowed: morning,
        afternoonAllowed: afternoon,
        type: derivedType,
        id: `temp-${Date.now()}`,
      }]);
    } else if (activeScheduler?.id) {
      // For existing scheduler, save to backend immediately
      try {
        setSaving(true);
        await setCustomDatesAPI(activeScheduler.id, [{
          scheduledDate: customDateInput.scheduledDate,
          morningAllowed: morning,
          afternoonAllowed: afternoon,
        }]);
        await loadCustomDates(activeScheduler.id);
        // Sync containsCustomDates flag locally
        setActiveScheduler(prev => prev ? { ...prev, containsCustomDates: true } : prev);
        setSchedulers(prev => prev.map(s => s.id === activeScheduler.id ? { ...s, containsCustomDates: true } : s));
        // Refresh calendar to reflect the new ScheduleDateEntity entries
        if (currentMonthRange) {
          loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
        }
      } catch (err) {
        setError(err.message || 'Failed to add custom date');
      } finally {
        setSaving(false);
      }
    }

    // Reset input
    setCustomDateInput({
      scheduledDate: '',
      morningAllowed: '',
      afternoonAllowed: '',
    });
    setShowCustomDatePicker(false);
  };

  const getCustomInputValue = (field, fallback = 25) => {
    const raw = customDateInput[field];
    if (raw === '' || raw == null) return fallback;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0) return fallback;
    return parsed;
  };

  const stepCustomInputValue = (field, delta, fallback = 25) => {
    setCustomDateInput((prev) => {
      const raw = prev[field];
      const parsed = raw === '' || raw == null ? fallback : parseInt(raw, 10) || 0;
      return {
        ...prev,
        [field]: Math.max(0, parsed + delta),
      };
    });
  };

  const toggleCustomDatePicker = () => {
    if (showCustomDatePicker) {
      setShowCustomDatePicker(false);
      setCustomDateInput({
        scheduledDate: '',
        morningAllowed: '',
        afternoonAllowed: '',
      });
      return;
    }

    setShowCustomDatePicker(true);
    setCustomDateInput((prev) => ({
      ...prev,
      morningAllowed: prev.morningAllowed === '' ? 25 : prev.morningAllowed,
      afternoonAllowed: prev.afternoonAllowed === '' ? 25 : prev.afternoonAllowed,
    }));
  };

  // Handle removing a custom date
  const handleRemoveCustomDate = async (dateStr) => {
    const normalized = normalizeDate(dateStr);
    if (isCreatingNew) {
      // For new scheduler, just remove from local state (no bookings possible)
      setCustomDates(prev => prev.filter(d => normalizeDate(d.scheduledDate) !== normalized));
    } else if (activeScheduler?.id) {
      await _withOccupancyCheck(
        normalized,
        'Remove this custom date',
        async () => {
          try {
            setSaving(true);
            await _doUnsetCustomDate(normalized);
          } catch (err) {
            setError(err.message || 'Failed to remove custom date');
          } finally {
            setSaving(false);
          }
        },
        async () => {
          try {
            setSaving(true);
            await cancelDateAppointments(activeScheduler.id, normalized);
            await _doUnsetCustomDate(normalized);
          } catch (err) {
            setError(err.message || 'Failed to cancel appointments and remove custom date');
          } finally {
            setSaving(false);
          }
        },
      );
    }
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
          purposeRequired: editForm.purposeRequired ?? false,
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
          purposeRequired: editForm.purposeRequired ?? false,
          slotIncludedDates: [],
          slotExcludedDates: [],
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

        // After scheduler created, add any pending custom dates
        if (created?.id && customDates.length > 0) {
          const dateInputs = customDates.map(cd => ({
            scheduledDate: cd.scheduledDate,
            morningAllowed: cd.morningAllowed ?? editForm.morningAllowed,
            afternoonAllowed: cd.afternoonAllowed ?? editForm.afternoonAllowed,
          }));
          await setCustomDatesAPI(created.id, dateInputs);
          setCustomDates([]);
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
      setRequiredDocsEnabled(false);
      return;
    }
    try {
      const reqs = await listAllRequirements(schedulerId, 0, 50);
      const entries = reqs || [];
      setRequirements(entries);
      setRequiredDocsEnabled(entries.length > 0);
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
      setRequiredDocsEnabled(true);

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
          <p className="text-base text-secondary-500 dark:text-neutral-400">Loading schedulers...</p>
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
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-sm rounded-lg flex justify-between items-center">
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
            className="flex min-w-[140px] max-w-[240px] items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            {activeScheduler ? (
              <>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeScheduler.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                <span className="truncate text-sm font-medium text-secondary-700 dark:text-neutral-300">
                  {activeScheduler.label}
                </span>
              </>
            ) : (
              <span className="text-sm text-secondary-700 dark:text-neutral-300">Select scheduler...</span>
            )}
            <ChevronDown className={`ml-auto h-3.5 w-3.5 text-secondary-700 dark:text-neutral-300 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu - Longer to show more schedulers */}
          {showDropdown && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-[400px] min-w-[280px] overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
              {schedulers.length > 0 ? (
                schedulers.map((sched) => {
                  const isSelected = activeScheduler?.id === sched.id;
                  return (
                    <button
                      key={sched.id}
                      onClick={() => handleSelectScheduler(sched)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sched.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`truncate text-base font-medium ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-700 dark:text-neutral-300'}`}>
                            {sched.label}
                          </span>
                          {sched.patientType && (
                            <span className={`px-1 py-0.5 text-xs font-medium rounded ${
                              sched.patientType === 'Employee'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            }`}>
                              {sched.patientType}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-secondary-700 dark:text-neutral-300">
                          {sched.location} • AM {sched.morningAllowed} • PM {sched.afternoonAllowed}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-base text-secondary-700 dark:text-neutral-300">
                  No schedulers yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create New Scheduler Button - Always visible */}
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-1.5 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-2 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Scheduler</span>
        </button>
      </div>

      {/* No Scheduler State */}
      {!activeScheduler && schedulers.length === 0 && !isCreatingNew && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center">
          <Calendar className="mx-auto mb-3 h-12 w-12 text-secondary-700 dark:text-neutral-300" />
          <h3 className="mb-2 text-xl font-semibold text-secondary-700 dark:text-neutral-300">No Schedulers</h3>
          <p className="mb-4 text-base text-secondary-700 dark:text-neutral-300">Create a scheduler to start managing appointments</p>
          <button
            onClick={handleCreateNew}
            className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-4 py-2 text-base font-medium text-white transition-colors hover:bg-primary-600"
          >
            Create Scheduler
          </button>
        </div>
      )}

      {/* Main Content: Calendar (Left) + Settings Panel (Right) */}
      {(activeScheduler || isCreatingNew) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Calendar + Custom Dates */}
          <div className="flex flex-col gap-3 lg:col-span-8">
            <div className="flex-1">
              {!isCreatingNew && activeScheduler ? (
                <AvailabilityCalendar
                  selectedDate={selectedCalendarDate}
                  onSelectDate={handleDateSelect}
                  events={events}
                  slotDefaults={slotDefaults}
                  activeScheduler={activeScheduler}
                  editForm={editForm}
                  customDates={customDates}
                  monthAvailability={monthAvailability}
                  onMonthChange={handleMonthChange}
                  onSaveDateSlots={handleSaveDateSlots}
                  onAddCustomDate={handleAddCustomDateFromEditor}
                  onRemoveCustomDate={handleRemoveCustomDateFromEditor}
                />
              ) : (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center text-secondary-700 dark:text-neutral-300">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-secondary-700 dark:text-neutral-300" />
                  <p className="text-base">Save the scheduler to view calendar</p>
                </div>
              )}
            </div>

            {!isCreatingNew && activeScheduler?.id && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex flex-col" style={{ gap: '3px' }}>
                    <h4 className="m-0 text-base font-semibold leading-[1.2] text-secondary-700 dark:text-neutral-300">Custom Dates</h4>
                    <p className="m-0 text-xs leading-[1.25] text-secondary-700 dark:text-neutral-300">
                      Set slot counts per date. Both AM &amp; PM at 0 = Excluded (blocked).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleCustomDatePicker}
                    className="rounded-md border border-primary-200 dark:border-primary-800 px-2.5 py-0.5 text-sm font-semibold text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    {showCustomDatePicker ? 'Close' : '+ Add Date'}
                  </button>
                </div>

                {showCustomDatePicker && (
                  <div className="mb-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5">
                    <div className="mb-1.5">
                      <label className="mb-0.5 block text-xs font-semibold uppercase tracking-wider text-secondary-700 dark:text-neutral-300">Date</label>
                      <input
                        type="date"
                        min={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; })()}
                        value={customDateInput.scheduledDate}
                        onChange={(e) => setCustomDateInput({ ...customDateInput, scheduledDate: e.target.value })}
                        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-sm text-secondary-700 dark:text-neutral-300 outline-none focus:border-primary-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-2">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold leading-[1.2] text-amber-700 dark:text-amber-300">
                          <Sun className="h-3.5 w-3.5" /> Morning
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => stepCustomInputValue('morningAllowed', -1, 25)}
                            className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-0.5 text-secondary-700 dark:text-neutral-300"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customDateInput.morningAllowed}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setCustomDateInput({ ...customDateInput, morningAllowed: '' }); return; }
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0) setCustomDateInput({ ...customDateInput, morningAllowed: num });
                            }}
                            onBlur={() => {
                              if (customDateInput.morningAllowed === '' || customDateInput.morningAllowed == null) {
                                setCustomDateInput({ ...customDateInput, morningAllowed: 25 });
                              }
                            }}
                            className="h-7 flex-1 rounded-md border border-amber-300 dark:border-amber-700 bg-white/90 dark:bg-neutral-800 px-2 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => stepCustomInputValue('morningAllowed', 1, 25)}
                            className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-0.5 text-secondary-700 dark:text-neutral-300"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-2">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold leading-[1.2] text-sky-700 dark:text-sky-300">
                          <Clock className="h-3.5 w-3.5" /> Afternoon
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => stepCustomInputValue('afternoonAllowed', -1, 25)}
                            className="rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-0.5 text-secondary-700 dark:text-neutral-300"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customDateInput.afternoonAllowed}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setCustomDateInput({ ...customDateInput, afternoonAllowed: '' }); return; }
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0) setCustomDateInput({ ...customDateInput, afternoonAllowed: num });
                            }}
                            onBlur={() => {
                              if (customDateInput.afternoonAllowed === '' || customDateInput.afternoonAllowed == null) {
                                setCustomDateInput({ ...customDateInput, afternoonAllowed: 25 });
                              }
                            }}
                            className="h-7 flex-1 rounded-md border border-sky-300 dark:border-sky-700 bg-white/90 dark:bg-neutral-800 px-2 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => stepCustomInputValue('afternoonAllowed', 1, 25)}
                            className="rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-0.5 text-secondary-700 dark:text-neutral-300"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const m = getCustomInputValue('morningAllowed', 25);
                      const a = getCustomInputValue('afternoonAllowed', 25);
                      const isExclude = m === 0 && a === 0;
                      return (
                        <p className={`mt-1.5 rounded-md px-2 py-0.5 text-center text-xs font-semibold leading-[1.2] ${
                          isExclude
                            ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                            : 'bg-white dark:bg-neutral-800 text-secondary-700 dark:text-neutral-300'
                        }`}>
                          {isExclude ? 'Will be Excluded (blocked)' : 'Will be Included (open)'}
                        </p>
                      );
                    })()}

                    {customDateInput.scheduledDate && isPastDate(customDateInput.scheduledDate) && (
                      <p className="mt-1.5 text-center text-xs font-semibold leading-[1.2] text-rose-700 dark:text-rose-300">
                        Cannot add, create, or change past dates
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleAddCustomDate}
                      disabled={!customDateInput.scheduledDate || saving || isPastDate(customDateInput.scheduledDate)}
                      className="mt-1.5 w-full rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Add Custom Date
                    </button>

                    <button
                      type="button"
                      onClick={toggleCustomDatePicker}
                      className="mt-1 w-full text-xs font-medium text-secondary-700 dark:text-neutral-300 hover:text-secondary-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {customDates.length > 0 ? (
                  <div className="space-y-1.5">
                    {customDates.map((cd) => {
                      const normalized = normalizeDate(cd.scheduledDate);
                      const dateObj = normalized ? new Date(`${normalized}T00:00:00`) : null;
                      const dateLabel = dateObj && !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : normalized || 'Unknown';
                      const isPast = isPastDate(normalized);
                      const isOpen = !isPast && cd.type !== 'Exclude';
                      const mSlots = cd.morningAllowed ?? 0;
                      const aSlots = cd.afternoonAllowed ?? 0;

                      return (
                        <div
                          key={cd.id || normalized}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                            isPast
                              ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 opacity-60'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`} />
                            <span className="truncate font-medium text-secondary-700 dark:text-neutral-300">{dateLabel}</span>
                            <span className="text-xs text-secondary-700 dark:text-neutral-300">AM {mSlots} / PM {aSlots}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              isPast
                                ? 'bg-white dark:bg-neutral-800 text-secondary-700 dark:text-neutral-300'
                                : isOpen
                                  ? 'bg-white dark:bg-neutral-800 text-secondary-700 dark:text-neutral-300'
                                  : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                            }`}>
                              {isPast ? 'Past' : isOpen ? 'Open' : 'Blocked'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDate(normalized)}
                            className="rounded p-1 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-rose-700 dark:hover:text-rose-300"
                            title="Delete custom date"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm italic leading-[1.25] text-secondary-700 dark:text-neutral-300">No custom dates configured</p>
                )}
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-4">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Settings className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                  <h3 className="m-0 text-base font-semibold leading-[1.2] text-secondary-700 dark:text-neutral-300">
                    {isCreatingNew ? 'New Scheduler' : 'Scheduler Settings'}
                  </h3>
                </div>
                {hasChanges && !isCreatingNew && (
                  <span className="rounded bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Unsaved changes
                  </span>
                )}
              </div>

              {editForm && (
                <>
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Scheduler Name *</label>
                      <input
                        type="text"
                        value={editForm.label || ''}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        placeholder="e.g., General Consultation"
                        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-700 dark:text-neutral-300 outline-none placeholder:text-secondary-700 dark:text-neutral-300 focus:border-primary-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">
                          <MapPin className="mr-1 inline h-3.5 w-3.5" />
                          Location
                        </label>
                        <select
                          value={editForm.location || allowedLocations[0] || 'Arlegui'}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-700 dark:text-neutral-300 outline-none focus:border-primary-500"
                        >
                          {allowedLocations.includes('Arlegui') && <option value="Arlegui">Arlegui</option>}
                          {allowedLocations.includes('Casal') && <option value="Casal">Casal</option>}
                          {allowedLocations.includes('QuezonCity') && <option value="QuezonCity">Quezon City</option>}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">
                          <Users className="mr-1 inline h-3.5 w-3.5" />
                          Patient Type
                        </label>
                        <select
                          value={editForm.patientType || ''}
                          onChange={(e) => setEditForm({ ...editForm, patientType: e.target.value || null })}
                          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-700 dark:text-neutral-300 outline-none focus:border-primary-500"
                        >
                          <option value="">All Types</option>
                          <option value="Student">Student</option>
                          <option value="Employee">Employee</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Available Slots per Session</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-2">
                          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            <Sun className="h-3.5 w-3.5" /> Morning
                          </p>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editForm.morningAllowed}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setEditForm({ ...editForm, morningAllowed: '' }); return; }
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0) setEditForm({ ...editForm, morningAllowed: num });
                            }}
                            onBlur={() => {
                              if (editForm.morningAllowed === '' || editForm.morningAllowed == null) {
                                setEditForm({ ...editForm, morningAllowed: 0 });
                              }
                            }}
                            className="w-full rounded-md border border-amber-300 dark:border-amber-700 bg-white/90 dark:bg-neutral-800 px-2 py-1.5 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
                          />
                        </div>
                        <div className="rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-2">
                          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
                            <Clock className="h-3.5 w-3.5" /> Afternoon
                          </p>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editForm.afternoonAllowed}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setEditForm({ ...editForm, afternoonAllowed: '' }); return; }
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0) setEditForm({ ...editForm, afternoonAllowed: num });
                            }}
                            onBlur={() => {
                              if (editForm.afternoonAllowed === '' || editForm.afternoonAllowed == null) {
                                setEditForm({ ...editForm, afternoonAllowed: 0 });
                              }
                            }}
                            className="w-full rounded-md border border-sky-300 dark:border-sky-700 bg-white/90 dark:bg-neutral-800 px-2 py-1.5 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Available Days</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day) => {
                          const isActiveDay = editForm.schedulePerWeek?.includes(day);
                          const isSunday = day === 'Sunday';
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              title={isSunday && !isActiveDay ? 'Sunday is disabled by default. Enable it or use Custom Dates below.' : ''}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                isActiveDay
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'bg-white dark:bg-neutral-800 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-secondary-700 dark:text-neutral-300">
                        Sunday is disabled by default. Use Custom Dates for specific Sundays.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.isActive ?? true}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                          className="mt-0.5 h-4 w-4 rounded border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Active</span>
                          <span className="block text-xs text-secondary-700 dark:text-neutral-300">Open and accepting appointments</span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.purposeRequired ?? false}
                          onChange={(e) => setEditForm({ ...editForm, purposeRequired: e.target.checked })}
                          className="mt-0.5 h-4 w-4 rounded border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Require Purpose</span>
                          <span className="block text-xs text-secondary-700 dark:text-neutral-300">Patients must provide a reason for their visit</span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.whitelistOnly ?? false}
                          onChange={(e) => setEditForm({ ...editForm, whitelistOnly: e.target.checked })}
                          className="mt-0.5 h-4 w-4 rounded border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Whitelist Only</span>
                          <span className="block text-xs text-secondary-700 dark:text-neutral-300">Only whitelisted can see this scheduler</span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={requiredDocsEnabled}
                          onChange={(e) => setRequiredDocsEnabled(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Required Documents</span>
                          <span className="block text-xs text-secondary-700 dark:text-neutral-300">Patients must upload documents before booking</span>
                        </span>
                      </label>

                      {editForm.whitelistOnly && !isCreatingNew && activeScheduler?.id && (
                        <button
                          type="button"
                          onClick={() => setShowWhitelistPanel(true)}
                          className="w-full rounded-lg border border-primary-200 dark:border-primary-800 px-3 py-2 text-sm font-semibold text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        >
                          Manage Whitelist ({whitelistCount})
                        </button>
                      )}

                      {requiredDocsEnabled && (
                        <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={requirementForm.label}
                              onChange={(e) => setRequirementForm({ ...requirementForm, label: e.target.value })}
                              placeholder="e.g., Medical Certificate"
                              className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-700 dark:text-neutral-300 outline-none placeholder:text-secondary-700 dark:text-neutral-300 focus:border-primary-500"
                            />
                            <button
                              type="button"
                              onClick={handleSaveRequirement}
                              disabled={requirementSaving || !requirementForm.label.trim()}
                              className="rounded-md border border-primary-200 dark:border-primary-800 bg-primary-500 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              + Add
                            </button>
                          </div>

                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {(isCreatingNew ? pendingRequirements : requirements).length === 0 ? (
                              <p className="py-2 text-center text-xs text-secondary-700 dark:text-neutral-300">No requirements added yet</p>
                            ) : (
                              (isCreatingNew ? pendingRequirements : requirements).map((req) => (
                                <div
                                  key={req.label}
                                  className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1.5"
                                >
                                  <span className="truncate text-sm text-secondary-700 dark:text-neutral-300">{req.label}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRequirement(req.label)}
                                    disabled={saving}
                                    className="rounded p-1 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-50"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-secondary-700 dark:text-neutral-300">Notes (Optional)</label>
                      <textarea
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Internal notes about this scheduler..."
                        rows={3}
                        className="w-full resize-none rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-700 dark:text-neutral-300 outline-none placeholder:text-secondary-700 dark:text-neutral-300 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
                    {!isCreatingNew && editForm?.id ? (
                      <button
                        onClick={handleDeleteScheduler}
                        disabled={saving}
                        className="rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-2">
                      {(hasChanges || isCreatingNew) && (
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm font-semibold text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        onClick={handleSaveScheduler}
                        disabled={saving || (!hasChanges && !isCreatingNew)}
                        className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : isCreatingNew ? 'Create' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        initialDate={_eventModalDate}
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
              <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">
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
                className="flex-1 px-4 py-2.5 text-base font-medium text-secondary-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* Date occupancy modal — shown when disabling/removing a date that still has active bookings */}
      {occupancyModal && (
        <DateOccupancyModal
          isOpen
          onClose={() => setOccupancyModal(null)}
          date={occupancyModal.date}
          count={occupancyModal.count}
          actionLabel={occupancyModal.actionLabel}
          onKeep={occupancyModal.onKeep}
          onCancelAll={occupancyModal.onCancelAll}
        />
      )}
    </div>
  );
};

export default AvailabilityManager;
