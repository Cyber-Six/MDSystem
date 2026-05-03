import React, { useState, useEffect } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';
import { formatBranchLabel } from '../../../utils/branch-utils';

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

const GQL_USER_PROFILE = `
  query GetUserProfileTimeline($userId: ID!) {
    getUserProfile(userId: $userId, limit: 50) {
      __typename
      ... on StudentProfile {
        id
        program
        year
        status
        created_at
      }
      ... on EmployeeProfile {
        id
        department
        role
        position
        status
        created_at
      }
    }
  }
`;

const GQL_USER_EMERGENCY_CONTACT = `
  query GetUserEmergencyContactTimeline($userId: ID!) {
    getUserEmergencyContact(userId: $userId, limit: 50) {
      id
      firstContact {
        id
        contactName
        relationship
        contactNumber
        address
      }
      secondContact {
        id
        contactName
        relationship
        contactNumber
        address
      }
      created_at
    }
  }
`;

const GQL_USER_UPDATE_TICKETS = `
  query GetUserUpdateTicketsTimeline($userId: ID!) {
    getUserUpdateTickets(
      userId: $userId
      statuses: [InProgress, Pending, RevisionSubmitted, Revision, Approved, Rejected, Expired, Cancelled]
      limit: 50
    ) {
      id
      status
      scope
      created_at
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

function SnapshotBlock({ index, isCurrent, snapshotDate, sourceLabel, sourceDetail, children }) {
  const [open, setOpen] = useState(isCurrent);
  const { date, time } = fmtDateTime(snapshotDate);

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isCurrent && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 uppercase">
              Current
            </span>
          )}
          {sourceLabel && (
            <span className={`text-[10px] font-semibold px-2 py-1 rounded uppercase ${
              sourceLabel === 'Basic Info'
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
              {sourceLabel}
              {sourceDetail ? ` · ${sourceDetail}` : ''}
            </span>
          )}
          <span className="text-sm font-semibold text-secondary-700 dark:text-neutral-200">{date}</span>
          {time && <span className="text-xs text-secondary-500 dark:text-neutral-400">{time}</span>}
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-6 space-y-6 bg-neutral-50/50 dark:bg-neutral-900/20">
          {children}
        </div>
      )}
    </div>
  );
}

