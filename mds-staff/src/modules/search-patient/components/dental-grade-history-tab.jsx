import React, { useState, useEffect, useMemo } from 'react';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import { axiosRequest } from '../../../packages-core-adapter';
import { ENUM_TO_CODE } from './tooth-chart-constants';

const GQL_DENTAL_GRADE_HISTORY = `
  query GetDentalGradeHistory($userId: ID!) {
    getUserDentalRecord(userId: $userId, limit: 50) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
    }
  }
`;

/* ─── Read-only Oral Findings Display ─────────────────────────── */
function ReadOnlyOralFindings({ catalogs, oralFindings }) {
  if (!catalogs || catalogs.length === 0) {
    return (
      <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">
        No oral finding catalog available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-3 -mb-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-100 dark:bg-neutral-700/50">
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600">
              Finding
            </th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600 w-20">
              Yes
            </th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600 w-20">
              No
            </th>
          </tr>
        </thead>
        <tbody>
          {catalogs.map((catalog, idx) => {
            const finding = oralFindings.find((f) => String(f.oralFindingId) === String(catalog.id));
            const value = finding != null ? finding.status : null;
            return (
              <tr
                key={catalog.id}
                className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'}`}
              >
                <td className="px-3 py-2 text-xs text-secondary-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-700">
                  {catalog.name}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <div className="flex justify-center items-center">
                    <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${
                      value === true
                        ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400'
                        : 'border-neutral-300 dark:border-neutral-500 bg-transparent'
                    }`}>
                      {value === true && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <div className="flex justify-center items-center">
                    <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${
                      value === false
                        ? 'border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400'
                        : 'border-neutral-300 dark:border-neutral-500 bg-transparent'
                    }`}>
                      {value === false && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Single Grade Entry Card ─────────────────────────────────── */
function GradeEntry({ record, catalogs, index }) {
  const [expanded, setExpanded] = useState(index === 0);

  const toothStates = useMemo(() => {
    const states = {};
    (record.ToothPlacements || []).forEach((tp) => {
      states[tp.toothIndex] = ENUM_TO_CODE[tp.legend] ?? tp.legend;
    });
    return states;
  }, [record]);

  const oralFindings = record.oralFindings || [];

  const conditionCount = Object.values(toothStates).filter((s) => s !== '✓').length;
  const positiveCount = oralFindings.filter((f) => f.status === true).length;

  const dateLabel = record.created_at
    ? new Date(record.created_at).toLocaleDateString('en-PH', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : 'Unknown date';

  const timeLabel = record.created_at
    ? new Date(record.created_at).toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary-800 dark:text-white">
              {dateLabel}
              {timeLabel && (
                <span className="ml-1.5 text-xs font-normal text-secondary-400 dark:text-neutral-500">
                  {timeLabel}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {conditionCount > 0 ? (
                <span className="text-[11px] text-warning-600 dark:text-warning-400 font-medium">
                  {conditionCount} tooth condition{conditionCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-[11px] text-success-600 dark:text-success-400 font-medium">
                  No tooth conditions
                </span>
              )}
              {positiveCount > 0 && (
                <span className="text-[11px] text-error-600 dark:text-error-400">
                  · {positiveCount} positive oral finding{positiveCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="p-4 space-y-4 bg-white dark:bg-neutral-800">
          {/* Tooth Chart */}
          <div>
            <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Tooth Chart
            </h4>
            <ToothChart
              key={`${record.id}-chart`}
              initialStates={toothStates}
              isEditing={false}
            />
          </div>

          {/* Oral Findings */}
          <div>
            <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-3 mt-2">
              Oral Findings
            </h4>
            <ReadOnlyOralFindings catalogs={catalogs} oralFindings={oralFindings} />
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Notes
              </h4>
              <p className="text-sm text-secondary-700 dark:text-neutral-300">{record.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function PatientDentalGradeHistoryTab({ patient }) {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const catalogs = patient?.dental?.oralFindingCatalogs || [];

  useEffect(() => {
    if (!patient?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    axiosRequest
      .post('/emr/medical', {
        query: GQL_DENTAL_GRADE_HISTORY,
        variables: { userId: patient.id },
      })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data?.getUserDentalRecord || [];
        setRecords(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to load dental grade history.');
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
        <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading dental grade history…</span>
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

  if (!records || records.length === 0) {
    return (
      <PatientSectionCard title="Dental Grade History">
        <p className="text-sm text-secondary-400 dark:text-neutral-500">No dental grade records found.</p>
      </PatientSectionCard>
    );
  }

  return (
    <PatientSectionCard
      title="Dental Grade History"
      right={
        <span className="text-xs text-secondary-400 dark:text-neutral-500">
          {records.length} grade{records.length !== 1 ? 's' : ''} recorded
        </span>
      }
    >
      <div className="space-y-2">
        {records.map((record, index) => (
          <GradeEntry
            key={record.id}
            record={record}
            catalogs={catalogs}
            index={index}
          />
        ))}
      </div>
    </PatientSectionCard>
  );
}
