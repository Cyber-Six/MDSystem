import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppointmentQueue from './components/appointment-queue';
import AvailabilityManager from './components/availability-manager';
import AppointmentDetailModal from './components/appointment-detail-modal';
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
  const [activeSection, setActiveSection] = useState('queue');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss feedback messages
  useEffect(() => {
    if (error || successMsg) {
      const timer = setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, successMsg]);

  /* ── Handlers mapped to real service ─────────────────────────────────── */

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleCloseModal = () => {
    setSelectedAppointment(null);
  };

  const handleConfirm = async (id) => {
    try {
      await respondToAppointment(id, STATUS.SCHEDULED);
      setSuccessMsg('Appointment confirmed.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (id, reason, cancelStatus) => {
    try {
      const status = cancelStatus || STATUS.REJECTED;
      await respondToAppointment(id, status, reason);
      setSuccessMsg(status === STATUS.REJECTED ? 'Appointment rejected.' : 'Appointment cancelled.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkDone = async (id, notes) => {
    try {
      await recordAttendance(id, new Date().toISOString());
      setSuccessMsg('Attendance recorded.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkComplete = async (userId) => {
    try {
      await respondToAppointment(userId, STATUS.COMPLETED);
      setSuccessMsg('Appointment marked as completed.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkNoShow = async (userId) => {
    try {
      await respondToAppointment(userId, STATUS.NO_SHOW);
      setSuccessMsg('Appointment marked as no-show.');
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
  ];

  return (
    <div className="space-y-1">
      {/* Feedback banners */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-2 bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 text-xs rounded-lg">
          {successMsg}
        </div>
      )}

      {/* Page Header + Section Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Appointments</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Manage appointment queue and slot availability</p>
        </div>
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
        <AppointmentQueue onViewDetails={handleViewDetails} />
      )}

      {activeSection === 'availability' && (
        <AvailabilityManager />
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
          onMarkNoShow={handleMarkNoShow}
        />
      )}
    </div>
  );
};

export default StaffAppointment;
