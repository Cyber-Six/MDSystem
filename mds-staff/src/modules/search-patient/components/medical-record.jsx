import React from 'react';

const STATUS_STYLES = {
  InProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Revision: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  RevisionSubmitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Expired: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
  Cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
};

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.Expired}`}>
      {status}
    </span>
  );
}

function ScopeBadge({ scope }) {
  if (!scope) return null;
  const colors = {
    Medical: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
    Dental: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    Both: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  };
  const labels = {
    Medical: 'Medical',
    Dental: 'Dental',
    Both: 'Both (Medical & Dental)',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[scope] || ''}`}>
      {labels[scope] ?? scope}
    </span>
  );
}

function dateLabel(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_) {
    return null;
  }
}

export default function MedicalRecord({ patient }) {
  if (!patient) return null;

  return (
    <>
      <div className="text-xs text-secondary-500 dark:text-neutral-400 text-right whitespace-nowrap">
        {patient.branch || '—'}
      </div>

      <div className="text-right">
        <ScopeBadge scope={patient.latest_scope} />
      </div>

      <div className="text-right">
        {patient.latest_status ? (
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={patient.latest_status} />
            {patient.latest_updated_at && (
              <span className="text-xs text-secondary-400 dark:text-neutral-500">{dateLabel(patient.latest_updated_at)}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-secondary-400 dark:text-neutral-500">No record</span>
        )}
      </div>
    </>
  );
}
