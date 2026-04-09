import React, { useState, useEffect } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';

const GQL_PERSONAL_RECORD_LOG = `
  query GetPersonalRecordLog($userId: ID!) {
    getUserPersonalRecordLog(userId: $userId, limit: 50) {
      id
      first_name middle_name last_name suffix
      date_of_birth sex civil_status nationality religion
      contactNumber present_address province_address email
      branch status
      created_at updated_at
    }
  }
`;

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return { date: 'Unknown date', time: '' };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
  };
}

function DataRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700/60 last:border-0">
      <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[140px] shrink-0 pt-px">{label}</span>
      <span className="text-sm font-medium text-secondary-800 dark:text-white leading-snug">
        {value != null && value !== '' ? value : <span className="text-secondary-300 dark:text-neutral-600 font-normal">—</span>}
      </span>
    </div>
  );
}

function getBranchLabel(branch) {
  if (!branch) return null;
  const normalized = branch.toString().toLowerCase();
  if (normalized === 'manila') return 'Manila';
  if (normalized === 'quezon city' || normalized === 'qc') return 'Quezon City';
  return branch;
}

function SnapshotBlock({ index, isCurrent, snapshotDate, children }) {
  const [open, setOpen] = useState(isCurrent);
  const { date, time } = fmtDateTime(snapshotDate);

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isCurrent && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 uppercase">
              Current
            </span>
          )}
          <span className="text-sm font-semibold text-secondary-800 dark:text-white">{date}</span>
          {time && <span className="text-xs text-secondary-400 dark:text-neutral-500">{time}</span>}
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function PatientPersonalRecordHistoryTab({ patient }) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patient?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    axiosRequest.post('/profile/medical', {
      query: GQL_PERSONAL_RECORD_LOG,
      variables: { userId: patient.id },
    })
      .then((res) => {
        if (cancelled) return;
        setHistoryData(res.data?.data || {});
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.errors?.[0]?.message ||
            err?.message ||
            'Failed to load personal record history.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patient?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin w-6 h-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading personal record history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
        {error}
      </div>
    );
  }

  const records = historyData?.getUserPersonalRecordLog ?? [];

  if (records.length === 0) {
    return (
      <PatientSectionCard title="Personal Record Info History">
        <p className="text-sm text-secondary-400 dark:text-neutral-500">No personal record history found.</p>
      </PatientSectionCard>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((r, i) => {
        const snapshotDate = r.created_at || r.updated_at || null;
        const dobFormatted = r.date_of_birth ? fmt(r.date_of_birth) : null;

        // Compute age from date_of_birth
        let age = null;
        if (r.date_of_birth) {
          const dob = new Date(r.date_of_birth);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear() -
            (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
        }

        return (
          <SnapshotBlock key={r.id ?? i} index={i} isCurrent={i === 0} snapshotDate={snapshotDate}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {/* LEFT COLUMN */}
              <div className="space-y-3">
                <PatientSectionCard title="Basic Information">
                  <DataRow label="First Name"    value={r.first_name} />
                  <DataRow label="Middle Name"   value={r.middle_name} />
                  <DataRow label="Last Name"     value={r.last_name} />
                  <DataRow label="Suffix"        value={r.suffix} />
                  <DataRow label="Birth Date"    value={dobFormatted} />
                  <DataRow label="Age"           value={age != null ? `${age} years old` : null} />
                  <DataRow label="Sex"           value={r.sex} />
                  <DataRow label="Civil Status"  value={r.civil_status} />
                  <DataRow label="Nationality"   value={r.nationality} />
                  <DataRow label="Religion"      value={r.religion} />
                </PatientSectionCard>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3">
                <PatientSectionCard title="Contact & Address">
                  <DataRow label="Contact Number"    value={r.contactNumber} />
                  <DataRow label="Email"             value={r.email} />
                  <DataRow label="Present Address"   value={r.present_address} />
                  <DataRow label="Province Address"  value={r.province_address} />
                  <DataRow label="Branch"            value={getBranchLabel(r.branch)} />
                </PatientSectionCard>
              </div>
            </div>
          </SnapshotBlock>
        );
      })}
    </div>
  );
}
