import React, { useState, useEffect } from 'react';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import PendingDentalSubmissions from './pending-dental-submissions';
import { getLegend, ORAL_FINDINGS } from './tooth-chart-constants';
import { axiosRequest } from '../../../packages-core-adapter';

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
function OralFindingsTable({ findings, onFindingChange, readOnly = false }) {
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
          {ORAL_FINDINGS.map((finding, idx) => {
            const value = findings[finding];
            return (
              <tr
                key={finding}
                className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'} hover:bg-primary-50/50 dark:hover:bg-neutral-700/30 transition-colors`}
              >
                <td className="px-3 py-2 text-xs text-secondary-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-700">
                  {finding}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <input
                    type="radio"
                    name={`finding-${finding}`}
                    checked={value === 'yes'}
                    onChange={() => !readOnly && onFindingChange(finding, 'yes')}
                    disabled={readOnly}
                    className="w-4 h-4 text-green-600 border-neutral-300 dark:border-neutral-500 focus:ring-green-500 dark:bg-neutral-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <input
                    type="radio"
                    name={`finding-${finding}`}
                    checked={value === 'no'}
                    onChange={() => !readOnly && onFindingChange(finding, 'no')}
                    disabled={readOnly}
                    className="w-4 h-4 text-red-600 border-neutral-300 dark:border-neutral-500 focus:ring-red-500 dark:bg-neutral-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  />
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

export default function PatientDentalRecordTab({ patient }) {
  const dental = patient.dental || {};

  // Convert legacy chart format to new tooth states format
  const convertLegacyChart = (chart) => {
    const states = {};
    if (chart?.missing) {
      chart.missing.forEach(tooth => { states[tooth] = 'M'; });
    }
    if (chart?.filled) {
      chart.filled.forEach(tooth => { states[tooth] = 'F'; });
    }
    if (chart?.decayed) {
      chart.decayed.forEach(tooth => { states[tooth] = 'C'; });
    }
    // Also include any states from the new format if available
    if (chart?.states) {
      Object.assign(states, chart.states);
    }
    return states;
  };

  const [toothStates, setToothStates] = useState(() =>
    convertLegacyChart(dental.toothChart)
  );

  // Oral findings state - convert array format to object format
  const [oralFindings, setOralFindings] = useState(() => {
    const findingsObj = {};
    // Initialize from existing data if available
    if (dental.oralFindings && Array.isArray(dental.oralFindings)) {
      dental.oralFindings.forEach(f => { findingsObj[f] = 'yes'; });
    } else if (dental.oralFindings && typeof dental.oralFindings === 'object') {
      return dental.oralFindings;
    }
    return findingsObj;
  });

  const [isEditingFindings, setIsEditingFindings] = useState(false);

  // Mock pending submissions - in real app, this would come from API
  const [pendingSubmissions, setPendingSubmissions] = useState(() =>
    dental.pendingSubmissions || []
  );

  const procedures       = dental.procedures  || [];
  const appliances       = dental.appliances  || [];
  const photoUpper       = dental.photoUpper  || null;
  const photoLower       = dental.photoLower  || null;

  // Handle tooth chart save
  const handleSaveToothChart = async (newStates) => {
    console.log('Saving tooth chart for patient:', patient.id, newStates);
    setToothStates(newStates);
    // TODO: API call to save tooth chart
  };

  // Handle oral findings change
  const handleFindingChange = (finding, value) => {
    setOralFindings(prev => ({
      ...prev,
      [finding]: value
    }));
  };

  // Save oral findings
  const handleSaveFindings = async () => {
    console.log('Saving oral findings for patient:', patient.id, oralFindings);
    setIsEditingFindings(false);
    // TODO: API call to save findings
  };

  // Handle verify submission
  const handleVerifySubmission = async (submissionId) => {
    console.log('Verifying submission:', submissionId);
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
  };

  // Handle dismiss submission
  const handleDismissSubmission = async (submissionId) => {
    console.log('Dismissing submission:', submissionId);
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
  };

  // Refresh pending submissions
  const handleRefreshSubmissions = async () => {
    console.log('Refreshing submissions for patient:', patient.id);
  };

  const hasToothData = Object.keys(toothStates).length > 0;
  const hasFindings = Object.keys(oralFindings).some(k => oralFindings[k]);

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

      {/* ── Interactive Tooth Chart ──────────────────────────── */}
      <PatientSectionCard
        title="Tooth Chart"
        right={
          hasToothData && (
            <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
              {Object.keys(toothStates).length} teeth marked
            </span>
          )
        }
      >
        <ToothChart
          initialStates={toothStates}
          onSave={handleSaveToothChart}
          patientId={patient.id}
          readOnly={false}
        />
      </PatientSectionCard>

      {/* ── Oral Findings Table ────────────────────────────────── */}
      <PatientSectionCard
        title="Oral Findings"
        right={
          <div className="flex items-center gap-2">
            {hasFindings && !isEditingFindings && (
              <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
                {Object.values(oralFindings).filter(v => v === 'yes').length} findings
              </span>
            )}
            {!isEditingFindings ? (
              <button
                onClick={() => setIsEditingFindings(true)}
                className="text-[10px] text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingFindings(false)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFindings}
                  className="text-[10px] text-success-600 hover:text-success-700 dark:text-success-400 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </button>
              </div>
            )}
          </div>
        }
      >
        <OralFindingsTable
          findings={oralFindings}
          onFindingChange={handleFindingChange}
          readOnly={!isEditingFindings}
        />
      </PatientSectionCard>

    </div>
  );
}
