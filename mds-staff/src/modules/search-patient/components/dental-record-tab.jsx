import React, { useState } from 'react';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import PendingDentalSubmissions from './pending-dental-submissions';
import { getLegend, ORAL_FINDINGS } from './tooth-chart-constants';

/* ─── helpers ──────────────────────────────────────────────── */

function MetricCell({ label, value, highlight = false }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[11px] text-secondary-400 dark:text-neutral-500 leading-none mb-1.5">{label}</p>
      {value ? (
        <p className={`text-sm font-semibold leading-none ${highlight ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-800 dark:text-white'}`}>
          {value}
        </p>
      ) : (
        <p className="text-sm text-secondary-300 dark:text-neutral-600">—</p>
      )}
    </div>
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
  const treatments = dental.treatments || [];

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

  const metricItems = [
    { label: 'First Time Dentist', value: dental.firstTimeDentist },
    { label: 'Last Consultation', value: dental.lastConsultation, highlight: true },
    { label: 'Last Cleaning', value: dental.lastCleaning },
    { label: 'Tooth Extraction', value: dental.toothExtraction },
    { label: 'Dental Filling', value: dental.dentalFilling },
    { label: 'Appliance', value: dental.hasAppliance },
  ];

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

      {/* ── Dental Summary ───────────────────────────────────── */}
      <PatientSectionCard title="Dental Summary">
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-neutral-200 dark:divide-neutral-700 -mx-3 -mb-3 border-t border-neutral-100 dark:border-neutral-700/60">
          {metricItems.map(({ label, value, highlight }) => (
            <MetricCell key={label} label={label} value={value} highlight={highlight} />
          ))}
        </div>
      </PatientSectionCard>

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

      {/* ── Treatment History ────────────────────────────────── */}
      <PatientSectionCard title="Treatment History">
        {treatments.length === 0 ? (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No dental treatments recorded.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
            {treatments.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white leading-none">{t.treatment}</p>
                  <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">{t.dentist}</p>
                </div>
                <span className="text-xs text-secondary-400 dark:text-neutral-500 shrink-0 ml-4">{t.date}</span>
              </div>
            ))}
          </div>
        )}
      </PatientSectionCard>

    </div>
  );
}
