import React from 'react';
import { formatPatientName, getPatientInitials, getProfileLabel } from '../../../../services/patient-search-service';
import { usePatientTabs } from '../../../../context/patient-tabs-context';

const STATUS_STYLES = {
  InProgress:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Pending:           'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Revision:          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  RevisionSubmitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Approved:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Expired:           'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
  Cancelled:         'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
};

const RECORD_SECTIONS = [
  {
    id: 'personal',
    label: 'Full Details',
    description: 'Personal info, emergency contacts, academic info',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  },
  {
    id: 'medical',
    label: 'Medical Records',
    description: 'Vital signs, history, allergies, medications, lifestyle',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    id: 'dental',
    label: 'Dental Records',
    description: 'Dental history, procedures, oral findings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  },
  {
    id: 'appointments',
    label: 'Appointment Records',
    description: 'Appointment history and upcoming schedules',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  },
  {
    id: 'history',
    label: 'Consultation History',
    description: 'Past consultations and visit logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20',
  },
];

const PatientDetailPanel = ({ patient, onClose }) => {
  const { openTab } = usePatientTabs();

  const handleOpenSection = (sectionId) => {
    openTab(patient, sectionId);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {getPatientInitials(patient)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-secondary-900 dark:text-white truncate">
                {formatPatientName(patient)}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {patient.identifier && (
                  <span className="text-xs font-mono text-secondary-500 dark:text-neutral-400">{patient.identifier}</span>
                )}
                {patient.profile_type && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    patient.profile_type === 'Student'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  }`}>{patient.profile_type}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick info */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary-500 dark:text-neutral-400">Branch</span>
          <span className="font-medium text-secondary-800 dark:text-white">{patient.branch || '—'}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary-500 dark:text-neutral-400">Info</span>
          <span className="font-medium text-secondary-800 dark:text-white">{getProfileLabel(patient)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary-500 dark:text-neutral-400">Sex</span>
          <span className="font-medium text-secondary-800 dark:text-white">{patient.sex || '—'}</span>
        </div>
        {patient.latest_status && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary-500 dark:text-neutral-400">Record Status</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[patient.latest_status] || STATUS_STYLES.Expired}`}>
              {patient.latest_status}
            </span>
          </div>
        )}
      </div>

      {/* Record sections */}
      <div className="p-3">
        <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2 px-1">
          View Records
        </p>
        <div className="space-y-1.5">
          {RECORD_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => handleOpenSection(section.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors group text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-800 dark:text-white">{section.label}</p>
                <p className="text-xs text-secondary-400 dark:text-neutral-500 truncate">{section.description}</p>
              </div>
              <svg className="w-4 h-4 text-secondary-300 dark:text-neutral-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PatientDetailPanel;
