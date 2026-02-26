import React, { useState, useEffect, useCallback } from 'react';
import {
  getAppointmentStatus,
  listOpenAppointments,
  listRequirements,
  listCustomDates,
  getScheduleAvailability,
  submitAppointment,
  cancelAppointment,
  STATUS,
  SESSION,
  ACTIVE_STATUSES,
} from './patient-appointment-service';

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const Spinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const statusColor = (status) => {
  const map = {
    [STATUS.PENDING]: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    [STATUS.SCHEDULED]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    [STATUS.COMPLETED]: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    [STATUS.REJECTED]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.CANCELLED_PATIENT]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.CANCELLED_MEDICAL]: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    [STATUS.NO_SHOW]: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    [STATUS.EXPIRED]: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300',
  };
  return map[status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
};

const STEP_LABELS = ['Select Type', 'Date & Session', 'Requirements', 'Review & Submit'];

// Day-name to JS getDay() index mapping
const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// ── Main Component ────────────────────────────────────────────────────────────

const PatientAppointment = () => {
  // Top-level state
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wizard state
  const [step, setStep] = useState(0);
  const [schedulers, setSchedulers] = useState([]);
  const [selectedScheduler, setSelectedScheduler] = useState(null);

  // Step 1 — date/session
  const [customDates, setCustomDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [availability, setAvailability] = useState(null);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Step 2 — requirements
  const [requirements, setRequirements] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState({}); // { reqId: filename }

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Initial load ──────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getAppointmentStatus();
      setCurrentStatus(status);

      // If no active appointment, load schedulers for booking
      if (!status || !ACTIVE_STATUSES.includes(status)) {
        const list = await listOpenAppointments();
        setSchedulers(list);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectScheduler = async (scheduler) => {
    setSelectedScheduler(scheduler);
    setSelectedDate('');
    setSelectedSession('');
    setAvailability(null);

    // Pre-load custom dates if the scheduler uses them
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

  const handleDateChange = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSession('');
    setAvailability(null);

    if (!dateStr) return;
    setLoadingAvailability(true);
    try {
      const avail = await getScheduleAvailability(selectedScheduler.id, dateStr);
      setAvailability(avail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
  };

  const handleAdvanceToRequirements = async () => {
    try {
      const reqs = await listRequirements(selectedScheduler.id);
      setRequirements(reqs);
      setUploadedFiles({});
      if (reqs.length === 0) {
        // No requirements — skip straight to review
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = (reqId, filename) => {
    setUploadedFiles((prev) => ({ ...prev, [reqId]: filename }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const reqPayload = requirements.map((r) => ({
        scheduleRequirementId: r.id,
        filename: uploadedFiles[r.id] || '',
      }));
      await submitAppointment(selectedScheduler.id, selectedDate, selectedSession, reqPayload);
      setSuccessMessage('Your appointment has been submitted successfully!');
      // Reload status to show active appointment card
      await loadStatus();
      setStep(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your appointment?')) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelAppointment();
      setSuccessMessage('Appointment cancelled.');
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // ── Date validation helper ────────────────────────────────────────────────

  const isDateAllowed = (dateStr) => {
    if (!selectedScheduler) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

    // Check weekly schedule
    if (selectedScheduler.schedulePerWeek?.includes(dayName)) return true;

    // Check custom dates
    if (customDates.some((cd) => cd === dateStr || cd?.split('T')[0] === dateStr)) return true;

    return false;
  };

  // Min/max date for calendar input
  const today = new Date().toISOString().split('T')[0];
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // MAX_SCHEDULING_DAYS default
    return d.toISOString().split('T')[0];
  })();

  // Slots remaining helpers
  const morningRemaining = availability
    ? availability.morningAllowed - availability.morningRegistered - availability.morningPending
    : 0;
  const afternoonRemaining = availability
    ? availability.afternoonAllowed - availability.afternoonRegistered - availability.afternoonPending
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner />
        <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading appointments...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="rounded-2xl p-6 mb-6 bg-primary-500">
        <div className="flex items-center gap-4">
          <div className="w-10 h-12 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-white" style={{ margin: 0 }}>Appointments</h1>
            <p className="text-white/80 text-sm mt-1" style={{ margin: 0 }}>Schedule and manage your medical appointments</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">&times;</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700 font-bold ml-4">&times;</button>
        </div>
      )}

      {/* ── Active Appointment Card ─────────────────────────────────────────── */}
      {currentStatus && ACTIVE_STATUSES.includes(currentStatus) ? (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Your Current Appointment</h2>
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Status:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(currentStatus)}`}>
              {currentStatus}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            You currently have an active appointment. You cannot book another one until this is completed or cancelled.
          </p>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {cancelling && <Spinner />}
            <span>{cancelling ? 'Cancelling...' : 'Cancel Appointment'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* ── Booking Wizard ─────────────────────────────────────────────── */}

          {/* Stepper */}
          <div className="mb-8">
            <div className="max-w-2xl mx-auto flex items-start">
              {STEP_LABELS.map((label, i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                      ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-primary-500 text-secondary-900 ring-4 ring-primary-300 dark:ring-primary-800' : 'bg-stone-200 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'}`}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span className={`mt-1.5 text-xs text-center hidden sm:block whitespace-nowrap ${i <= step ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-4 ${i < step ? 'bg-green-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step 0 — Select Appointment Type */}
          {step === 0 && (
            <div className="bg-stone-50 dark:bg-neutral-900 rounded-xl shadow-sm border border-stone-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-6" style={{ margin: 0 }}>Select Appointment Type</h2>
              {schedulers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-secondary-500 dark:text-neutral-400">No appointment types are currently available.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schedulers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectScheduler(s)}
                      className="text-left p-5 border border-stone-200 dark:border-neutral-700 rounded-xl shadow-md bg-white dark:bg-neutral-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition-all group"
                    >
                      <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-1">
                        {s.label}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{s.location}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.schedulePerWeek?.map((day) => (
                          <span key={day} className="px-2 py-0.5 text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded">
                            {day.slice(0, 3)}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        <span>AM: {s.morningAllowed} slots</span>
                        <span className="mx-2">|</span>
                        <span>PM: {s.afternoonAllowed} slots</span>
                      </div>
                      {s.notes && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 italic">{s.notes}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Select Date & Session */}
          {step === 1 && selectedScheduler && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Select Date &amp; Session</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{selectedScheduler.label} — {selectedScheduler.location}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
                Available days: {selectedScheduler.schedulePerWeek?.join(', ')} | Bookings up to 7 days ahead
              </p>

              {/* Date picker */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Choose a date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={today}
                  max={maxDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full max-w-xs px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {selectedDate && !isDateAllowed(selectedDate) && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    This date is not available for the selected appointment type.
                  </p>
                )}
              </div>

              {/* Availability */}
              {loadingAvailability && (
                <div className="flex items-center space-x-2 mb-4">
                  <Spinner />
                  <span className="text-sm text-neutral-500">Checking availability...</span>
                </div>
              )}

              {availability && selectedDate && isDateAllowed(selectedDate) && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Select session</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Morning */}
                    <button
                      disabled={morningRemaining <= 0}
                      onClick={() => handleSessionSelect(SESSION.MORNING)}
                      className={`p-4 rounded-lg border-2 text-left transition-all
                        ${selectedSession === SESSION.MORNING
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : morningRemaining <= 0
                            ? 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer'}`}
                    >
                      <p className="font-semibold text-neutral-900 dark:text-white">Morning</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">8:00 AM — 12:00 PM</p>
                      <p className={`text-sm mt-1 ${morningRemaining <= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {morningRemaining <= 0 ? 'Full' : `${morningRemaining} slot${morningRemaining !== 1 ? 's' : ''} remaining`}
                      </p>
                    </button>
                    {/* Afternoon */}
                    <button
                      disabled={afternoonRemaining <= 0}
                      onClick={() => handleSessionSelect(SESSION.AFTERNOON)}
                      className={`p-4 rounded-lg border-2 text-left transition-all
                        ${selectedSession === SESSION.AFTERNOON
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : afternoonRemaining <= 0
                            ? 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer'}`}
                    >
                      <p className="font-semibold text-neutral-900 dark:text-white">Afternoon</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">1:00 PM — 5:00 PM</p>
                      <p className={`text-sm mt-1 ${afternoonRemaining <= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {afternoonRemaining <= 0 ? 'Full' : `${afternoonRemaining} slot${afternoonRemaining !== 1 ? 's' : ''} remaining`}
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <button onClick={handleBack} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <button
                  disabled={!selectedDate || !selectedSession || !isDateAllowed(selectedDate)}
                  onClick={handleAdvanceToRequirements}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Upload Requirements */}
          {step === 2 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Upload Requirements</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                Please upload all required documents before submitting your appointment.
              </p>
              <div className="space-y-4">
                {requirements.map((req) => (
                  <div key={req.id} className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-1">{req.label}</label>
                    {req.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{req.notes}</p>}
                    <input
                      type="file"
                      onChange={(e) => {
                        // In a real implementation, upload the file and get a UUID filename back.
                        // For now, use the file name as a placeholder.
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(req.id, file.name);
                      }}
                      className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/20 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100"
                    />
                    {uploadedFiles[req.id] && (
                      <p className="mt-1 text-xs text-green-600 dark:text-green-400">Uploaded: {uploadedFiles[req.id]}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-6 mt-6 border-t border-neutral-200 dark:border-neutral-700">
                <button onClick={handleBack} className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                  &larr; Back
                </button>
                <button
                  disabled={requirements.some((r) => !uploadedFiles[r.id])}
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Review & Submit */}
          {step === 3 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">Review &amp; Submit</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Appointment Type</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{selectedScheduler?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Location</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{selectedScheduler?.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Date</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{selectedDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Session</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {selectedSession === SESSION.MORNING ? 'Morning (8:00 AM — 12:00 PM)' : 'Afternoon (1:00 PM — 5:00 PM)'}
                  </span>
                </div>
                {requirements.length > 0 && (
                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Documents</p>
                    <ul className="space-y-1">
                      {requirements.map((r) => (
                        <li key={r.id} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center space-x-2">
                          <span className="text-green-500">✓</span>
                          <span>{r.label}: {uploadedFiles[r.id]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <button onClick={handleBack} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submitting && <Spinner />}
                  <span>{submitting ? 'Submitting...' : 'Submit Appointment'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Info Card ───────────────────────────────────────────────────────── */}
      <div className="mt-8 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4" style={{ margin: 0 }}>Important Information</h3>
        <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
          <li className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Appointments are subject to availability and confirmation</span>
          </li>
          <li className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>You will receive a confirmation once your appointment is approved</span>
          </li>
          <li className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Please arrive 10 minutes before your scheduled time</span>
          </li>
          <li className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Bring your student ID and any relevant medical documents</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PatientAppointment;
