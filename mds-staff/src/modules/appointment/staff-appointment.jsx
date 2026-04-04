import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppointmentQueue from './components/appointment-queue';
import AvailabilityManager from './components/availability-manager';
import AppointmentDetailModal from './components/appointment-detail-modal';
import PatientLookup from './components/patient-lookup';
import { useStaffNotifications } from '../notification/notification-context';
import {
  STATUS,
  SESSION,
  ALL_STATUSES,
  ALL_LOCATIONS,
  searchByStatus,
  respondToAppointment,
  recordAttendance,
  listAllSchedulers,
  createScheduler,
  updateScheduler,
  deleteScheduler,
  listAllRequirements,
  updateRequirement,
  deleteRequirement,
  setCustomDates,
  unsetCustomDates,
  addWhitelist,
  removeWhitelist,
  updateDateIdentity,
} from './staff-appointment-service';

/**
 * Staff Appointment Page (v2 — clean UI)
 *
 * Two sub-sections:
 *   1. Queue — incoming / pending / today's bookings (SRS §3.4.5)
 *   2. Availability — slot control, scheduler config (SRS §3.4.2)
 *
 * Uses the real backend service at /appointment/medical (GraphQL).
 *
 * Backend statuses: Pending, Scheduled, Rejected, Expired, Completed,
 *                   NoShow, CancelledByPatient, CancelledByMedical
 * Sessions: Morning, Afternoon
 * Locations: Arlegui, Casal, QuezonCity
 *
 * NOTE: Components still render mock data for the queue view while the
 * service integration is incrementally wired. The availability manager
 * and scheduler config panels (in the legacy component) are fully connected.
 */
const StaffAppointment = () => {
  const { subscribe } = useStaffNotifications();
  const [activeSection, setActiveSection] = useState('queue');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [socketToast, setSocketToast] = useState(null);
  const queueRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((toast) => {
    setSocketToast(toast);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSocketToast(null), 5000);
  }, []);

  // Auto-dismiss feedback messages
  useEffect(() => {
    if (error || successMsg) {
      const timer = setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, successMsg]);

  // Refresh the queue and show a toast when a patient submits a new appointment
  useEffect(() => {
    const unsub = subscribe('appointment:submitted', (data) => {
      queueRef.current?.refresh();
      showToast({
        type: 'info',
        title: 'New Appointment Request',
        message: `A patient submitted an appointment request${data?.date ? ` for ${data.date}` : ''}.`,
      });
    });
    return unsub;
  }, [subscribe, showToast]);

  /* ── Handlers mapped to real service ─────────────────────────────────── */

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleCloseModal = () => {
    setSelectedAppointment(null);
  };

  const handleConfirm = async (userId, slotId) => {
    try {
      await respondToAppointment(userId, STATUS.SCHEDULED, undefined, slotId);
      setSuccessMsg('Appointment confirmed.');
      handleCloseModal();
      queueRef.current?.removeAppointment(slotId, STATUS.SCHEDULED);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (userId, reason, cancelStatus, slotId) => {
    try {
      const status = cancelStatus || STATUS.REJECTED;
      await respondToAppointment(userId, status, reason, slotId);
      setSuccessMsg(status === STATUS.REJECTED ? 'Appointment rejected.' : 'Appointment cancelled.');
      handleCloseModal();
      queueRef.current?.removeAppointment(slotId, status);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkDone = async (id, notes) => {
    try {
      await recordAttendance(id, new Date().toISOString());
      setSuccessMsg('Attendance recorded.');
      handleCloseModal();
      queueRef.current?.removeAppointment(id, STATUS.IN_PROGRESS);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkComplete = async (userId, slotId) => {
    try {
      await respondToAppointment(userId, STATUS.COMPLETED, undefined, slotId);
      setSuccessMsg('Appointment marked as completed.');
      handleCloseModal();
      queueRef.current?.removeAppointment(slotId, STATUS.COMPLETED);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Section switcher tabs ───────────────────────────────────────────── */

  const sections = [
    {
      key: 'queue',
      label: 'Appointment Queue',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'availability',
      label: 'Availability Manager',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'lookup',
      label: 'Patient Lookup',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-1">
      {/* Feedback banners */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-sm rounded-lg">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-2 bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 text-sm rounded-lg">
          {successMsg}
        </div>
      )}

      {/* Socket live notification toast */}
      {socketToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border bg-white dark:bg-neutral-800 border-primary-200 dark:border-primary-700 max-w-sm animate-fade-in">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mt-0.5">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{socketToast.title}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">{socketToast.message}</p>
          </div>
          <button
            onClick={() => setSocketToast(null)}
            className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Page Header + Section Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-800 dark:text-white leading-none m-0">Appointments</h1>
          <p className="text-xs text-secondary-500 dark:text-neutral-400">Manage appointment queue and slot availability</p>
        </div>
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeSection === section.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
        </div>
      </div>

      {/* Content */}
      {activeSection === 'queue' && (
        <AppointmentQueue ref={queueRef} onViewDetails={handleViewDetails} />
      )}

      {activeSection === 'availability' && (
        <AvailabilityManager />
      )}

      {activeSection === 'lookup' && (
        <PatientLookup />
      )}

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={handleCloseModal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onMarkDone={handleMarkDone}
          onMarkComplete={handleMarkComplete}
          hideHistory
        />
      )}
    </div>
  );
};

export default StaffAppointment;
