import React from 'react';
import { formatPatientName, getPatientInitials, getProfileLabel, getPatientYearLevelLabel } from '../../../services/patient-search-service';
import PatientInitialBadge from './patient-initial-badge';

// ── Badge helpers ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  InProgress:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Pending:           'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Revision:          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  RevisionSubmitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Approved:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Expired:           'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
  Cancelled:         'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
};

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.Expired}`}>
      {status}
    </span>
  );
}

const SCOPE_COLORS = {
  Medical: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
  Dental:  'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  Both:    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
};
const SCOPE_LABELS = { Medical: 'Medical', Dental: 'Dental', Both: 'Both (Medical & Dental)' };

function ScopeBadge({ scope }) {
  if (!scope) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SCOPE_COLORS[scope] || ''}`}>
      {SCOPE_LABELS[scope] ?? scope}
    </span>
  );
}

const dateLabel = (iso) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return null; }
};

// ── Component ────────────────────────────────────────────────────────────────────
const SearchResultsList = ({ patients, hasFired, isLoading, error, searchTerm, focusedIdx, selectedPatientId, onSelectPatient, listRef }) => {
  if (error) {
    return (
      <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 text-sm text-error-700 dark:text-error-400">
        {error}
      </div>
    );
  }

  if (!hasFired || isLoading) return null;

  if (patients.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-10 text-center">
        <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400">No patients found for "{searchTerm}"</p>
        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Try a different name, ID number, or email</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
        <span className="w-9"/>
        <span>Patient</span>
        <span className="text-right">Branch</span>
        <span className="text-right">Record Status</span>
      </div>

      <ul ref={listRef} className="divide-y divide-neutral-100 dark:divide-neutral-700">
        {patients.map((p, idx) => {
          const isSelected = selectedPatientId === p.id;
          const isFocused = focusedIdx === idx;
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelectPatient(p)}
                className={`w-full grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center px-4 py-3 text-left transition-colors
                  ${isSelected
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-l-2 border-primary-500'
                    : isFocused
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}`}
              >
                {/* Avatar */}
                <PatientInitialBadge initials={getPatientInitials(p)} appearance="solidYellow" />

                {/* Name + meta */}
                <div className="min-w-0 flex flex-col" style={{ gap: '2px' }}>
                  <p style={{ lineHeight: 1.2, margin: 0 }} className="text-sm font-semibold text-secondary-900 dark:text-white truncate">{formatPatientName(p)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.identifier && (
                      <span className="text-xs font-mono text-secondary-500 dark:text-neutral-400">{p.identifier}</span>
                    )}
                    {p.profile_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.profile_type === 'Student'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : p.profile_type === 'Superior'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      }`}>{getPatientYearLevelLabel(p) || p.profile_type}</span>
                    )}
                    {p.access_denied && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                        Restricted details
                      </span>
                    )}
                    <span className="text-xs text-secondary-400 dark:text-neutral-500 truncate">{getProfileLabel(p)}</span>
                  </div>
                </div>

                {/* Branch */}
                <div className="text-xs text-secondary-500 dark:text-neutral-400 text-right whitespace-nowrap">
                  {p.branch || '—'}
                </div>

                {/* Status */}
                <div className="text-right">
                  {p.latest_status ? (
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={p.latest_status} />
                      {p.latest_updated_at && (
                        <span className="text-xs text-secondary-400 dark:text-neutral-500">{dateLabel(p.latest_updated_at)}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-secondary-400 dark:text-neutral-500">No record</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SearchResultsList;
