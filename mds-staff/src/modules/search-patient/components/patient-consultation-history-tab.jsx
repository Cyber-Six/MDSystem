import React, { useState } from 'react';
import PatientSectionCard from './patient-section-card';

const TYPE_STYLES = {
  Medical: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50',
  Dental:  'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800/50',
};

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${TYPE_STYLES[type] || TYPE_STYLES.Medical}`}>
      {type}
    </span>
  );
}

export default function PatientConsultationHistoryTab({ patient }) {
  const consultations = patient.history.consultations || [];
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? consultations : consultations.filter(c => c.type === filter);

  return (
    <PatientSectionCard
      title="Consultation History"
      right={
        <div className="flex items-center gap-1">
          {['All', 'Medical', 'Dental'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-secondary-800 dark:bg-neutral-200 text-white dark:text-secondary-900'
                  : 'text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-1 text-xs text-secondary-400 dark:text-neutral-500">{filtered.length} entries</span>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="text-xs text-secondary-300 dark:text-neutral-600">No consultation records yet.</p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
          {filtered.map((consult, idx) => (
            <article key={idx} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">

              {/* Row 1: type badge + id + date/time */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={consult.type} />
                  <span className="text-[11px] font-mono text-secondary-400 dark:text-neutral-500">{consult.id}</span>
                </div>
                <span className="text-xs text-secondary-400 dark:text-neutral-500 shrink-0">
                  {consult.date}{consult.time ? ` · ${consult.time}` : ''}
                </span>
              </div>

              {/* Row 2: diagnosis + doctor */}
              <p className="text-sm font-semibold text-secondary-800 dark:text-white leading-snug">{consult.diagnosis}</p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">{consult.doctor}</p>

              {/* Row 3: vitals inline strip (if present) */}
              {consult.vitalSigns && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                  {consult.vitalSigns.bp && (
                    <span className="text-xs text-secondary-600 dark:text-neutral-300">
                      <span className="text-secondary-400 dark:text-neutral-500">BP </span>{consult.vitalSigns.bp}
                    </span>
                  )}
                  {consult.vitalSigns.temp && (
                    <span className="text-xs text-secondary-600 dark:text-neutral-300">
                      <span className="text-secondary-400 dark:text-neutral-500">Temp </span>{consult.vitalSigns.temp}°C
                    </span>
                  )}
                  {consult.vitalSigns.heartRate && (
                    <span className="text-xs text-secondary-600 dark:text-neutral-300">
                      <span className="text-secondary-400 dark:text-neutral-500">HR </span>{consult.vitalSigns.heartRate} bpm
                    </span>
                  )}
                </div>
              )}

              {/* Row 4: treatment + notes */}
              {(consult.treatment || consult.notes) && (
                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                  {consult.treatment && (
                    <p className="text-xs text-secondary-600 dark:text-neutral-300">
                      <span className="text-secondary-400 dark:text-neutral-500">Treatment: </span>{consult.treatment}
                    </p>
                  )}
                  {consult.notes && (
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">
                      <span className="text-secondary-400 dark:text-neutral-500">Notes: </span>{consult.notes}
                    </p>
                  )}
                </div>
              )}

            </article>
          ))}
        </div>
      )}
    </PatientSectionCard>
  );
}