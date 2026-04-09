import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Settings, ChevronDown, Sun, Moon, Calendar, MapPin, Users, Check, X, Trash2, Save, FileText, Trash } from 'lucide-react';

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
import DaySlotEditor from './day-slot-editor';
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
  getScheduleAvailability,
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
  const [dayOverrideData, setDayOverrideData] = useState(null);
  const [loadingDayData, setLoadingDayData] = useState(false);

  // Custom dates state
  const [customDates, setCustomDates] = useState([]);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateInput, setCustomDateInput] = useState({
    scheduledDate: '',
    morningAllowed: null,
    afternoonAllowed: null,
    useCustomSlots: false,
  });

  // Date occupancy modal — shown when a date being disabled/removed still has active bookings
  const [occupancyModal, setOccupancyModal] = useState(null); // null | { date, count, actionLabel, onKeep, onCancelAll }

  // Month availability state (real booking data for calendar)
  const [monthAvailability, setMonthAvailability] = useState({});
  const [currentMonthRange, setCurrentMonthRange] = useState(null); // { startDate, endDate }

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

  // Handle calendar date selection — read-only, never creates DB rows
  const handleDateSelect = (dateStr) => {
    setSelectedCalendarDate(dateStr);
    if (!activeScheduler?.id || !dateStr) {
      setDayOverrideData(null);
      return;
    }

    // For closed dates: show the "Add as custom date" prompt
    if (!isDateAvailable(dateStr)) {
      setDayOverrideData(null);
      return;
    }

    // Use already-loaded monthAvailability data (no API call = no ScheduleDateEntity creation)
    // For dates without an entity yet, dayOverrideData stays null and DaySlotEditor
    // falls back to scheduler defaults.
    setDayOverrideData(monthAvailability[dateStr] || null);
  };

  // Check if a specific date is available (in schedule or custom dates)
  const isDateAvailable = (dateStr) => {
    if (!dateStr || !editForm) return false;
    const normalized = normalizeDate(dateStr);
    const d = new Date(normalized + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    // Check if it's in the regular schedule
    if (editForm.schedulePerWeek?.includes(dayName)) {
      return true;
    }
    // Check if it's a custom date (normalize for comparison)
    return customDates.some(cd => normalizeDate(cd.scheduledDate) === normalized);
  };

  // Handle adding a date as custom date from DaySlotEditor
  const handleAddCustomDateFromEditor = async (dateStr, morning, afternoon) => {
    if (!activeScheduler?.id) return;
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
      // Now load the day data
      const data = await getScheduleAvailability(activeScheduler.id, dateStr);
      setDayOverrideData(data);
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

  // Handle saving day override
  const handleSaveDayOverride = async (input) => {
    if (!activeScheduler?.id || !selectedCalendarDate) return;
    try {
      const updated = await updateDateIdentity(activeScheduler.id, selectedCalendarDate, input);
      setDayOverrideData(updated);
      // Refresh month availability to update calendar view
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    } catch (err) {
      setError(err.message || 'Failed to update day settings');
      throw err;
    }
  };

  // Handle editing session limit from calendar inline popup
  const handleEditSessionLimit = async (dateStr, session, value) => {
    if (!activeScheduler?.id) return;
    try {
      const input = session === 'morning'
        ? { morningAllowed: value }
        : { afternoonAllowed: value };
      const result = await updateDateIdentity(activeScheduler.id, dateStr, input);
      // Update the day slot editor if this is the currently selected date
      if (dateStr === selectedCalendarDate) {
        setDayOverrideData(result);
      }
      // Refresh month availability to update calendar view
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    } catch (err) {
      setError(err.message || 'Failed to update session limit');
      throw err;
    }
  };

  // Core helper: execute a disable/remove action, optionally after pre-cancelling bookings
  const _doDisableDate = async (dateStr) => {
    const result = await updateDateIdentity(activeScheduler.id, dateStr, {
      morningAllowed: 0,
      afternoonAllowed: 0,
    });
    setDayOverrideData(result);
    if (currentMonthRange) {
      loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
    }
  };

  const _doUnsetCustomDate = async (normalized) => {
    await unsetCustomDatesAPI(activeScheduler.id, [normalized]);
    const remaining = await listCustomDates(activeScheduler.id, 0, 1);
    const stillHas = (remaining?.length || 0) > 0;
    setCustomDates(prev => prev.filter(d => normalizeDate(d.scheduledDate) !== normalized));
    setActiveScheduler(prev => prev ? { ...prev, containsCustomDates: stillHas } : prev);
    setSchedulers(prev => prev.map(s => s.id === activeScheduler.id ? { ...s, containsCustomDates: stillHas } : s));
    setDayOverrideData(null);
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

  // Handle disabling a date (set both sessions to 0)
  const handleDisableDate = async (dateStr) => {
    if (!activeScheduler?.id || !dateStr) return;
    await _withOccupancyCheck(
      dateStr,
      'Disable this date',
      async () => {
        try {
          await _doDisableDate(dateStr);
        } catch (err) {
          setError(err.message || 'Failed to disable date');
        }
      },
      async () => {
        try {
          await cancelDateAppointments(activeScheduler.id, dateStr);
          await _doDisableDate(dateStr);
        } catch (err) {
          setError(err.message || 'Failed to cancel appointments and disable date');
        }
      },
    );
  };

  // Handle re-enabling a disabled date (reset to scheduler defaults)
  const handleResetDate = async (dateStr) => {
    if (!activeScheduler?.id || !dateStr) return;
    try {
      const result = await updateDateIdentity(activeScheduler.id, dateStr, {
        morningAllowed: activeScheduler.morningAllowed,
        afternoonAllowed: activeScheduler.afternoonAllowed,
      });
      setDayOverrideData(result);
      if (currentMonthRange) {
        loadMonthAvailability(activeScheduler.id, currentMonthRange.startDate, currentMonthRange.endDate);
      }
    } catch (err) {
      setError(err.message || 'Failed to reset date');
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
      morningAllowed: null,
      afternoonAllowed: null,
      useCustomSlots: false,
    });
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    // Clear day slot editor state
    setSelectedCalendarDate(null);
    setDayOverrideData(null);
    // Clear custom dates state
    setCustomDates([]);
    setShowCustomDatePicker(false);
    setCustomDateInput({
      scheduledDate: '',
      morningAllowed: null,
      afternoonAllowed: null,
      useCustomSlots: false,
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
    setShowDropdown(false);
  };

  // Handle adding a custom date
  const handleAddCustomDate = async () => {
    if (!customDateInput.scheduledDate) return;

    const dateEntry = {
      scheduledDate: customDateInput.scheduledDate,
      ...(customDateInput.useCustomSlots && customDateInput.morningAllowed != null
        ? { morningAllowed: parseInt(customDateInput.morningAllowed) }
        : {}),
      ...(customDateInput.useCustomSlots && customDateInput.afternoonAllowed != null
        ? { afternoonAllowed: parseInt(customDateInput.afternoonAllowed) }
        : {}),
    };

    if (isCreatingNew) {
      // For new scheduler, just add to local state (will be saved with scheduler)
      setCustomDates(prev => [...prev, { ...dateEntry, id: `temp-${Date.now()}` }]);
    } else if (activeScheduler?.id) {
      // For existing scheduler, save to backend immediately
      try {
        setSaving(true);
        await setCustomDatesAPI(activeScheduler.id, [dateEntry]);
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
      morningAllowed: null,
      afternoonAllowed: null,
      useCustomSlots: false,
    });
    setShowCustomDatePicker(false);
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

        // After scheduler created, add any pending custom dates
        if (created?.id && customDates.length > 0) {
          const dateEntries = customDates.map(cd => ({
            scheduledDate: cd.scheduledDate,
            ...(cd.morningAllowed != null ? { morningAllowed: cd.morningAllowed } : {}),
            ...(cd.afternoonAllowed != null ? { afternoonAllowed: cd.afternoonAllowed } : {}),
          }));
          await setCustomDatesAPI(created.id, dateEntries);
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
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors shadow-sm min-w-[180px] max-w-[280px]"
          >
            {activeScheduler ? (
              <>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeScheduler.isActive ? 'bg-success-500' : 'bg-neutral-400'}`} />
                <span className="text-base font-medium text-secondary-900 dark:text-white truncate">
                  {activeScheduler.label}
                </span>
              </>
            ) : (
              <span className="text-base text-secondary-500 dark:text-neutral-400">Select scheduler...</span>
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
                          <span className={`text-base font-medium truncate ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-secondary-800 dark:text-white'}`}>
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
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                          {sched.location} • AM {sched.morningAllowed} • PM {sched.afternoonAllowed}
                        </p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-base text-secondary-500 dark:text-neutral-400">
                  No schedulers yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create New Scheduler Button - Always visible */}
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-base font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Scheduler</span>
        </button>
      </div>

      {/* No Scheduler State */}
      {!activeScheduler && schedulers.length === 0 && !isCreatingNew && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <h3 className="text-xl font-semibold text-secondary-700 dark:text-neutral-300 mb-2">No Schedulers</h3>
          <p className="text-base text-secondary-500 dark:text-neutral-400 mb-4">Create a scheduler to start managing appointments</p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 text-base font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Create Scheduler
          </button>
        </div>
      )}

      {/* Main Content: Calendar (Left) + Settings Panel (Right) */}
      {(activeScheduler || isCreatingNew) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Calendar Panel - 2/3 width */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {/* Day Slot Editor - Above calendar */}
            {!isCreatingNew && activeScheduler && (
              <DaySlotEditor
                selectedDate={selectedCalendarDate}
                scheduler={activeScheduler}
                dayOverride={dayOverrideData}
                onSave={handleSaveDayOverride}
                loading={loadingDayData}
                events={events}
                customDates={customDates}
                isDateAvailable={selectedCalendarDate ? isDateAvailable(selectedCalendarDate) : false}
                onAddCustomDate={handleAddCustomDateFromEditor}
                onRemoveCustomDate={handleRemoveCustomDateFromEditor}
                onDisableDate={handleDisableDate}
                onResetDate={handleResetDate}
              />
            )}

            {/* Calendar */}
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
                  onEditSessionLimit={handleEditSessionLimit}
                  monthAvailability={monthAvailability}
                  onMonthChange={handleMonthChange}
                  allowSelectClosed={true}
                />
              ) : (
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 text-center text-secondary-500 dark:text-neutral-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-base">Save the scheduler to view calendar</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings Panel - 1/3 width */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-secondary-500 dark:text-neutral-400" />
                  <h3 className="text-base font-semibold text-secondary-800 dark:text-white">
                    {isCreatingNew ? 'New Scheduler' : 'Scheduler Settings'}
                  </h3>
                </div>
                {hasChanges && !isCreatingNew && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded">
                    Unsaved changes
                  </span>
                )}
              </div>

              {/* Edit Form */}
              {editForm && (
                <div className="p-4 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {/* Name */}
                  <div>
                    <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Scheduler Name *
                    </label>
                    <input
                      type="text"
                      value={editForm.label || ''}
                      onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      placeholder="e.g., General Consultation"
                      className="w-full px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {/* Location & Patient Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                        <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
                        Location
                      </label>
                      <select
                        value={editForm.location || allowedLocations[0] || 'Arlegui'}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        {allowedLocations.includes('Arlegui') && <option value="Arlegui">Arlegui</option>}
                        {allowedLocations.includes('Casal') && <option value="Casal">Casal</option>}
                        {allowedLocations.includes('QuezonCity') && <option value="QuezonCity">Quezon City</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                        <Users className="w-3.5 h-3.5 inline mr-1.5" />
                        Patient Type
                      </label>
                      <select
                        value={editForm.patientType || ''}
                        onChange={(e) => setEditForm({ ...editForm, patientType: e.target.value || null })}
                        className="w-full px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Types</option>
                        <option value="Student">Student</option>
                        <option value="Employee">Employee</option>
                      </select>
                    </div>
                  </div>

                  {/* Slots - Compact Horizontal Layout */}
                  <div>
                    <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Available Slots per Session
                    </label>
                    <div className="flex gap-4">
                      {/* Morning */}
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                        <span className="text-sm font-medium text-secondary-600 dark:text-neutral-400">Morning</span>
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
                          className="w-16 px-2 py-1.5 text-center text-base font-semibold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      {/* Afternoon */}
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                        <span className="text-sm font-medium text-secondary-600 dark:text-neutral-400">Afternoon</span>
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
                          className="w-16 px-2 py-1.5 text-center text-base font-semibold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div>
                    <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Available Days
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day) => {
                        const isActive = editForm.schedulePerWeek?.includes(day);
                        const isSunday = day === 'Sunday';
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            title={isSunday && !isActive ? 'Sunday is disabled by default. Enable it or use Custom Dates below.' : ''}
                            className={`px-2.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                              isActive
                                ? 'bg-primary-500 text-white shadow-sm'
                                : isSunday
                                  ? 'bg-neutral-200 dark:bg-neutral-600 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-300 dark:hover:bg-neutral-500'
                                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1.5">
                      Sunday is disabled by default. Use Custom Dates for specific Sundays.
                    </p>
                  </div>

                  {/* Custom Dates Section */}
                  {!isCreatingNew && activeScheduler?.id && (
                    <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-base font-semibold text-secondary-700 dark:text-neutral-300">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Custom Dates
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                          className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                        >
                          {showCustomDatePicker ? 'Cancel' : '+ Add Date'}
                        </button>
                      </div>
                      <p className="text-xs text-secondary-400 dark:text-neutral-500 mb-2">
                        Add specific dates to accept appointments, regardless of available days
                      </p>

                      {/* Add Custom Date Form */}
                      {showCustomDatePicker && (
                        <div className="mb-3 p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg space-y-2">
                          <input
                            type="date"
                            value={customDateInput.scheduledDate}
                            onChange={(e) => setCustomDateInput({ ...customDateInput, scheduledDate: e.target.value })}
                            className="w-full px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                          <label className="flex items-center gap-2 text-sm text-secondary-600 dark:text-neutral-400">
                            <input
                              type="checkbox"
                              checked={customDateInput.useCustomSlots}
                              onChange={(e) => setCustomDateInput({ ...customDateInput, useCustomSlots: e.target.checked })}
                              className="w-3.5 h-3.5 text-primary-500 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500"
                            />
                            Custom slot capacity
                          </label>
                          {customDateInput.useCustomSlots && (
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block">
                                  <Sun className="w-3 h-3 inline mr-0.5" /> Morning
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder={String(editForm.morningAllowed || 25)}
                                  value={customDateInput.morningAllowed ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') { setCustomDateInput({ ...customDateInput, morningAllowed: null }); return; }
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num) && num >= 0) setCustomDateInput({ ...customDateInput, morningAllowed: num });
                                  }}
                                  className="w-full px-2 py-1.5 text-base text-center border border-neutral-200 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block">
                                  <Moon className="w-3 h-3 inline mr-0.5" /> Afternoon
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder={String(editForm.afternoonAllowed || 25)}
                                  value={customDateInput.afternoonAllowed ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') { setCustomDateInput({ ...customDateInput, afternoonAllowed: null }); return; }
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num) && num >= 0) setCustomDateInput({ ...customDateInput, afternoonAllowed: num });
                                  }}
                                  className="w-full px-2 py-1.5 text-base text-center border border-neutral-200 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={handleAddCustomDate}
                            disabled={!customDateInput.scheduledDate || saving}
                            className="w-full px-3 py-2 text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Custom Date
                          </button>
                        </div>
                      )}

                      {/* Custom Dates List */}
                      {customDates.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {customDates.map((cd) => {
                            const normalized = normalizeDate(cd.scheduledDate);
                            const dateObj = normalized ? new Date(normalized + 'T00:00:00') : null;
                            const dateLabel = dateObj && !isNaN(dateObj.getTime())
                              ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                              : normalized || 'Unknown';
                            return (
                              <div
                                key={cd.id || normalized}
                                className="flex items-center justify-between px-2 py-1.5 bg-violet-50 dark:bg-violet-900/20 rounded text-sm"
                              >
                                <div>
                                  <span className="font-medium text-violet-700 dark:text-violet-400">
                                    {dateLabel}
                                  </span>
                                  {(cd.morningAllowed != null || cd.afternoonAllowed != null) && (
                                    <span className="ml-1.5 text-violet-500 dark:text-violet-500">
                                      ({cd.morningAllowed ?? 'default'}/{cd.afternoonAllowed ?? 'default'})
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomDate(normalized)}
                                  className="p-1 text-violet-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-secondary-400 dark:text-neutral-500 italic">
                          No custom dates configured
                        </p>
                      )}
                    </div>
                  )}

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
                        <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300 leading-tight">Active</p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 leading-tight">Open and accepting appointments</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-1 bg-neutral-50 dark:bg-neutral-700/50 rounded cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={editForm.purposeRequired ?? false}
                        onChange={(e) => setEditForm({ ...editForm, purposeRequired: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary-500 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300 leading-tight">Require Purpose</p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 leading-tight">Patients must provide a reason for their visit</p>
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
                        <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300 leading-tight">Whitelist Only</p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 leading-tight">Only whitelisted can see this scheduler</p>
                      </div>
                    </label>
                    {/* Manage Whitelist Button */}
                    {editForm.whitelistOnly && !isCreatingNew && activeScheduler?.id && (
                      <button
                        type="button"
                        onClick={() => setShowWhitelistPanel(true)}
                        className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Manage Whitelist ({whitelistCount})
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Internal notes about this scheduler..."
                      rows={2}
                      className="w-full px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>

                  {/* Requirements Section */}
                  <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <label className="block text-base font-semibold text-secondary-700 dark:text-neutral-300 mb-3">
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
                          className="flex-1 px-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={handleSaveRequirement}
                          disabled={requirementSaving || !requirementForm.label.trim()}
                          className="flex items-center gap-2 px-3 py-2 text-base bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          title="Add requirement"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                      </div>

                      {/* Requirements List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(isCreatingNew ? pendingRequirements : requirements).length === 0 ? (
                          <p className="text-base text-neutral-500 dark:text-neutral-400 py-2 text-center">
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
                                <span className="text-base text-secondary-700 dark:text-neutral-300 truncate">
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
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors disabled:opacity-50"
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
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSaveScheduler}
                    disabled={saving || (!hasChanges && !isCreatingNew)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