export default function PatientPersonalRecordHistoryTab({ patient, visibleSections }) {
  const [historyData, setHistoryData] = useState(null);
  const [profileTimeline, setProfileTimeline] = useState([]);
  const [emergencyTimeline, setEmergencyTimeline] = useState([]);
  const [ticketTimeline, setTicketTimeline] = useState([]);
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

    Promise.allSettled([
      axiosRequest.post('/profile/medical', {
        query: GQL_PERSONAL_RECORD_LOG,
        variables: { userId: patient.id },
      }),
      axiosRequest.post('/emr/medical', {
        query: GQL_USER_PROFILE,
        variables: { userId: patient.id },
      }),
      axiosRequest.post('/emr/medical', {
        query: GQL_USER_EMERGENCY_CONTACT,
        variables: { userId: patient.id },
      }),
      axiosRequest.post('/emr/medical', {
        query: GQL_USER_UPDATE_TICKETS,
        variables: { userId: patient.id },
      }),
    ])
      .then(([logResult, profileResult, emergencyResult, ticketResult]) => {
        if (cancelled) return;

        const logPayload = logResult.status === 'fulfilled'
          ? logResult.value.data?.data
          : logResult.reason?.response?.data?.data;
        const profilePayload = profileResult.status === 'fulfilled'
          ? profileResult.value.data?.data
          : profileResult.reason?.response?.data?.data;
        const emergencyPayload = emergencyResult.status === 'fulfilled'
          ? emergencyResult.value.data?.data
          : emergencyResult.reason?.response?.data?.data;
        const ticketPayload = ticketResult.status === 'fulfilled'
          ? ticketResult.value.data?.data
          : ticketResult.reason?.response?.data?.data;

        setHistoryData(logPayload || {});
        setProfileTimeline(profilePayload?.getUserProfile || []);
        setEmergencyTimeline(emergencyPayload?.getUserEmergencyContact || []);
        setTicketTimeline(ticketPayload?.getUserUpdateTickets || []);

        const logError = logResult.status === 'rejected'
          ? logResult.reason?.response?.data?.errors?.[0]?.message || logResult.reason?.message
          : null;
        const profileError = profileResult.status === 'rejected'
          ? profileResult.reason?.response?.data?.errors?.[0]?.message || profileResult.reason?.message
          : null;
        const emergencyError = emergencyResult.status === 'rejected'
          ? emergencyResult.reason?.response?.data?.errors?.[0]?.message || emergencyResult.reason?.message
          : null;
        const ticketError = ticketResult.status === 'rejected'
          ? ticketResult.reason?.response?.data?.errors?.[0]?.message || ticketResult.reason?.message
          : null;

        if (!logPayload && !profilePayload && !emergencyPayload && !ticketPayload) {
          setError(logError || profileError || emergencyError || ticketError || 'Failed to load personal record history.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load personal record history.');
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
  const sortDesc = (items) => (items || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      const left = new Date(a.created_at || a.updated_at || 0).getTime();
      const right = new Date(b.created_at || b.updated_at || 0).getTime();
      return right - left;
    });

  const logSnapshots = sortDesc(records);
  const profileSnapshots = sortDesc(profileTimeline);
  const emergencySnapshots = sortDesc(emergencyTimeline);
  const updateTickets = sortDesc(ticketTimeline);

  const parseTime = (dateStr) => {
    if (!dateStr) return 0;
    const time = new Date(dateStr).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const pickSnapshotAt = (items, anchorTime) => {
    if (!items?.length) return null;
    const exactOrEarlier = items.find((item) => parseTime(item.created_at || item.updated_at) <= anchorTime);
    return exactOrEarlier || items[items.length - 1] || null;
  };

  const anchorTimeline = Array.from(
    new Map([
      ...logSnapshots.map((item) => [`log:${item.id}:${item.created_at || item.updated_at}`, { type: 'log', at: item.created_at || item.updated_at }]),
      ...updateTickets.map((item) => [`ticket:${item.id}:${item.created_at}`, { type: 'ticket', at: item.created_at }]),
    ]).values()
  ).sort((a, b) => parseTime(b.at) - parseTime(a.at));

  const timelineRecords = anchorTimeline.length > 0 ? anchorTimeline : logSnapshots.map((item) => ({ type: 'log', at: item.created_at || item.updated_at }));

  if (timelineRecords.length === 0) {
    return (
      <PatientSectionCard title="Personal Record History">
        <p className="text-sm text-secondary-400 dark:text-neutral-500">No personal record history found.</p>
      </PatientSectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* History Records */}
      <div className="space-y-3">
      {timelineRecords.map((entry, i) => {
        const snapshotDate = entry.at || null;
        const anchorTime = parseTime(snapshotDate);
        const logSnapshot = pickSnapshotAt(logSnapshots, anchorTime);
        const profileSnapshot = pickSnapshotAt(profileSnapshots, anchorTime);
        const emergencySnapshot = pickSnapshotAt(emergencySnapshots, anchorTime);
        const ticketSnapshot = pickSnapshotAt(updateTickets, anchorTime);
        const sourceLabel = entry.type === 'ticket' ? 'EMR Update' : 'Basic Info';
        const sourceDetail = entry.type === 'ticket'
          ? (ticketSnapshot?.scope || ticketSnapshot?.status || null)
          : null;
        const emergencyContacts = emergencySnapshot
          ? {
              first: {
                name: emergencySnapshot.firstContact?.contactName,
                relationship: emergencySnapshot.firstContact?.relationship,
                contact: emergencySnapshot.firstContact?.contactNumber,
                address: emergencySnapshot.firstContact?.address,
              },
              second: {
                name: emergencySnapshot.secondContact?.contactName,
                relationship: emergencySnapshot.secondContact?.relationship,
                contact: emergencySnapshot.secondContact?.contactNumber,
                address: emergencySnapshot.secondContact?.address,
              },
            }
          : patient.emergencyContacts;
        const isEmployee = profileSnapshot?.__typename === 'EmployeeProfile' || patient.type === 'Employee';
        const basicInfo = logSnapshot || {};
        const dobFormatted = fmt(basicInfo.date_of_birth);
        const employmentOrAcademicGrid = isEmployee
          ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'
          : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3';

        let age = null;
        if (basicInfo.date_of_birth) {
          const dob = new Date(basicInfo.date_of_birth);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear() -
            (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
        }

        return (
          <SnapshotBlock
            key={`${entry.type}-${snapshotDate || i}`}
            index={i}
            isCurrent={i === 0}
            snapshotDate={snapshotDate}
            sourceLabel={sourceLabel}
            sourceDetail={sourceDetail}
          >
            <div className="space-y-6">
              {/* BASIC INFORMATION */}
              {visibleSections.basicInfo && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-neutral-300 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    BASIC INFORMATION
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Field label="First Name"     value={basicInfo.first_name} />
                    <Field label="Middle Name"    value={basicInfo.middle_name} />
                    <Field label="Last Name"      value={basicInfo.last_name} />
                    <Field label="Suffix"         value={basicInfo.suffix} />
                    <Field label="Birth Date"     value={dobFormatted} />
                    <Field label="Age"            value={age != null ? `${age} years old` : ''} />
                    <Field label="Sex"            value={basicInfo.sex} />
                    <Field label="Civil Status"   value={basicInfo.civil_status} />
                    <Field label="Nationality"    value={basicInfo.nationality} />
                    <Field label="Religion"       value={basicInfo.religion} />
                    <Field label="Contact Number" value={basicInfo.contactNumber} />
                    <Field label="Email"          value={basicInfo.email || patient.email} />
                  </div>
                </div>
              )}

              {/* ADDRESS - shown with Basic Info */}
              {visibleSections.basicInfo && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-neutral-300 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    ADDRESS
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Present Address"  value={basicInfo.present_address} />
                    <Field label="Province Address" value={basicInfo.province_address} />
                  </div>
                </div>
              )}

              {/* EMPLOYMENT / ACADEMIC INFORMATION */}
              {visibleSections.employment && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-neutral-300 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    {isEmployee ? 'EMPLOYMENT INFORMATION' : 'ACADEMIC INFORMATION'}
                  </h3>
                  <div className={employmentOrAcademicGrid}>
                    {isEmployee ? (
                      <>
                        <Field label="Employee Number" value={patient.personal.employeeNumber || patient.id} />
                        <Field label="Role" value={profileSnapshot?.role || patient.year || patient.personal.position} />
                        <Field label="Department" value={profileSnapshot?.department || patient.department || patient.program} />
                        <Field label="Position" value={profileSnapshot?.position || patient.personal.position || patient.year} />
                      </>
                    ) : (
                      <>
                        <Field label="Student Number" value={patient.personal.studentNumber || patient.id} />
                        <Field label="Program" value={profileSnapshot?.program || patient.program} />
                        <Field label="Year Level" value={profileSnapshot?.year || patient.year} />
                      </>
                    )}
                    {basicInfo.branch || patient.personal.branch ? (
                      <Field label="Campus Branch" value={formatBranchLabel(basicInfo.branch || patient.personal.branch) || formatBranchLabel(patient.personal.branch)} />
                    ) : null}
                  </div>
                </div>
              )}

              {/* EMERGENCY CONTACTS */}
              {visibleSections.emergency && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary-700 dark:text-neutral-300 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    EMERGENCY CONTACTS
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(emergencyContacts || {}).map(([key, contact]) => (
                      <div key={key} className="">
                        <p className="text-xs font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400 mb-3">
                          Contact {key === 'first' ? '1' : '2'} - {contact?.name || 'N/A'}
                        </p>
                        <div className="space-y-3 pl-0">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">Relationship</p>
                            <p className="text-sm font-medium text-secondary-800 dark:text-white">{contact?.relationship || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">Contact Number</p>
                            <p className="text-sm font-medium text-secondary-800 dark:text-white">{contact?.contact || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">Address</p>
                            <p className="text-sm font-medium text-secondary-800 dark:text-white">{contact?.address || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SnapshotBlock>
        );
      })}
      </div>
    </div>
  );
}
