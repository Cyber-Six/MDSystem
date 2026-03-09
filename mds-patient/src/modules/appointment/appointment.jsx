import React, { useState, useEffect, useCallback } from 'react';
import {
  getAppointmentStatus,
  listOpenAppointments,
  listRequirements,
  listCustomDates,
  getScheduleAvailability,
  submitAppointment,
  cancelAppointment,
  ACTIVE_STATUSES,
} from './patient-appointment-service';

import { Spinner } from './components/shared';
import AppointmentStepper from './components/AppointmentStepper';
import ActiveAppointmentCard from './components/ActiveAppointmentCard';
import SchedulerPicker from './components/SchedulerPicker';
import DateSessionPicker from './components/DateSessionPicker';
import RequirementsUpload from './components/RequirementsUpload';
import ReviewSubmit from './components/ReviewSubmit';
import InfoCard from './components/InfoCard';

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
  const [uploadedFiles, setUploadedFiles] = useState({});

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Date helpers (local date — avoids UTC off-by-one in non-UTC timezones) ─

  const localDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = localDateStr();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDateStr(d);
  })();

  // ── Initial load ──────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getAppointmentStatus();
      setCurrentStatus(status);

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

  const handleAdvanceToRequirements = async () => {
    try {
      const reqs = await listRequirements(selectedScheduler.id);
      setRequirements(reqs);
      setUploadedFiles({});
      setStep(reqs.length === 0 ? 3 : 2);
    } catch (err) {
      setError(err.message);
    }
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
        <ActiveAppointmentCard currentStatus={currentStatus} onCancel={handleCancel} cancelling={cancelling} />
      ) : (
        <>
          {/* ── Booking Wizard ─────────────────────────────────────────────── */}
          <AppointmentStepper step={step} />

          {step === 0 && <SchedulerPicker schedulers={schedulers} onSelect={handleSelectScheduler} />}

          {step === 1 && selectedScheduler && (
            <DateSessionPicker
              scheduler={selectedScheduler}
              selectedDate={selectedDate}
              selectedSession={selectedSession}
              customDates={customDates}
              availability={availability}
              loadingAvailability={loadingAvailability}
              today={today}
              maxDate={maxDate}
              onDateChange={handleDateChange}
              onSessionSelect={setSelectedSession}
              onNext={handleAdvanceToRequirements}
              onBack={handleBack}
            />
          )}

          {step === 2 && (
            <RequirementsUpload
              requirements={requirements}
              uploadedFiles={uploadedFiles}
              onFileUpload={(reqId, filename) => setUploadedFiles((prev) => ({ ...prev, [reqId]: filename }))}
              onNext={() => setStep(3)}
              onBack={handleBack}
            />
          )}

          {step === 3 && (
            <ReviewSubmit
              scheduler={selectedScheduler}
              selectedDate={selectedDate}
              selectedSession={selectedSession}
              requirements={requirements}
              uploadedFiles={uploadedFiles}
              submitting={submitting}
              onSubmit={handleSubmit}
              onBack={handleBack}
            />
          )}
        </>
      )}

      <InfoCard />
    </div>
  );
};

export default PatientAppointment;
