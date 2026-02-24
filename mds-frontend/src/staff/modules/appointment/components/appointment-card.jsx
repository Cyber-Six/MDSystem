import React from 'react';

/**
 * Appointment Card Component
 * Compact single-line row: avatar + name/id | type | date | status
 *
 * Backend status values: Pending, Scheduled, Rejected, Expired,
 *   Completed, NoShow, CancelledByPatient, CancelledByMedical
 */

const TYPE_COLORS = {
  'Medical Clearance': 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
  'OJT': 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  'NSTP': 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  'Screening': 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  'Oral Exam': 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  'Dental': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

const STATUS_STYLES = {
  Pending: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Confirmed: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
  'Auto-Confirmed': 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Cancelled: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  Scheduled: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
  Rejected: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  Expired: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  NoShow: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  CancelledByPatient: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  CancelledByMedical: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
};

const AppointmentCard = ({ appointment, onViewDetails }) => {
  const { patientName, patientId, appointmentType, scheduledDate, status } = appointment;

  const initials = patientName
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer"
      onClick={() => onViewDetails?.(appointment)}
    >
      {/* Left — avatar + name & id */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-7 h-7 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-[10px] font-semibold text-secondary-600 dark:text-neutral-300 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-secondary-800 dark:text-white truncate leading-tight">{patientName}</p>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400 truncate leading-tight">{patientId}</p>
        </div>
      </div>

      {/* Right — type, date, status */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className={`hidden sm:inline px-1.5 py-0.5 text-[11px] font-medium rounded ${TYPE_COLORS[appointmentType] || 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300'}`}>
          {appointmentType}
        </span>
        <span className="text-[11px] text-secondary-500 dark:text-neutral-400 hidden md:inline">{scheduledDate}</span>
        <span className={`px-1.5 py-0.5 text-[11px] font-medium rounded ${STATUS_STYLES[status] || 'bg-neutral-100 text-neutral-600'}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

export default AppointmentCard;
