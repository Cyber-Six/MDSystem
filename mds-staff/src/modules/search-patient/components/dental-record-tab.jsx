import React from 'react';
import PatientSectionCard from './section-card';

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

function FindingTag({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800/50">
      {children}
    </span>
  );
}

function ToothTag({ children, variant = 'default' }) {
  const styles = {
    missing: 'bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 border border-error-200 dark:border-error-800/50',
    filled:  'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50',
    decayed: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800/50',
    default: 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-mono font-medium leading-none ${styles[variant]}`}>
      {children}
    </span>
  );
}

/* ─── main component ────────────────────────────────────────── */

export default function PatientDentalRecordTab({ patient }) {
  const dental     = patient.dental || {};
  const treatments = dental.treatments || [];
  const chart      = dental.toothChart || { missing: [], filled: [], decayed: [], notes: '' };

  const metricItems = [
    { label: 'First Time Dentist', value: dental.firstTimeDentist },
    { label: 'Last Consultation',  value: dental.lastConsultation, highlight: true },
    { label: 'Last Cleaning',      value: dental.lastCleaning },
    { label: 'Tooth Extraction',   value: dental.toothExtraction },
    { label: 'Dental Filling',     value: dental.dentalFilling },
    { label: 'Appliance',          value: dental.hasAppliance },
  ];

  const hasChartData =
    chart.missing?.length > 0 ||
    chart.filled?.length  > 0 ||
    chart.decayed?.length > 0 ||
    chart.notes;

  return (
    <div className="space-y-3">

      {/* ── Dental Summary ───────────────────────────────────── */}
      <PatientSectionCard title="Dental Summary">
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-neutral-200 dark:divide-neutral-700 -mx-3 -mb-3 border-t border-neutral-100 dark:border-neutral-700/60">
          {metricItems.map(({ label, value, highlight }) => (
            <MetricCell key={label} label={label} value={value} highlight={highlight} />
          ))}
        </div>
      </PatientSectionCard>

      {/* ── Oral Findings ────────────────────────────────────── */}
      <PatientSectionCard title="Oral Findings">
        {(dental.oralFindings || []).length === 0 ? (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No oral findings recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dental.oralFindings.map((finding, idx) => (
              <FindingTag key={idx}>{finding}</FindingTag>
            ))}
          </div>
        )}
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

      {/* ── Tooth Chart (conditional) ────────────────────────── */}
      {hasChartData && (
        <PatientSectionCard title="Tooth Chart">
          <div className="space-y-3">

            {chart.missing?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">Missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {chart.missing.map((t, i) => <ToothTag key={i} variant="missing">{t}</ToothTag>)}
                </div>
              </div>
            )}

            {chart.filled?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">Filled</p>
                <div className="flex flex-wrap gap-1.5">
                  {chart.filled.map((t, i) => <ToothTag key={i} variant="filled">{t}</ToothTag>)}
                </div>
              </div>
            )}

            {chart.decayed?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">Decayed</p>
                <div className="flex flex-wrap gap-1.5">
                  {chart.decayed.map((t, i) => <ToothTag key={i} variant="decayed">{t}</ToothTag>)}
                </div>
              </div>
            )}

            {chart.notes && (
              <p className="text-xs text-warning-700 dark:text-warning-400 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                {chart.notes}
              </p>
            )}

          </div>
        </PatientSectionCard>
      )}

    </div>
  );
}