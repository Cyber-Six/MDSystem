/**
 * Appointment Screen - Multi-step booking wizard
 * Mirrors mds-patient appointment module
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, colors } from '../../context/ThemeContext';
import {
  STATUS,
  SESSION,
  ACTIVE_STATUSES,
  getAppointmentStatus,
  listOpenAppointments,
  listRequirements,
  listCustomDates,
  getScheduleAvailability,
  submitAppointment,
  cancelAppointment,
  stageFile,
  unstageFile,
} from '../../services/appointment-service';

const STEP_LABELS = ['Select Type', 'Date & Session', 'Requirements', 'Review'];

// ── Helpers ──────────────────────────────────────────────────────────────────

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const statusColor = (status: string) => {
  const map: Record<string, { bg: string; text: string }> = {
    Pending: { bg: colors.primary[100], text: colors.primary[800] },
    Scheduled: { bg: colors.accent[100], text: colors.accent[600] },
    InProgress: { bg: colors.accent[100], text: colors.accent[700] },
    Completed: { bg: colors.success[100], text: colors.success[600] },
    Rejected: { bg: colors.error[100], text: colors.error[600] },
  };
  return map[status] || { bg: colors.neutral[200], text: colors.neutral[700] };
};

// ── Sub-components ───────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ step: number; isDark: boolean }> = ({
  step,
  isDark,
}) => (
  <View style={styles.stepperRow}>
    {STEP_LABELS.map((label, i) => (
      <React.Fragment key={i}>
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              i < step
                ? { backgroundColor: colors.success[500] }
                : i === step
                ? { backgroundColor: colors.primary[500] }
                : {
                    backgroundColor: isDark
                      ? colors.neutral[700]
                      : colors.neutral[200],
                  },
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                {
                  color:
                    i <= step
                      ? '#FFFFFF'
                      : isDark
                      ? colors.neutral[400]
                      : colors.neutral[500],
                },
              ]}
            >
              {i < step ? '✓' : i + 1}
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              {
                color:
                  i <= step
                    ? isDark
                      ? colors.primary[300]
                      : colors.primary[700]
                    : isDark
                    ? colors.neutral[500]
                    : colors.neutral[400],
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        {i < STEP_LABELS.length - 1 && (
          <View
            style={[
              styles.stepLine,
              {
                backgroundColor:
                  i < step ? colors.success[500] : isDark ? colors.neutral[700] : colors.neutral[200],
              },
            ]}
          />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ── Main Component ───────────────────────────────────────────────────────────

export const AppointmentScreen: React.FC = () => {
  const { isDark } = useTheme();

  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Wizard state
  const [step, setStep] = useState(0);
  const [schedulers, setSchedulers] = useState<any[]>([]);
  const [selectedScheduler, setSelectedScheduler] = useState<any>(null);

  // Step 1 - date/session
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [availability, setAvailability] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Step 2 - requirements
  const [requirements, setRequirements] = useState<any[]>([]);
  const [uploadedRequirements, setUploadedRequirements] = useState<
    Array<{ scheduleRequirementId: string; filename: string; localUri: string }>
  >([]);
  const [pickingForReq, setPickingForReq] = useState<string | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Rejection
  const [rejectionRecord, setRejectionRecord] = useState<any>(null);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Lightbox for local requirement image previews
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  // Calendar state
  const now = new Date();
  const today = localDateStr();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDateStr(d);
  })();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // ── Load status ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await getAppointmentStatus();
      const status = record?.status ?? null;
      setCurrentStatus(status);

      if (status === STATUS.REJECTED || status === STATUS.EXPIRED) {
        setRejectionRecord(record);
        const list = await listOpenAppointments();
        setSchedulers(list);
      } else {
        setRejectionRecord(null);
        if (!status || !ACTIVE_STATUSES.includes(status)) {
          const list = await listOpenAppointments();
          setSchedulers(list);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectScheduler = async (scheduler: any) => {
    setSelectedScheduler(scheduler);
    setSelectedDate('');
    setSelectedSession('');
    setAvailability(null);
    // Clear any previously staged requirement files when changing scheduler
    for (const r of uploadedRequirements) {
      unstageFile(r.filename).catch(() => {});
    }
    setUploadedRequirements([]);

    if (scheduler.containsCustomDates) {
      try {
        const dates = await listCustomDates(scheduler.id);
        setCustomDates(dates);
      } catch {
        setCustomDates([]);
      }
    } else {
      setCustomDates([]);
    }
    setStep(1);
  };

  const handleDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSession('');
    setAvailability(null);
    if (!dateStr || !selectedScheduler?.id) return;

    setLoadingAvailability(true);
    try {
      const avail = await getScheduleAvailability(selectedScheduler.id, dateStr);
      setAvailability(avail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleAdvanceToRequirements = async () => {
    try {
      const reqs = await listRequirements(selectedScheduler.id);
      setRequirements(reqs);
      setStep(reqs.length === 0 ? 3 : 2);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const reqs = uploadedRequirements.map((r) => ({
        scheduleRequirementId: r.scheduleRequirementId,
        filename: r.filename,
      }));
      await submitAppointment(selectedScheduler.id, selectedDate, selectedSession, reqs);
      setSuccessMessage('Your appointment has been submitted successfully!');
      setUploadedRequirements([]);
      await loadStatus();
      setStep(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickRequirement = async (reqId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access your photo library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'image.jpg';
    const type = asset.mimeType ?? 'image/jpeg';

    setPickingForReq(reqId);
    try {
      // Unstage any previous upload for this requirement
      const existing = uploadedRequirements.find((r) => r.scheduleRequirementId === reqId);
      if (existing) {
        await unstageFile(existing.filename).catch(() => {});
      }

      const stagedFileId = await stageFile(asset.uri, name, type);

      setUploadedRequirements((prev) => [
        ...prev.filter((r) => r.scheduleRequirementId !== reqId),
        { scheduleRequirementId: reqId, filename: stagedFileId, localUri: asset.uri },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file. Please try again.');
    } finally {
      setPickingForReq(null);
    }
  };

  const handleRemoveRequirement = async (reqId: string) => {
    const existing = uploadedRequirements.find((r) => r.scheduleRequirementId === reqId);
    if (existing) {
      unstageFile(existing.filename).catch(() => {});
      setUploadedRequirements((prev) => prev.filter((r) => r.scheduleRequirementId !== reqId));
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await cancelAppointment();
      setSuccessMessage('Appointment cancelled.');
      setShowCancelModal(false);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  // ── Calendar helpers ───────────────────────────────────────────────────────

  const isScheduleMatch = (dateStr: string) => {
    if (!selectedScheduler) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    if (selectedScheduler.schedulePerWeek?.includes(dayName)) return true;
    if (customDates.some((cd: string) => cd === dateStr || cd?.split('T')[0] === dateStr)) return true;
    return false;
  };

  const isDateAllowed = (dateStr: string) => {
    if (dateStr < today || dateStr > maxDate) return false;
    return isScheduleMatch(dateStr);
  };

  const fmtDate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const calendarCells: Array<{ day: number; dateStr?: string; isOtherMonth: boolean }> = [];
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--)
    calendarCells.push({ day: prevMonthDays - i, isOtherMonth: true });
  for (let d = 1; d <= daysInMonth; d++)
    calendarCells.push({ day: d, isOtherMonth: false, dateStr: fmtDate(viewYear, viewMonth, d) });
  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++)
    calendarCells.push({ day: i, isOtherMonth: true });

  // Session slots
  const morningRemaining = availability
    ? availability.morningAllowed - availability.morningRegistered - availability.morningPending
    : 0;
  const afternoonRemaining = availability
    ? availability.afternoonAllowed - availability.afternoonRegistered - availability.afternoonPending
    : 0;

  // All digital requirements must be uploaded before proceeding
  const allDigitalUploaded =
    requirements.filter((r) => r.isDigital).length === 0 ||
    requirements
      .filter((r) => r.isDigital)
      .every((r) => uploadedRequirements.some((u) => u.scheduleRequirementId === r.id));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
            Loading appointments...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
            progressBackgroundColor={colors.secondary[900]}
          />
        }
      >
        {/* Header Banner */}
        <View style={[styles.headerBanner, { backgroundColor: colors.primary[500] }]}>
          <Text style={styles.headerIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerSubtitle}>Schedule and manage your appointments</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.alertBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50], borderColor: colors.error[400] }]}>
            <Text style={{ color: colors.error[500], flex: 1 }}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={{ color: colors.error[500], fontWeight: 'bold', fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Success */}
        {successMessage !== '' && (
          <View style={[styles.alertBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : colors.success[50], borderColor: colors.success[400] }]}>
            <Text style={{ color: colors.success[500], flex: 1 }}>{successMessage}</Text>
            <TouchableOpacity onPress={() => setSuccessMessage('')}>
              <Text style={{ color: colors.success[500], fontWeight: 'bold', fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Active Appointment ──────────────────────────────────────────── */}
        {currentStatus && ACTIVE_STATUSES.includes(currentStatus) ? (
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
              Your Current Appointment
            </Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Status:</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(currentStatus).bg }]}>
                <Text style={[styles.statusText, { color: statusColor(currentStatus).text }]}>{currentStatus}</Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
              You currently have an active appointment. You cannot book another one until this is completed or cancelled.
            </Text>
            <TouchableOpacity
              style={[styles.dangerButton, { opacity: cancelling ? 0.5 : 1 }]}
              onPress={() => setShowCancelModal(true)}
              disabled={cancelling}
            >
              <Text style={styles.dangerButtonText}>
                {cancelling ? 'Cancelling...' : 'Cancel Appointment'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : rejectionRecord ? (
          /* ── Rejection / Expired Notice ────────────────────────────── */
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <View style={styles.rejectionHeader}>
              <View style={[styles.rejectionIcon, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : colors.error[50] }]}>
                <Text style={{ fontSize: 20 }}>✕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  {rejectionRecord.status === STATUS.EXPIRED ? 'Appointment Expired' : 'Appointment Rejected'}
                </Text>
                <Text style={[styles.cardBody, { color: isDark ? colors.neutral[400] : colors.neutral[600], marginTop: 4 }]}>
                  {rejectionRecord.status === STATUS.EXPIRED
                    ? 'Your previous appointment has expired.'
                    : 'Your previous appointment request was not approved.'}
                </Text>
              </View>
            </View>
            {rejectionRecord?.notes && (
              <View style={[styles.reasonBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50], borderColor: colors.error[300] }]}>
                <Text style={{ color: colors.error[600], fontSize: 11, fontWeight: '600', marginBottom: 4 }}>REASON</Text>
                <Text style={{ color: colors.error[700], fontSize: 14 }}>{rejectionRecord.notes}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton]}
              onPress={() => {
                setRejectionRecord(null);
              }}
            >
              <Text style={styles.primaryButtonText}>OK, Book New Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Booking Wizard ────────────────────────────────────────── */}
            <StepIndicator step={step} isDark={isDark} />

            {/* Step 0: Scheduler Picker */}
            {step === 0 && (
              <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Select Appointment Type
                </Text>
                {schedulers.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                    <Text style={styles.emptyIcon}>📅</Text>
                    <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                      No appointment types are currently available.
                    </Text>
                  </View>
                ) : (
                  schedulers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.schedulerCard,
                        {
                          backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                          borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                        },
                      ]}
                      onPress={() => handleSelectScheduler(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.schedulerLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                        {s.label}
                      </Text>
                      <Text style={[styles.schedulerLocation, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                        {s.location}
                      </Text>
                      {s.schedulePerWeek && (
                        <View style={styles.dayPills}>
                          {s.schedulePerWeek.map((day: string) => (
                            <View key={day} style={[styles.dayPill, { backgroundColor: isDark ? 'rgba(241,197,38,0.15)' : colors.primary[50] }]}>
                              <Text style={[styles.dayPillText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>
                                {day.slice(0, 3)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={styles.slotInfo}>
                        <Text style={[styles.slotText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                          AM: {s.morningAllowed} slots | PM: {s.afternoonAllowed} slots
                        </Text>
                      </View>
                      {s.notes && (
                        <Text style={[styles.schedulerNotes, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
                          {s.notes}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Step 1: Date & Session */}
            {step === 1 && selectedScheduler && (
              <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Select Date & Session
                </Text>
                <Text style={[styles.schedulerSub, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                  {selectedScheduler.label} — {selectedScheduler.location}
                </Text>

                {/* Calendar */}
                <View style={[styles.calendar, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
                  <View style={[styles.calendarHeader, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
                    <TouchableOpacity onPress={() => {
                      if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
                      else setViewMonth(viewMonth - 1);
                    }}>
                      <Text style={[styles.calendarNav, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>‹</Text>
                    </TouchableOpacity>
                    <Text style={[styles.calendarTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
                      else setViewMonth(viewMonth + 1);
                    }}>
                      <Text style={[styles.calendarNav, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>›</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Day headers */}
                  <View style={styles.calendarDayHeaders}>
                    {DAY_LABELS.map((d, i) => (
                      <View key={i} style={styles.calendarDayHeaderCell}>
                        <Text style={[styles.calendarDayHeaderText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Calendar grid */}
                  <View style={styles.calendarGrid}>
                    {calendarCells.map((cell, idx) => {
                      const isAllowed = !cell.isOtherMonth && cell.dateStr ? isDateAllowed(cell.dateStr) : false;
                      const isSelected = cell.dateStr === selectedDate;
                      const isToday = cell.dateStr === today;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.calendarCell,
                            isSelected && { backgroundColor: isDark ? 'rgba(241,197,38,0.2)' : colors.primary[50] },
                            isAllowed && !isSelected && { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : colors.success[50] },
                          ]}
                          disabled={!isAllowed}
                          onPress={() => cell.dateStr && handleDateChange(cell.dateStr)}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              cell.isOtherMonth && { color: isDark ? colors.neutral[700] : colors.neutral[300] },
                              !cell.isOtherMonth && !isAllowed && { color: isDark ? colors.neutral[600] : colors.neutral[300] },
                              isAllowed && { color: isDark ? colors.success[300] : colors.success[700] },
                              isSelected && { color: isDark ? colors.primary[300] : colors.primary[700], fontWeight: 'bold' },
                              isToday && !isSelected && { color: colors.primary[500], fontWeight: 'bold' },
                            ]}
                          >
                            {cell.day}
                          </Text>
                          {isAllowed && !isSelected && (
                            <View style={[styles.availableDot, { backgroundColor: colors.success[500] }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Loading availability */}
                {loadingAvailability && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                    <Text style={[styles.loadingSmallText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                      Checking availability...
                    </Text>
                  </View>
                )}

                {/* Session picker */}
                {availability && selectedDate && isDateAllowed(selectedDate) && (
                  <View style={styles.sessionSection}>
                    <Text style={[styles.sessionTitle, { color: isDark ? colors.neutral[300] : colors.neutral[700] }]}>
                      Select session for{' '}
                      <Text style={{ fontWeight: 'bold', color: isDark ? colors.neutral[100] : colors.secondary[900] }}>
                        {selectedDate}
                      </Text>
                    </Text>
                    <View style={styles.sessionRow}>
                      {/* Morning */}
                      <TouchableOpacity
                        style={[
                          styles.sessionCard,
                          {
                            borderColor:
                              selectedSession === SESSION.MORNING
                                ? colors.primary[500]
                                : isDark
                                ? colors.neutral[700]
                                : colors.neutral[200],
                            backgroundColor:
                              selectedSession === SESSION.MORNING
                                ? isDark
                                  ? 'rgba(241,197,38,0.1)'
                                  : colors.primary[50]
                                : 'transparent',
                            opacity: morningRemaining <= 0 ? 0.5 : 1,
                          },
                        ]}
                        disabled={morningRemaining <= 0}
                        onPress={() => setSelectedSession(SESSION.MORNING)}
                      >
                        <Text style={[styles.sessionName, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Morning</Text>
                        <Text style={[styles.sessionTime, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>8 AM – 12 PM</Text>
                        <Text style={{ color: morningRemaining <= 0 ? colors.error[500] : colors.success[500], fontSize: 13, marginTop: 4 }}>
                          {morningRemaining <= 0 ? 'Full' : `${morningRemaining} slot${morningRemaining !== 1 ? 's' : ''}`}
                        </Text>
                      </TouchableOpacity>

                      {/* Afternoon */}
                      <TouchableOpacity
                        style={[
                          styles.sessionCard,
                          {
                            borderColor:
                              selectedSession === SESSION.AFTERNOON
                                ? colors.primary[500]
                                : isDark
                                ? colors.neutral[700]
                                : colors.neutral[200],
                            backgroundColor:
                              selectedSession === SESSION.AFTERNOON
                                ? isDark
                                  ? 'rgba(241,197,38,0.1)'
                                  : colors.primary[50]
                                : 'transparent',
                            opacity: afternoonRemaining <= 0 ? 0.5 : 1,
                          },
                        ]}
                        disabled={afternoonRemaining <= 0}
                        onPress={() => setSelectedSession(SESSION.AFTERNOON)}
                      >
                        <Text style={[styles.sessionName, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Afternoon</Text>
                        <Text style={[styles.sessionTime, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>1 PM – 5 PM</Text>
                        <Text style={{ color: afternoonRemaining <= 0 ? colors.error[500] : colors.success[500], fontSize: 13, marginTop: 4 }}>
                          {afternoonRemaining <= 0 ? 'Full' : `${afternoonRemaining} slot${afternoonRemaining !== 1 ? 's' : ''}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Navigation */}
                <View style={styles.navRow}>
                  <TouchableOpacity style={[styles.backButton, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]} onPress={() => setStep(0)}>
                    <Text style={[styles.backButtonText, { color: isDark ? colors.neutral[200] : colors.secondary[700] }]}>‹ Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, { opacity: !selectedDate || !selectedSession ? 0.5 : 1 }]}
                    disabled={!selectedDate || !selectedSession}
                    onPress={handleAdvanceToRequirements}
                  >
                    <Text style={styles.primaryButtonText}>Next ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 2: Requirements (skip if none) */}
            {step === 2 && (
              <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Upload Requirements
                </Text>
                <Text style={[styles.cardBody, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                  Please upload all required documents before submitting.
                </Text>
                {requirements.map((req) => {
                  const uploaded = uploadedRequirements.find(
                    (r) => r.scheduleRequirementId === req.id,
                  );
                  const isPickingThis = pickingForReq === req.id;
                  return (
                    <View
                      key={req.id}
                      style={[styles.reqItem, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}
                    >
                      <Text style={[styles.reqLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                        {req.label}
                      </Text>
                      {req.notes ? (
                        <Text style={[styles.reqNotes, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                          {req.notes}
                        </Text>
                      ) : null}

                      {req.isDigital ? (
                        uploaded ? (
                          <View style={styles.reqThumbWrap}>
                            <TouchableOpacity
                              onPress={() => setLightboxUri(uploaded.localUri)}
                              activeOpacity={0.85}
                            >
                              <Image
                                source={{ uri: uploaded.localUri }}
                                style={styles.reqThumb}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                            <View style={styles.reqThumbActions}>
                              <TouchableOpacity
                                style={[styles.reqActionBtn, {
                                  backgroundColor: isDark ? colors.neutral[600] : colors.neutral[100],
                                }]}
                                onPress={() => setLightboxUri(uploaded.localUri)}
                              >
                                <Text style={{ fontSize: 13, color: isDark ? colors.neutral[200] : colors.secondary[800] }}>
                                  👁 View
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.reqActionBtn, {
                                  backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50],
                                }]}
                                onPress={() => handleRemoveRequirement(req.id)}
                              >
                                <Text style={{ fontSize: 13, color: colors.error[600] }}>✕ Remove</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.reqActionBtn, {
                                  backgroundColor: isDark ? 'rgba(241,197,38,0.12)' : colors.primary[50],
                                  opacity: isPickingThis ? 0.5 : 1,
                                }]}
                                onPress={() => handlePickRequirement(req.id)}
                                disabled={isPickingThis}
                              >
                                {isPickingThis ? (
                                  <ActivityIndicator size="small" color={colors.primary[500]} />
                                ) : (
                                  <Text style={{ fontSize: 13, color: isDark ? colors.primary[300] : colors.primary[700] }}>
                                    ↺ Replace
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.reqUploadBtn, {
                              backgroundColor: isDark ? 'rgba(241,197,38,0.08)' : colors.primary[50],
                              borderColor: isDark ? 'rgba(241,197,38,0.3)' : colors.primary[200],
                              opacity: isPickingThis ? 0.5 : 1,
                            }]}
                            onPress={() => handlePickRequirement(req.id)}
                            disabled={isPickingThis}
                            activeOpacity={0.7}
                          >
                            {isPickingThis ? (
                              <ActivityIndicator size="small" color={colors.primary[500]} />
                            ) : (
                              <Text style={{ fontSize: 18 }}>📎</Text>
                            )}
                            <Text style={[styles.reqUploadBtnText, {
                              color: isDark ? colors.primary[300] : colors.primary[700],
                            }]}>
                              {isPickingThis ? 'Uploading...' : 'Tap to upload image'}
                            </Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <View style={[styles.reqPhysicalBadge, {
                          backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF',
                        }]}>
                          <Text style={{ fontSize: 12, color: isDark ? '#A5B4FC' : '#4F46E5' }}>
                            📋 Bring physical copy
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={() => setStep(1)}
                  >
                    <Text style={[styles.backButtonText, { color: isDark ? colors.neutral[200] : colors.secondary[700] }]}>‹ Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, { opacity: allDigitalUploaded ? 1 : 0.5 }]}
                    disabled={!allDigitalUploaded}
                    onPress={() => setStep(3)}
                  >
                    <Text style={styles.primaryButtonText}>Next ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Review & Submit
                </Text>
                <View style={styles.reviewList}>
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Type</Text>
                    <Text style={[styles.reviewValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{selectedScheduler?.label}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Location</Text>
                    <Text style={[styles.reviewValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{selectedScheduler?.location}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Date</Text>
                    <Text style={[styles.reviewValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{selectedDate}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Session</Text>
                    <Text style={[styles.reviewValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      {selectedSession === SESSION.MORNING ? 'Morning (8 AM – 12 PM)' : 'Afternoon (1 PM – 5 PM)'}
                    </Text>
                  </View>
                  {uploadedRequirements.length > 0 && (
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                        Requirements
                      </Text>
                      <Text style={[styles.reviewValue, { color: colors.success[600] }]}>
                        {uploadedRequirements.length} file{uploadedRequirements.length !== 1 ? 's' : ''} uploaded ✓
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={() => setStep(requirements.length > 0 ? 2 : 1)}
                  >
                    <Text style={[styles.backButtonText, { color: isDark ? colors.neutral[200] : colors.secondary[700] }]}>‹ Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, { opacity: submitting ? 0.5 : 1 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
                    <Text style={styles.submitButtonText}>
                      {submitting ? 'Submitting...' : 'Submit Appointment'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalWarningIcon, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : colors.error[50] }]}>
                <Text style={{ fontSize: 20, color: colors.error[500] }}>⚠️</Text>
              </View>
              <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Cancel Appointment</Text>
            </View>
            <Text style={[styles.modalBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
              Are you sure you want to cancel your appointment? This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                onPress={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                <Text style={[styles.modalSecondaryText, { color: isDark ? colors.neutral[200] : colors.neutral[700] }]}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, { opacity: cancelling ? 0.5 : 1 }]}
                onPress={handleCancel}
                disabled={cancelling}
              >
                {cancelling && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />}
                <Text style={styles.dangerButtonText}>{cancelling ? 'Cancelling...' : 'Yes, Cancel'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Lightbox — Requirement previews */}
      <Modal
        visible={lightboxUri !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightboxUri(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxUri(null)}
        >
          {lightboxUri && (
            <Image
              source={{ uri: lightboxUri }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxUri(null)}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          >
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
  },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },

  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusLabel: { fontSize: 14 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },

  rejectionHeader: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  rejectionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reasonBox: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 16 },

  primaryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  dangerButton: {
    backgroundColor: colors.error[500],
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dangerButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  backButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  backButtonText: { fontWeight: '600', fontSize: 15 },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center', width: 60 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 12, fontWeight: '600' },
  stepLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  stepLine: { flex: 1, height: 2, marginTop: 14 },

  // Scheduler cards
  schedulerCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  schedulerLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  schedulerLocation: { fontSize: 12, marginBottom: 8 },
  schedulerSub: { fontSize: 13, marginBottom: 16 },
  dayPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  dayPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  dayPillText: { fontSize: 11, fontWeight: '500' },
  slotInfo: { marginTop: 4 },
  slotText: { fontSize: 12 },
  schedulerNotes: { fontSize: 12, fontStyle: 'italic', marginTop: 6 },

  // Calendar
  calendar: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  calendarNav: { fontSize: 24, fontWeight: '300', paddingHorizontal: 8 },
  calendarTitle: { fontSize: 15, fontWeight: '600' },
  calendarDayHeaders: { flexDirection: 'row' },
  calendarDayHeaderCell: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  calendarDayHeaderText: { fontSize: 12, fontWeight: '500' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  calendarDayText: { fontSize: 13 },
  availableDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  loadingSmallText: { fontSize: 13 },

  // Sessions
  sessionSection: { marginBottom: 16 },
  sessionTitle: { fontSize: 14, marginBottom: 12 },
  sessionRow: { flexDirection: 'row', gap: 12 },
  sessionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  sessionName: { fontSize: 16, fontWeight: '600' },
  sessionTime: { fontSize: 12, marginTop: 2 },

  // Navigation row
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },

  // Review
  reviewList: { marginBottom: 16 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  reviewLabel: { fontSize: 14 },
  reviewValue: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  // Requirements
  reqItem: { padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  reqLabel: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  reqNotes: { fontSize: 12, marginBottom: 6 },
  reqUploadHint: { fontSize: 12, fontStyle: 'italic' },
  reqUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  reqUploadBtnText: { fontSize: 13, fontWeight: '500' },
  reqThumbWrap: { marginTop: 8 },
  reqThumb: { width: '100%', height: 140, borderRadius: 10 },
  reqThumbActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  reqActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  reqPhysicalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '78%' },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // Empty state
  emptyState: { padding: 32, borderRadius: 12, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalWarningIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalSecondaryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalSecondaryText: { fontWeight: '500', fontSize: 14 },
});

export default AppointmentScreen;
