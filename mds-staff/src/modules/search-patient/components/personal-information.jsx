import React from 'react';

/* ─── helpers ──────────────────────────────────────────────── */

function fullName(patient) {
  if (!patient) return 'Unknown';
  if (patient.last_name) {
    const mid = patient.middle_name ? ` ${patient.middle_name[0]}.` : '';
    const suf = patient.suffix ? ` ${patient.suffix}` : '';
    return `${patient.last_name}, ${patient.first_name || ''}${mid}${suf}`.trim();
  }
  return patient.first_name || 'Unknown';
}

function initials(patient) {
  const f = patient?.first_name?.[0] || '';
  const l = patient?.last_name?.[0]  || '';
  return (f + l).toUpperCase() || '?';
}

function profileLabel(patient) {
  if (patient?.profile_type === 'Student') {
    return [patient.program, patient.year].filter(Boolean).join(' · ') || 'Student';
  }
  if (patient?.profile_type === 'Employee') {
    return [patient.department, patient.role].filter(Boolean).join(' · ') || 'Employee';
  }
  return patient?.profile_type || '—';
}

const PROFILE_TYPE_STYLES = {
  Student:  'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300',
  Employee: 'bg-secondary-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300',
};

/* ─── component ────────────────────────────────────────────── */

/**
 * PersonalInformation
 *
 * Renders the patient avatar + name block.
 * Drop inside a flex row — it yields two children:
 *   1. Avatar circle (fixed 36×36)
 *   2. Name + meta block (min-w-0, truncates)
 *
 * Usage:
 *   <div className="flex items-center gap-2.5">
 *     <PersonalInformation patient={patient} />
 *   </div>
 */
export default function PersonalInformation({ patient }) {
  if (!patient) return null;

  const profileStyle = PROFILE_TYPE_STYLES[patient.profile_type] || PROFILE_TYPE_STYLES.Employee;
  const label = profileLabel(patient);

  return (
    <>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
        {initials(patient)}
      </div>

      {/* Name + meta */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary-900 dark:text-white truncate leading-none">
          {fullName(patient)}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {patient.identifier && (
            <span className="text-[11px] font-mono text-secondary-400 dark:text-neutral-500 leading-none">
              {patient.identifier}
            </span>
          )}
          {patient.profile_type && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium leading-none ${profileStyle}`}>
              {patient.profile_type}
            </span>
          )}
          {label !== patient.profile_type && (
            <span className="text-[11px] text-secondary-400 dark:text-neutral-500 truncate leading-none">
              {label}
            </span>
          )}
        </div>
      </div>
    </>
  );
}