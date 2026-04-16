import React, { useState, useEffect, useMemo } from 'react';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import PendingDentalSubmissions from './pending-dental-submissions';
import { axiosRequest } from '../../../packages-core-adapter';
import { CODE_TO_ENUM, TOOTH_LAYOUT } from './tooth-chart-constants';

/* ─── AuthenticatedImage ─────────────────────────────────────── */
function AuthenticatedImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    axiosRequest
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(res.data);
          setSrc(objectUrl);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 animate-pulse">
        <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex items-center justify-center w-full h-24 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 border border-dashed border-neutral-300 dark:border-neutral-600">
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Photo unavailable</p>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setIsExpanded(true)} className="block w-full text-left" title="Click to enlarge">
        <img src={src} alt={alt} className={`${className} cursor-zoom-in`} />
      </button>
      {isExpanded && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setIsExpanded(false)}>
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setIsExpanded(false)} className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-medium">Close</button>
            <img src={src} alt={alt} className="w-full max-h-[85vh] object-contain rounded-lg border border-white/20 shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Oral Findings Table ──────────────────────────────────────── */
function OralFindingsTable({ catalogs, findings, onFindingChange, readOnly = false }) {
  if (!catalogs || catalogs.length === 0) {
    return <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">No oral finding catalog available.</p>;
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
            const value = findings[catalog.id];
            return (
              <tr
                key={catalog.id}
                className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'} hover:bg-primary-50/50 dark:hover:bg-neutral-700/30 transition-colors`}
              >
                <td className="px-3 py-2 text-xs text-secondary-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-700">
                  {catalog.name}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  {readOnly ? (
                    <div className="flex justify-center items-center">
                      <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === true || value === 'true' || value === 'yes' ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                        {(value === true || value === 'true' || value === 'yes') && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="radio"
                      name={`finding-${catalog.id}`}
                      checked={value === true || value === 'yes' || value === 'true'}
                      onChange={() => onFindingChange(catalog.id, true)}
                      className="w-4 h-4 text-green-600 border-neutral-300 dark:border-neutral-500 focus:ring-green-500 dark:bg-neutral-700 cursor-pointer"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  {readOnly ? (
                    <div className="flex justify-center items-center">
                      <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === false || value === 'false' || value === 'no' ? 'border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                        {(value === false || value === 'false' || value === 'no') && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="radio"
                      name={`finding-${catalog.id}`}
                      checked={value === false || value === 'no' || value === 'false'}
                      onChange={() => onFindingChange(catalog.id, false)}
                      className="w-4 h-4 text-red-600 border-neutral-300 dark:border-neutral-500 focus:ring-red-500 dark:bg-neutral-700 cursor-pointer"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */

const GQL_UPDATE_DENTAL_RECORD = `
  mutation UpdateDentalRecord($id: ID!, $input: DentalRecordInput!) {
    updateDentalRecord(id: $id, input: $input) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
    }
  }
`;

const GQL_CREATE_DENTAL_RECORD = `
  mutation CreateDentalRecord($patientId: ID!, $input: DentalRecordInput!) {
    createDentalRecord(patientId: $patientId, input: $input) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
    }
  }
`;

export default function PatientDentalRecordTab({ patient, canSetDentalRecord = true }) {
  const dental = useMemo(() => patient?.dental || {}, [patient?.dental]);

  // Memoize so the reference stays stable across re-renders triggered by onStateChange.
  // A new object reference every render would fire the useEffect in ToothChart and reset
  // the chart immediately after every tooth click.
  const initialToothStates = useMemo(() => {
    const states = {};
    const chart = dental.toothChart;
    if (chart?.missing) chart.missing.forEach(tooth => { states[tooth] = 'M'; });
    if (chart?.filled)  chart.filled.forEach(tooth  => { states[tooth] = 'F'; });
    if (chart?.decayed) chart.decayed.forEach(tooth => { states[tooth] = 'C'; });
    if (chart?.states)  Object.assign(states, chart.states);
    return states;
  }, [dental]);

  // Oral finding catalogs from backend
  const oralFindingCatalogs = dental.oralFindingCatalogs || [];

  // Build initial findings map from latest dental record { [catalogId]: boolean }
  const buildInitialFindings = () => {
    const map = {};
    oralFindingCatalogs.forEach(c => { map[c.id] = null; });
    (dental.latestOralFindings || []).forEach(f => {
      const s = f.status;
      map[f.oralFindingId] = (s === true || s === 'true' || s === 'yes') ? true
        : (s === false || s === 'false' || s === 'no') ? false
        : null;
    });
    return map;
  };

  // Grade mode state (controls both tooth chart and oral findings editing)
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gradeError, setGradeError] = useState(null);
  const [gradeSuccess, setGradeSuccess] = useState(false);

  // chartResetKey forces ToothChart to re-mount on cancel
  const [chartResetKey, setChartResetKey] = useState(0);
  // currentToothStates tracks live edits reported by ToothChart
  const [currentToothStates, setCurrentToothStates] = useState(initialToothStates);

  // Oral findings keyed by catalog id (boolean or null)
  const [oralFindings, setOralFindings] = useState(buildInitialFindings);

  const [pendingSubmissions, setPendingSubmissions] = useState(() =>
    dental.pendingSubmissions || []
  );

  const procedures = dental.procedures  || [];
  const appliances = dental.appliances  || [];
  const photoUpper = dental.photoUpper  || null;
  const photoLower = dental.photoLower  || null;

  // Handle oral findings change
  const handleFindingChange = (catalogId, value) => {
    setOralFindings(prev => ({ ...prev, [catalogId]: value }));
  };

  const handleGradeStart = () => {
    if (!canSetDentalRecord) return;
    setGradeError(null);
    setGradeSuccess(false);
    setIsGrading(true);
  };

  const handleGradeCancel = () => {
    // Reset tooth chart by bumping the key (forces re-mount with initialStates)
    setChartResetKey(k => k + 1);
    setCurrentToothStates(initialToothStates);
    setOralFindings(buildInitialFindings());
    setIsGrading(false);
    setGradeError(null);
  };

  const handleGradeSave = async () => {
    if (!canSetDentalRecord) return;
    setIsSaving(true);
    setGradeError(null);
    try {
      // Build ToothPlacements — all 32 FDI teeth; uncolored teeth default to PRESENT
      const allTeeth = [
        ...TOOTH_LAYOUT.upper.right, ...TOOTH_LAYOUT.upper.left,
        ...TOOTH_LAYOUT.lower.right, ...TOOTH_LAYOUT.lower.left,
      ];
      const ToothPlacements = allTeeth.map((toothIndex) => {
        const code = currentToothStates[toothIndex] ?? '✓';
        return { toothIndex, legend: CODE_TO_ENUM[code] ?? 'PRESENT' };
      });

      // Build oralFindings — default unset values to false
      const oralFindingsInput = oralFindingCatalogs.map(c => ({
        oralFindingId: c.id,
        status: (oralFindings[c.id] === true || oralFindings[c.id] === 'yes') ? 'true' : 'false',
        notes: null,
      }));

      const dentalRecordId = patient.dental?.dentalRecordId;
      if (dentalRecordId) {
        await axiosRequest.post('/staff/emr', {
          query: GQL_UPDATE_DENTAL_RECORD,
          variables: {
            id: dentalRecordId,
            input: {
              notes: '',
              ToothPlacements,
              oralFindings: oralFindingsInput,
            },
          },
        });
      } else {
        await axiosRequest.post('/staff/emr', {
          query: GQL_CREATE_DENTAL_RECORD,
          variables: {
            patientId: patient.id,
            input: {
              notes: '',
              ToothPlacements,
              oralFindings: oralFindingsInput,
            },
          },
        });
      }

      setGradeSuccess(true);
      setIsGrading(false);
    } catch (err) {
      const msg = err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to save dental record.';
      setGradeError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle verify submission
  const handleVerifySubmission = async (submissionId) => {
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
  };

  // Handle dismiss submission
  const handleDismissSubmission = async (submissionId) => {
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
  };

  // Refresh pending submissions
  const handleRefreshSubmissions = async () => {
    console.log('Refreshing submissions for patient:', patient.id);
  };

  const hasToothData = Object.values(currentToothStates).some(s => s !== '✓');
  const hasFindings = Object.values(oralFindings).some(v => v === true || v === 'yes');

  return (
    <div className="space-y-3">

      {/* ── Pending Submissions (if any) ─────────────────────────── */}
      {pendingSubmissions.length > 0 && (
        <PatientSectionCard
          title="Pending Submissions"
          right={
            <span className="flex items-center gap-1 text-[10px] text-warning-600 dark:text-warning-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Requires attention
            </span>
          }
        >
          <PendingDentalSubmissions
            submissions={pendingSubmissions}
            onVerify={handleVerifySubmission}
            onDismiss={handleDismissSubmission}
            onRefresh={handleRefreshSubmissions}
          />
        </PatientSectionCard>
      )}

      {/* ── Dental Visit History ─────────────────────────────── */}
      <PatientSectionCard title="Dental Visit History">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
          <div className="flex items-start gap-3 py-1.5">
            <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[160px] shrink-0 pt-px">Seen by Dentist</span>
            <span className="text-sm font-medium text-secondary-800 dark:text-white">
              {dental.seenByDentist || <span className="text-secondary-300 dark:text-neutral-600 font-normal">—</span>}
            </span>
          </div>
          <div className="flex items-start gap-3 py-1.5">
            <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[160px] shrink-0 pt-px">Last Dental Cleaning</span>
            <span className="text-sm font-medium text-secondary-800 dark:text-white">
              {dental.lastCleaning || <span className="text-secondary-300 dark:text-neutral-600 font-normal">—</span>}
            </span>
          </div>
        </div>
      </PatientSectionCard>

      {/* ── Dental Procedures ────────────────────────────────── */}
      <PatientSectionCard title="Dental Procedures">
        {procedures.length > 0 ? (
          <div className="overflow-x-auto -mx-3 -mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-700/40">
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Procedure</th>
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-36">Date</th>
                </tr>
              </thead>
              <tbody>
                {procedures.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                    <td className="px-3 py-2 text-secondary-800 dark:text-white">{p.name}</td>
                    <td className="px-3 py-2 text-secondary-500 dark:text-neutral-400">{p.date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No dental procedures recorded.</p>
        )}
      </PatientSectionCard>

      {/* ── Oral Appliances ──────────────────────────────────── */}
      <PatientSectionCard title="Oral Appliances">
        {appliances.length > 0 ? (
          <div className="overflow-x-auto -mx-3 -mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-700/40">
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Tag</th>
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-24">Status</th>
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-32">Date Issued</th>
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-24">Arch</th>
                </tr>
              </thead>
              <tbody>
                {appliances.map((a, i) => {
                  const isActive = a.status && a.status !== 'Removed' && a.status !== 'removed';
                  return (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                      <td className="px-3 py-2 text-secondary-800 dark:text-white">{a.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${isActive ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400' : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'}`}>
                          {a.status || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-secondary-500 dark:text-neutral-400">{a.dateIssued || '—'}</td>
                      <td className="px-3 py-2 text-secondary-800 dark:text-white">{a.arch || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No oral appliances recorded.</p>
        )}
      </PatientSectionCard>

      {/* ── Dental Photos ────────────────────────────────────── */}
      {(photoUpper || photoLower) && (
        <PatientSectionCard title="Dental Photos">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Upper Teeth</p>
              {photoUpper ? (
                <AuthenticatedImage
                  path={`/media/record/dentalPhoto/${photoUpper}`}
                  alt="Upper teeth photo"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">No photo</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Lower Teeth</p>
              {photoLower ? (
                <AuthenticatedImage
                  path={`/media/record/dentalPhoto/${photoLower}`}
                  alt="Lower teeth photo"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">No photo</p>
                </div>
              )}
            </div>
          </div>
        </PatientSectionCard>
      )}

      {/* ── Interactive Tooth Chart + Oral Findings (graded together) ──── */}
      <PatientSectionCard
        title="Tooth Chart"
        right={
          <div className="flex items-center gap-2">
            {hasToothData && !isGrading && (
              <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
                {Object.values(currentToothStates).filter(s => s !== '✓').length} conditions marked
              </span>
            )}
            {!isGrading && canSetDentalRecord ? (
              <button
                onClick={handleGradeStart}
                className="px-3 py-1.5 text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Grade
              </button>
            ) : isGrading ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGradeCancel}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGradeSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-success-500 hover:bg-success-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Save Grade
                </button>
              </div>
            ) : null}
          </div>
        }
      >
        {gradeError && (
          <div className="mb-3 px-3 py-2 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-xs text-error-700 dark:text-error-400">
            {gradeError}
          </div>
        )}
        {gradeSuccess && (
          <div className="mb-3 px-3 py-2 rounded-md bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 text-xs text-success-700 dark:text-success-400">
            Dental record graded successfully.
          </div>
        )}
        <ToothChart
          key={chartResetKey}
          initialStates={initialToothStates}
          isEditing={isGrading}
          onStateChange={setCurrentToothStates}
        />
      </PatientSectionCard>

      {/* ── Oral Findings Table ────────────────────────────────── */}
      <PatientSectionCard
        title="Oral Findings"
        right={
          hasFindings && !isGrading ? (
            <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
              {Object.values(oralFindings).filter(v => v === true || v === 'yes').length} positive findings
            </span>
          ) : isGrading ? (
            <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">Grading mode</span>
          ) : null
        }
      >
        <OralFindingsTable
          catalogs={oralFindingCatalogs}
          findings={oralFindings}
          onFindingChange={handleFindingChange}
          readOnly={!isGrading}
        />
      </PatientSectionCard>

    </div>
  );
}
