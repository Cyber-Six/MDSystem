import React, { useState } from 'react';
import PatientSectionCard from './section-card';
import * as consultationService from '../consultation-service';

const TYPE_STYLES = {
  Medical: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50',
  Dental:  'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800/50',
};

const STATUS_STYLES = {
  Created: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-800/50',
  Open: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
  ReOpen: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50',
  Completed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50',
  Referred: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50',
  Monitored: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50',
};

const MODE_STYLES = {
  Onsite: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300',
  Virtual: 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400',
};

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${TYPE_STYLES[type] || TYPE_STYLES.Medical}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${STATUS_STYLES[status] || STATUS_STYLES.Created}`}>
      {status}
    </span>
  );
}

function ModeBadge({ mode }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${MODE_STYLES[mode] || MODE_STYLES.Onsite}`}>
      {mode}
    </span>
  );
}

function getPrimaryDiagnosis(consult) {
  if (!Array.isArray(consult?.diagnoses) || consult.diagnoses.length === 0) {
    return { text: consult?.diagnosis || 'No diagnosis', codes: [] };
  }

  const primary = consult.diagnoses.find((d) => d?.isPrimary || String(d?.diagnosisType || '').toLowerCase() === 'primary') || consult.diagnoses[0];
  const title = primary?.title || primary?.diagnosisName || consult?.diagnosis || 'No diagnosis';
  const codes = consult.diagnoses.map((d) => d?.code || d?.icdCode).filter(Boolean);
  const codePrefix = primary?.code || primary?.icdCode;

  return {
    text: codePrefix ? `${codePrefix} - ${title}` : title,
    codes,
  };
}

export default function PatientConsultationHistoryTab({ patient, consultations: consultationEntries, onRefreshConsultations }) {
  const consultations = consultationEntries || patient?.history?.consultations || [];
  const [filter, setFilter] = useState('All');
  const [reopening, setReopening] = useState(null);

  const filtered = filter === 'All' ? consultations : consultations.filter(c => c.type === filter);

  const handleReopenConsultation = async (consultation) => {
    if (reopening === consultation.id) return;

    setReopening(consultation.id);

    try {
      const input = {
        consultationId: consultation.id,
        remarks: `Consultation reopened for additional details - ${new Date().toLocaleString('en-PH')}`,
        complaints: [],
        peFindings: [],
        treatments: [],
        diagnoses: consultation.diagnoses?.map(d => consultationService.mapToBackendDiagnosis(d)) || [],
      };

      const reopenedOutcome = await consultationService.reOpenConsultation(input);

      if (reopenedOutcome) {
        alert(`Consultation ${consultation.id} has been reopened. You can now add additional details.`);
        // Refresh consultations list
        if (onRefreshConsultations) {
          onRefreshConsultations();
        }
      }
    } catch (err) {
      console.error('Error reopening consultation:', err);
      alert('Failed to reopen consultation. Please try again.');
    } finally {
      setReopening(null);
    }
  };

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
              {(() => {
                const diagnosis = getPrimaryDiagnosis(consult);
                return (
                  <>

              {/* Row 1: type badge + status badge + mode + id + date/time */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={consult.type} />
                  {consult.status && <StatusBadge status={consult.status} />}
                  {consult.mode && <ModeBadge mode={consult.mode} />}
                  <span className="text-[11px] font-mono text-secondary-400 dark:text-neutral-500">{consult.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary-400 dark:text-neutral-500 shrink-0">
                    {consult.date}{consult.time ? ` · ${consult.time}` : ''}
                  </span>
                  {(consult.status === 'Completed' || consult.status === 'Referred' || consult.status === 'Monitored') && (
                    <button
                      onClick={() => handleReopenConsultation(consult)}
                      disabled={reopening === consult.id}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        reopening === consult.id
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40'
                      }`}
                    >
                      {reopening === consult.id ? 'Reopening...' : 'Reopen'}
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: diagnosis + doctor */}
              <p className="text-sm font-semibold text-secondary-800 dark:text-white leading-snug">{diagnosis.text}</p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">{consult.doctor}</p>
              {diagnosis.codes.length > 1 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {diagnosis.codes.slice(0, 4).map((code, codeIdx) => (
                    <span key={`${code}-${codeIdx}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300">
                      {code}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 3: treatment + notes */}
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

                  </>
                );
              })()}

            </article>
          ))}
        </div>
      )}
    </PatientSectionCard>
  );
}