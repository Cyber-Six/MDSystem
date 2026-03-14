import React from 'react';
import PatientSectionCard from './patient-section-card';

const APPT_STATUS_STYLES = {
  Pending:   'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-600',
  Confirmed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Cancelled: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  Completed: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  NoShow:    'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
};

const APPT_TYPE_STYLES = {
  Medical: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50',
  Dental:  'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800/50',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${APPT_STATUS_STYLES[status] || APPT_STATUS_STYLES.Pending}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${APPT_TYPE_STYLES[type] || APPT_TYPE_STYLES.Medical}`}>
      {type}
    </span>
  );
}

function AppointmentRow({ appt, upcoming = false }) {
  return (
    <div className={`px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors ${upcoming ? 'border-l-2 border-primary-400 dark:border-primary-600' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={appt.type} />
          {appt.id && <span className="text-[11px] font-mono text-secondary-400 dark:text-neutral-500">{appt.id}</span>}
        </div>
        <StatusBadge status={appt.status} />
      </div>

      <p className="text-sm font-semibold text-secondary-800 dark:text-white mt-2 leading-snug">
        {appt.purpose || appt.type}
      </p>
      <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">
        {appt.doctor}
        {appt.date && <span> · {appt.date}</span>}
        {appt.time && <span> · {appt.time}</span>}
      </p>

      {appt.notes && (
        <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
          <span className="text-secondary-400 dark:text-neutral-500">Notes: </span>{appt.notes}
        </p>
      )}
    </div>
  );
}

export default function PatientAppointmentsTab({ patient }) {
  const upcoming = patient.history.appointments     || [];
  const past     = patient.history.pastAppointments || [];

  return (
    <div className="space-y-3">

      <PatientSectionCard
        title="Upcoming Appointments"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{upcoming.length} pending</span>}
      >
        {upcoming.length === 0 ? (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No upcoming appointments.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
            {upcoming.map((appt, idx) => (
              <AppointmentRow key={idx} appt={appt} upcoming />
            ))}
          </div>
        )}
      </PatientSectionCard>

      <PatientSectionCard
        title="Past Appointments"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{past.length} completed</span>}
      >
        {past.length === 0 ? (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No past appointments yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
            {past.map((appt, idx) => (
              <AppointmentRow key={idx} appt={appt} />
            ))}
          </div>
        )}
      </PatientSectionCard>

    </div>
  );
}