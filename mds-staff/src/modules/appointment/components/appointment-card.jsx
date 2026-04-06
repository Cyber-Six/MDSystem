import React from 'react';

/**
 * Appointment Card Component
 * Compact single-line row displaying a patientSlot record.
 *
 * Backend patientSlot shape:
 *   { id, patientId, slotEntityId, status, session, approvedBy, notes, arrived_at, created_at }
 */

const STATUS_STYLES = {
  Pending:            'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Scheduled:          'bg-accent-100  dark:bg-accent-900/30  text-accent-700  dark:text-accent-400',
  InProgress:         'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Completed:          'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Rejected:           'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  Expired:            'bg-neutral-100 dark:bg-neutral-700     text-neutral-500 dark:text-neutral-400',
  NoShow:             'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  CancelledByPatient: 'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
  CancelledByMedical: 'bg-error-100   dark:bg-error-900/30   text-error-700   dark:text-error-400',
};

const SESSION_STYLES = {
  Morning:   'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
  Afternoon: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
};

const AppointmentCard = ({ appointment, onViewDetails }) => {
  const { id, patientId, session, status, created_at } = appointment;

  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer"
      onClick={() => onViewDetails?.(appointment)}
    >
      {/* Left — patient id + slot id */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-7 h-7 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-xs font-semibold text-secondary-600 dark:text-neutral-300 flex-shrink-0">
          {patientId?.toString().slice(-2) || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-secondary-800 dark:text-white truncate leading-tight">Patient {patientId}</p>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate leading-tight">Slot #{id}</p>
        </div>
      </div>

      {/* Right — session, date, status */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {session && (
          <span className={`hidden sm:inline px-1.5 py-0.5 text-xs font-medium rounded ${SESSION_STYLES[session] || 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300'}`}>
            {session}
          </span>
        )}
        {created_at && (
          <span className="text-xs text-secondary-500 dark:text-neutral-400 hidden md:inline">
            {new Date(created_at).toLocaleDateString()}
          </span>
        )}
        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${STATUS_STYLES[status] || 'bg-neutral-100 text-neutral-600'}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

export default AppointmentCard;
