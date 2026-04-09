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
  if (!dateStr) return null;
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

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">{label}</p>
      <p className="text-sm font-medium text-secondary-800 dark:text-white">{value || 'N/A'}</p>
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
        const dobFormatted = fmt(r.date_of_birth);

        let age = null;
        if (r.date_of_birth) {
          const dob = new Date(r.date_of_birth);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear() -
            (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
        }

        return (
          <SnapshotBlock key={r.id ?? i} index={i} isCurrent={i === 0} snapshotDate={snapshotDate}>
            <div className="space-y-3">
              <PatientSectionCard title="Basic Information">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <Field label="First Name"     value={r.first_name} />
                  <Field label="Middle Name"    value={r.middle_name} />
                  <Field label="Last Name"      value={r.last_name} />
                  <Field label="Suffix"         value={r.suffix} />
                  <Field label="Birth Date"     value={dobFormatted} />
                  <Field label="Age"            value={age != null ? `${age} years old` : ''} />
                  <Field label="Sex"            value={r.sex} />
                  <Field label="Civil Status"   value={r.civil_status} />
                  <Field label="Nationality"    value={r.nationality} />
                  <Field label="Religion"       value={r.religion} />
                  <Field label="Contact Number" value={r.contactNumber} />
                  <Field label="Email"          value={r.email || patient.email} />
                </div>
              </PatientSectionCard>

              <PatientSectionCard title="Address">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Present Address"  value={r.present_address} />
                  <Field label="Province Address" value={r.province_address} />
                </div>
              </PatientSectionCard>

              <PatientSectionCard title={patient.type === 'Employee' ? 'Employment Information' : 'Academic Information'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {patient.type === 'Employee' ? (
                    <>
                      <Field label="Employee Number"      value={patient.personal.employeeNumber || patient.id} />
                      <Field label="Department"           value={patient.department || patient.program} />
                      <Field label="Position"             value={patient.personal.position || patient.year} />
                      <Field label="Employment Category"  value={patient.personal.employmentCategory} />
                      <Field label="Employment Status"    value={patient.personal.employmentStatus} />
                      <Field label="Campus Branch"        value={getBranchLabel(r.branch) || getBranchLabel(patient.personal.branch)} />
                    </>
                  ) : (
                    <>
                      <Field label="Student Number" value={patient.personal.studentNumber || patient.id} />
                      <Field label="Program"        value={patient.program} />
                      <Field label="Year Level"     value={patient.year} />
                      {(r.branch || patient.personal.branch) && (
                        <Field label="Campus Branch" value={getBranchLabel(r.branch) || getBranchLabel(patient.personal.branch)} />
                      )}
                    </>
                  )}
                </div>
              </PatientSectionCard>

              <PatientSectionCard title="Emergency Contacts">
                <div className="grid md:grid-cols-2 gap-3">
                  {Object.entries(patient.emergencyContacts).map(([key, contact]) => (
                    <div key={key} className="p-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30">
                      <p className="text-sm font-semibold text-secondary-800 dark:text-white mb-2">{contact.name || 'N/A'}</p>
                      <div className="space-y-1 text-xs">
                        <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Relationship:</span> {contact.relationship || 'N/A'}</p>
                        <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Contact:</span> {contact.contact || 'N/A'}</p>
                        <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Address:</span> {contact.address || 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </PatientSectionCard>
            </div>
          </SnapshotBlock>
        );
      })}
    </div>
  );
}
