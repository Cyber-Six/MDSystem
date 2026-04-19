import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Sun, Clock, X, ChevronLeft, ChevronRight, Minus, Plus, AlertTriangle } from 'lucide-react';

/**
 * Availability Calendar Component
 * Month-view calendar grid showing slot utilization for each day
 * Color-coded: Green (open) / Amber (>70% booked) / Red (full/suspended) / Blue (event override)
 * SRS §3.4.2
 */
const AvailabilityCalendar = ({
  selectedDate,
  onSelectDate,
  events,
  slotDefaults,
  activeScheduler,
  editForm,
  customDates = [],
  monthAvailability = {},
  onMonthChange,
  onSaveDateSlots,
  onAddCustomDate,
  onRemoveCustomDate,
  onEditSessionLimit,
}) => {
  const [saving, setSaving] = useState(false);
  const [inlineEditor, setInlineEditor] = useState(null);
  const [editorDraft, setEditorDraft] = useState({ morningAllowed: 0, afternoonAllowed: 0 });
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const popupRef = useRef(null);
  const cellRefs = useRef({});
  const morningInputRef = useRef(null);
  const afternoonInputRef = useRef(null);
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

  // Normalize an API date value to local "YYYY-MM-DD" (handles UTC ISO timestamps from pg)
  const toLocalDateKey = (val) => {
    if (!val) return '';
    const s = String(val);
    if (!s.includes('T') && !s.endsWith('Z')) return s; // pure date string
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.split('T')[0];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Create a map of custom dates for quick lookup (date -> custom date info)
  const customDateMap = useMemo(() => {
    const map = {};
    customDates.forEach(cd => {
      const dateStr = toLocalDateKey(cd.scheduledDate);
      if (dateStr) map[dateStr] = cd;
    });
    return map;
  }, [customDates]);

  const customDateSet = useMemo(() => new Set(Object.keys(customDateMap)), [customDateMap]);

  // Build slot data per day using real availability from API.
  const daySlots = useMemo(() => {
    const checkDayAvailable = (dayOfWeek, dateStr) => {
      const dayName = dayIndexToName[dayOfWeek];
      const customDate = customDateMap[dateStr];

      // Exclude custom dates block the day (even if in weekly schedule)
      if (customDate?.type === 'Exclude') return false;

      // Weekly schedule match
      if (currentSchedulePerWeek.includes(dayName)) return true;

      // Include custom dates explicitly open
      if (customDate?.type === 'Include') return true;

      // Legacy: custom dates without a type default to Include
      if (customDate && !customDate.type) return true;

      return false;
    };

    const checkIsCustomDate = (dayOfWeek, dateStr) => {
      // Any date in SlotCustomDate table = custom (regardless of whether the day is also in schedule)
      if (customDateSet.has(dateStr)) return true;
      // Any date whose ScheduleDateEntity slot counts differ from the scheduler defaults = modified
      const apiData = monthAvailability[dateStr];
      if (apiData) {
        const defaultMorning = slotDefaults?.morning ?? 0;
        const defaultAfternoon = slotDefaults?.afternoon ?? 0;
        if (apiData.morningAllowed !== defaultMorning || apiData.afternoonAllowed !== defaultAfternoon) {
          return true;
        }
      }
      return false;
    };

    const checkIsExcluded = (dateStr) => {
      const customDate = customDateMap[dateStr];
      return customDate?.type === 'Exclude';
    };

    const data = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();

      const isAvailable = checkDayAvailable(dayOfWeek, dateStr);
      const isExcluded = checkIsExcluded(dateStr);
      const customEntry = customDateMap[dateStr];

      const isCustom = checkIsCustomDate(dayOfWeek, dateStr);
      const dayEvent = events.find((e) => dateStr >= e.startDate && dateStr <= e.endDate);

      const apiData = monthAvailability[dateStr];

      // Priority: API data (has real DB values) > custom date entry > scheduler defaults.
      const fallbackMorning = slotDefaults?.morning ?? 0;
      const fallbackAfternoon = slotDefaults?.afternoon ?? 0;
      const morningAllowed = apiData?.morningAllowed ?? customEntry?.morningAllowed ?? (isAvailable ? fallbackMorning : 0);
      const afternoonAllowed = apiData?.afternoonAllowed ?? customEntry?.afternoonAllowed ?? (isAvailable ? fallbackAfternoon : 0);
      const morningRegistered = apiData?.morningRegistered ?? 0;
      const morningPending = apiData?.morningPending ?? 0;
      const afternoonRegistered = apiData?.afternoonRegistered ?? 0;
      const afternoonPending = apiData?.afternoonPending ?? 0;

      data[dateStr] = {
        isAvailable,
        isUnscheduled: !isAvailable && !customDateSet.has(dateStr),
        isClosed: !isAvailable,
        isExcluded,
        isSuspended: dayEvent?.effect === 'Suspend',
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
        // Distinguish between a SlotCustomDate entry vs a modified-slot scheduled day.
        isSlotCustomDate: customDateSet.has(dateStr),
      };
    }
    return data;
  }, [year, month, daysInMonth, events, currentSchedulePerWeek, customDateSet, customDateMap, dayIndexToName, monthAvailability, slotDefaults]);

  const formatDateLabel = useCallback((dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const getSubtitle = useCallback((info) => {
    if (!info) return 'Not scheduled';
    if (info.isUnscheduled) return 'Not scheduled';
    if (info.isSlotCustomDate) return 'Custom date';
    return 'Regular slot';
  }, []);

  const getDayUtilization = (info) => {
    if (!info) return { capacity: 0, booked: 0, ratio: 0 };
    const capacity = Math.max(0, (info.morningAllowed || 0) + (info.afternoonAllowed || 0));
    const booked = Math.max(0, (info.morningBooked || 0) + (info.afternoonBooked || 0));
    const ratio = capacity > 0 ? Math.min(booked / capacity, 1) : 0;
    return { capacity, booked, ratio };
  };

  const getDayStatus = (info) => {
    if (!info || info.isUnscheduled) return 'none';
    if (info.isSuspended) return 'full';
    if (info.event) return 'event';

    const { capacity, ratio } = getDayUtilization(info);
    if (capacity <= 0 || info.isExcluded) return 'disabled';
    if (info.isSlotCustomDate || info.isCustomDate) return 'custom';
    if (ratio >= 1) return 'full';
    if (ratio >= 0.7) return 'filling';
    return 'open';
  };

  const estimateDropdownHeight = useCallback((info, mode = 'actions') => {
    if (mode === 'slots') {
      return info?.isUnscheduled ? 236 : 214;
    }

    if (info?.isUnscheduled) return 126;
    if (info?.isSlotCustomDate) return 154;
    return 126;
  }, []);

  const updateDropdownPosition = useCallback((dateStr, info, mode = 'actions') => {
    const anchor = cellRefs.current[dateStr];
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = mode === 'slots'
      ? Math.min(320, viewportWidth - 24)
      : Math.min(300, viewportWidth - 24);
    const menuHeight = estimateDropdownHeight(info, mode);
    const gap = 8;
    const edgePadding = 12;

    let left = rect.left + (rect.width / 2) - (menuWidth / 2);
    left = Math.max(edgePadding, Math.min(left, viewportWidth - menuWidth - edgePadding));

    const showAbove = rect.bottom + gap + menuHeight > viewportHeight - edgePadding;
    let top = showAbove ? rect.top - menuHeight - gap : rect.bottom + gap;
    top = Math.max(edgePadding, Math.min(top, viewportHeight - menuHeight - edgePadding));

    setDropdownPos({ top, left });
  }, [estimateDropdownHeight]);

  const closeInlineEditor = useCallback(() => {
    setInlineEditor(null);
    setSaving(false);
    onSelectDate?.(null, false);
  }, [onSelectDate]);

  // Close popup when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      closeInlineEditor();
    };

    if (inlineEditor) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [inlineEditor, closeInlineEditor]);

  // Reposition on viewport changes.
  useEffect(() => {
    if (!inlineEditor) return undefined;

    const info = daySlots[inlineEditor.dateStr];
    const syncPos = () => {
      updateDropdownPosition(inlineEditor.dateStr, info, inlineEditor.mode || 'actions');
    };

    syncPos();
    window.addEventListener('resize', syncPos);
    window.addEventListener('scroll', syncPos, true);
    return () => {
      window.removeEventListener('resize', syncPos);
      window.removeEventListener('scroll', syncPos, true);
    };
  }, [inlineEditor, daySlots, updateDropdownPosition]);

  // Auto-focus target slot when opening from a badge click.
  useEffect(() => {
    if (!inlineEditor || inlineEditor.mode !== 'slots') return;
    const focusSlot = inlineEditor.focusSlot;
    const targetRef = focusSlot === 'afternoon' ? afternoonInputRef : morningInputRef;
    const timer = setTimeout(() => {
      targetRef.current?.focus();
      targetRef.current?.select();
    }, 10);
    return () => clearTimeout(timer);
  }, [inlineEditor]);

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

  const openActionMenu = (dateStr) => {
    const info = daySlots[dateStr];
    if (!info) return;
    if (dateStr < todayStr) return;

    setInlineEditor({ dateStr, mode: 'actions', focusSlot: null });
    onSelectDate?.(dateStr, true);
    updateDropdownPosition(dateStr, info, 'actions');
  };

  const openSlotEditor = (dateStr, focusSlot = null) => {
    const info = daySlots[dateStr];
    if (!info) return;
    if (dateStr < todayStr) return;

    setEditorDraft({
      morningAllowed: info.morningAllowed ?? 0,
      afternoonAllowed: info.afternoonAllowed ?? 0,
    });
    setInlineEditor({ dateStr, mode: 'slots', focusSlot });
    onSelectDate?.(dateStr, true);
    updateDropdownPosition(dateStr, info, 'slots');
  };

  const handleSessionBadgeClick = (e, dateStr, session) => {
    e.stopPropagation();
    openSlotEditor(dateStr, session);
  };

  const updateDraftValue = (field, value) => {
    if (value === '') {
      setEditorDraft((prev) => ({ ...prev, [field]: '' }));
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setEditorDraft((prev) => ({ ...prev, [field]: parsed }));
  };

  const stepDraftValue = (field, delta) => {
    setEditorDraft((prev) => {
      const current = Number.parseInt(prev[field], 10);
      const safeCurrent = Number.isNaN(current) ? 0 : current;
      return {
        ...prev,
        [field]: Math.max(0, safeCurrent + delta),
      };
    });
  };

  const normalizedDraft = {
    morningAllowed: editorDraft.morningAllowed === '' || editorDraft.morningAllowed == null ? 0 : Number(editorDraft.morningAllowed),
    afternoonAllowed: editorDraft.afternoonAllowed === '' || editorDraft.afternoonAllowed == null ? 0 : Number(editorDraft.afternoonAllowed),
  };

  const persistDateSlots = async (targetDate, morningAllowed, afternoonAllowed) => {
    const original = daySlots[targetDate] || {};

    if (onSaveDateSlots) {
      await onSaveDateSlots(targetDate, morningAllowed, afternoonAllowed);
      return;
    }

    if (!onEditSessionLimit) return;

    if ((original.morningAllowed ?? 0) !== morningAllowed) {
      await onEditSessionLimit(targetDate, 'morning', morningAllowed);
    }
    if ((original.afternoonAllowed ?? 0) !== afternoonAllowed) {
      await onEditSessionLimit(targetDate, 'afternoon', afternoonAllowed);
    }
  };

  const handleSaveExistingDate = async () => {
    if (!inlineEditor) return;
    const targetDate = inlineEditor.dateStr;

    setSaving(true);
    try {
      await persistDateSlots(targetDate, normalizedDraft.morningAllowed, normalizedDraft.afternoonAllowed);
      closeInlineEditor();
    } catch (err) {
      console.error('Failed to save date slots:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewCustomDate = async () => {
    if (!inlineEditor || !onAddCustomDate) return;
    setSaving(true);
    try {
      await onAddCustomDate(
        inlineEditor.dateStr,
        normalizedDraft.morningAllowed,
        normalizedDraft.afternoonAllowed,
      );
      closeInlineEditor();
    } catch (err) {
      console.error('Failed to add custom date slots:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDisableCurrentDate = async () => {
    if (!inlineEditor) return;
    setSaving(true);
    try {
      await persistDateSlots(inlineEditor.dateStr, 0, 0);
      closeInlineEditor();
    } catch (err) {
      console.error('Failed to disable date:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReEnableRegularDate = async () => {
    if (!inlineEditor) return;
    setSaving(true);
    try {
      const morningDefault = slotDefaults?.morning ?? 0;
      const afternoonDefault = slotDefaults?.afternoon ?? 0;
      await persistDateSlots(inlineEditor.dateStr, morningDefault, afternoonDefault);
      closeInlineEditor();
    } catch (err) {
      console.error('Failed to re-enable date:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomDate = async () => {
    if (!inlineEditor || !onRemoveCustomDate) return;
    setSaving(true);
    try {
      await onRemoveCustomDate(inlineEditor.dateStr);
      closeInlineEditor();
    } catch (err) {
      console.error('Failed to delete custom date:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderSlotEditor = () => {
    const rowClass = 'grid grid-cols-2 gap-1.5';
    const morningCardClass = 'min-w-0 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-1.5';
    const afternoonCardClass = 'min-w-0 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-1.5';

    return (
      <div className={rowClass}>
        <div className={morningCardClass}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Sun className="h-3.5 w-3.5" />
              Morning
            </span>
            <span className="text-[10px] text-secondary-700 dark:text-neutral-300">Slots</span>
          </div>
          <div className="grid grid-cols-[26px_minmax(0,1fr)_26px] items-center gap-1">
            <button
              type="button"
              onClick={() => stepDraftValue('morningAllowed', -1)}
              className="h-7 w-[26px] rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-0 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              ref={morningInputRef}
              type="text"
              inputMode="numeric"
              value={editorDraft.morningAllowed}
              onChange={(e) => updateDraftValue('morningAllowed', e.target.value)}
              onBlur={() => {
                if (editorDraft.morningAllowed === '' || editorDraft.morningAllowed == null) {
                  setEditorDraft((prev) => ({ ...prev, morningAllowed: 0 }));
                }
              }}
              className="h-7 min-w-0 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-white/90 dark:bg-neutral-800 px-1.5 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => stepDraftValue('morningAllowed', 1)}
              className="h-7 w-[26px] rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 p-0 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className={afternoonCardClass}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <Clock className="h-3.5 w-3.5" />
              Afternoon
            </span>
            <span className="text-[10px] text-secondary-700 dark:text-neutral-300">Slots</span>
          </div>
          <div className="grid grid-cols-[26px_minmax(0,1fr)_26px] items-center gap-1">
            <button
              type="button"
              onClick={() => stepDraftValue('afternoonAllowed', -1)}
              className="h-7 w-[26px] rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-0 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              ref={afternoonInputRef}
              type="text"
              inputMode="numeric"
              value={editorDraft.afternoonAllowed}
              onChange={(e) => updateDraftValue('afternoonAllowed', e.target.value)}
              onBlur={() => {
                if (editorDraft.afternoonAllowed === '' || editorDraft.afternoonAllowed == null) {
                  setEditorDraft((prev) => ({ ...prev, afternoonAllowed: 0 }));
                }
              }}
              className="h-7 min-w-0 w-full rounded-md border border-sky-300 dark:border-sky-700 bg-white/90 dark:bg-neutral-800 px-1.5 text-center text-sm font-semibold text-secondary-900 dark:text-white outline-none focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => stepDraftValue('afternoonAllowed', 1)}
              className="h-7 w-[26px] rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/30 p-0 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
      {/* Month navigation */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-base font-bold tracking-wide text-secondary-700 dark:text-neutral-300">
          {monthNames[month]} {year}
        </h3>
        {!isCurrentMonth && (
          <button
            onClick={goToToday}
            className="rounded-md border border-primary-200 dark:border-primary-800 px-2.5 py-1 text-xs font-semibold text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            Today
          </button>
        )}
        {isCurrentMonth && <div className="w-14" />}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        {dayLabels.map((label) => (
          <div key={label} className="py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-secondary-700 dark:text-neutral-300 sm:text-sm">
            <span className="sm:hidden">{label.charAt(0)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="relative grid grid-cols-7">
        {calendarCells.map((cell, idx) => {
          if (cell.isOtherMonth) {
            return (
              <div key={`other-${idx}`} className="min-h-[72px] border-b border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1 opacity-40 overflow-hidden sm:p-1.5 md:min-h-0 md:aspect-square">
                <span className="text-xs text-secondary-700 dark:text-neutral-300 sm:text-sm">{cell.day}</span>
              </div>
            );
          }

          const slotInfo = daySlots[cell.dateStr] || {
            isUnscheduled: true,
            morningAllowed: 0,
            afternoonAllowed: 0,
            morningBooked: 0,
            afternoonBooked: 0,
          };

          const isPastDate = cell.dateStr < todayStr;
          const isSelected = cell.dateStr === selectedDate || inlineEditor?.dateStr === cell.dateStr;
          const isToday = cell.dateStr === todayStr;
          const showBadgeCounts = !slotInfo.isUnscheduled;
          const canOpen = !isPastDate;
          const utilization = getDayUtilization(slotInfo);
          const dayStatus = getDayStatus(slotInfo);

          const statusBackgroundClass = {
            open: 'bg-emerald-50/90 dark:bg-emerald-900/25',
            filling: 'bg-amber-50/90 dark:bg-amber-900/30',
            disabled: 'bg-amber-50/95 dark:bg-amber-900/30',
            full: 'bg-rose-50/90 dark:bg-rose-900/30',
            event: 'bg-sky-50/90 dark:bg-sky-900/30',
            custom: 'bg-violet-50/90 dark:bg-violet-900/40',
            none: 'bg-neutral-100/90 dark:bg-neutral-700/50',
          }[dayStatus];

          const statusHoverClass = {
            open: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
            filling: 'hover:bg-amber-100 dark:hover:bg-amber-900/30',
            disabled: 'hover:bg-amber-100 dark:hover:bg-amber-900/40',
            full: 'hover:bg-rose-100 dark:hover:bg-rose-900/30',
            event: 'hover:bg-sky-100 dark:hover:bg-sky-900/30',
            custom: 'hover:bg-violet-100 dark:hover:bg-violet-900/40',
            none: 'hover:bg-neutral-200 dark:hover:bg-neutral-700/70',
          }[dayStatus];

          const statusDotClass = {
            open: 'bg-emerald-400',
            filling: 'bg-amber-400',
            disabled: 'bg-orange-400',
            full: 'bg-rose-400',
            event: 'bg-sky-400',
            custom: 'bg-violet-400',
            none: '',
          }[dayStatus];

          const statusTitle = {
            open: 'Open',
            filling: 'Filling (>70%)',
            disabled: 'Disabled',
            full: 'Full/blocked',
            event: 'Event override',
            custom: 'Custom date',
            none: 'Not scheduled',
          }[dayStatus];

          const dayNumberColorClass = dayStatus === 'custom'
            ? 'text-violet-500 dark:text-violet-300'
            : dayStatus === 'open'
              ? 'text-emerald-500 dark:text-emerald-300'
              : dayStatus === 'filling'
                ? 'text-amber-600 dark:text-amber-300'
                  : dayStatus === 'disabled'
                    ? 'text-orange-600 dark:text-orange-300'
                : dayStatus === 'full'
                  ? 'text-rose-600 dark:text-rose-300'
                  : dayStatus === 'event'
                    ? 'text-sky-600 dark:text-sky-300'
                    : 'text-secondary-700 dark:text-neutral-300';

          const barFillPercent = utilization.booked > 0
            ? Math.max(Math.round(utilization.ratio * 100), 4)
            : 0;

          const barColorClass = utilization.ratio >= 1
            ? 'bg-rose-500'
            : utilization.ratio >= 0.7
              ? 'bg-amber-500'
              : dayStatus === 'disabled'
                ? 'bg-orange-500'
              : dayStatus === 'custom'
                ? 'bg-violet-500'
                : dayStatus === 'event'
                  ? 'bg-sky-500'
                  : 'bg-emerald-500';

          return (
            <div
              key={cell.dateStr}
              ref={(node) => {
                if (node) {
                  cellRefs.current[cell.dateStr] = node;
                } else {
                  delete cellRefs.current[cell.dateStr];
                }
              }}
              onClick={() => {
                if (!canOpen) return;
                openActionMenu(cell.dateStr);
              }}
              className={`group relative min-h-[72px] border-b border-r border-neutral-200 dark:border-neutral-700 px-1.5 pt-1 pb-3 transition-colors overflow-hidden sm:px-2 sm:pt-1.5 sm:pb-3 md:min-h-0 md:aspect-square ${
                canOpen ? `cursor-pointer ${statusHoverClass}` : 'cursor-not-allowed'
              } ${isSelected ? 'ring-2 ring-inset ring-primary-500' : ''} ${
                statusBackgroundClass
              } ${isPastDate ? 'opacity-50 saturate-50' : ''}`}
            >
              <div className="mb-0.5 flex items-start justify-between">
                <span
                  className={`text-sm font-bold leading-none sm:text-base ${
                    isToday
                      ? 'rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-800 px-1.5 py-0.5 text-amber-700 dark:text-amber-300'
                      : dayNumberColorClass
                  }`}
                >
                  {cell.day}
                </span>

                <div className="flex items-center gap-1">
                  {dayStatus !== 'none' && (
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} title={statusTitle} />
                  )}
                </div>
              </div>

              {showBadgeCounts && (
                <div className="mt-0.5 flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!canOpen) return;
                      handleSessionBadgeClick(e, cell.dateStr, 'morning');
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    title="Edit morning slots"
                  >
                    <Sun className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{`${slotInfo.morningBooked}/${slotInfo.morningAllowed}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      if (!canOpen) return;
                      handleSessionBadgeClick(e, cell.dateStr, 'afternoon');
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 px-1.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/30"
                    title="Edit afternoon slots"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{`${slotInfo.afternoonBooked}/${slotInfo.afternoonAllowed}`}</span>
                  </button>
                </div>
              )}

              {slotInfo.isSuspended && (
                <div className="mt-0.5 flex items-center justify-center gap-1 rounded-md bg-rose-50 dark:bg-rose-900/20 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  Suspended
                </div>
              )}

              {slotInfo?.event && !slotInfo?.isSuspended && (
                <p className="mt-0.5 truncate text-center text-[10px] font-medium text-sky-700 dark:text-sky-300">
                  {slotInfo.event.name}
                </p>
              )}

              {!slotInfo.isUnscheduled && utilization.capacity > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-neutral-300/50 dark:bg-neutral-700/70">
                  <div
                    className={`h-full transition-all ${barColorClass}`}
                    style={{ width: `${barFillPercent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {inlineEditor && (
          <div
            ref={popupRef}
            className={`fixed z-50 max-w-[calc(100vw-24px)] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 ${inlineEditor.mode === 'slots' ? 'w-[304px]' : 'w-[286px]'}`}
            style={{
              left: `${dropdownPos.left}px`,
              top: `${dropdownPos.top}px`,
            }}
          >
            {(() => {
              const info = daySlots[inlineEditor.dateStr] || { isUnscheduled: true };
              const subtitle = getSubtitle(info);
              const isCustom = info.isSlotCustomDate;
              const isDisabled = !info.isUnscheduled && (info.morningAllowed ?? 0) === 0 && (info.afternoonAllowed ?? 0) === 0;
              const isDisabledRegular = isDisabled && !isCustom;
              const isSlotMode = inlineEditor.mode === 'slots';

              return (
                <>
                  <div className="mb-1 flex items-start justify-between">
                    <div className="flex flex-col" style={{ gap: '3px' }}>
                      <p className="m-0 text-sm font-bold leading-[1.2] text-secondary-700 dark:text-neutral-300">{formatDateLabel(inlineEditor.dateStr)}</p>
                      <p className="m-0 text-xs leading-[1.2] text-secondary-500 dark:text-neutral-400">{subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeInlineEditor}
                      className="rounded-md p-0.5 text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-secondary-900 dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {isSlotMode ? (
                    <>
                      {renderSlotEditor()}

                      {info.isUnscheduled ? (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInlineEditor((prev) => prev ? { ...prev, mode: 'actions', focusSlot: null } : prev);
                              updateDropdownPosition(inlineEditor.dateStr, info, 'actions');
                            }}
                            disabled={saving}
                            className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm font-semibold text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveNewCustomDate}
                            disabled={saving}
                            className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveExistingDate}
                          disabled={saving}
                          className="mt-2 w-full rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </>
                  ) : info.isUnscheduled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditorDraft({
                          morningAllowed: slotDefaults?.morning ?? 25,
                          afternoonAllowed: slotDefaults?.afternoon ?? 25,
                        });
                        setInlineEditor((prev) => prev ? { ...prev, mode: 'slots', focusSlot: null } : prev);
                        updateDropdownPosition(inlineEditor.dateStr, info, 'slots');
                      }}
                      className="w-full rounded-lg border border-dashed border-neutral-200 dark:border-neutral-700 px-3 py-2.5 text-sm font-semibold text-secondary-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      Add custom date
                    </button>
                  ) : isCustom ? (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={handleDisableCurrentDate}
                        disabled={saving || isDisabled}
                        className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
                      >
                        {isDisabled ? 'Disabled' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCustomDate}
                        disabled={saving}
                        className="rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-50"
                      >
                        {saving ? 'Deleting...' : 'Delete custom date'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {isDisabledRegular ? (
                        <button
                          type="button"
                          onClick={handleReEnableRegularDate}
                          disabled={saving}
                          className="w-full rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50"
                        >
                          {saving ? 'Applying...' : 'Re-enable date'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDisableCurrentDate}
                          disabled={saving}
                          className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
                        >
                          {saving ? 'Applying...' : 'Disable this date'}
                        </button>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-secondary-700 dark:text-neutral-300">Status</span>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Open
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Filling (&gt;70%)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Disabled
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Full
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Event
        </div>
        <div className="flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Custom Date
        </div>
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
