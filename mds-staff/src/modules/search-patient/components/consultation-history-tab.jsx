import React, { useState } from 'react';
import PatientSectionCard from './section-card';
import ConsultationDetailModal from './consultation-detail-modal';

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

export default function PatientConsultationHistoryTab({
  patient,
  consultations: consultationEntries,
  onRefreshConsultations,
  canEditConsultation = true,
  canGenerateDocuments = true,
}) {
  const consultations = consultationEntries || patient?.history?.consultations || [];
  const [filter, setFilter] = useState('All');
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  const filtered = filter === 'All' ? consultations : consultations.filter(c => c.type === filter);

  const handleConsultationClick = (consult) => {
    setSelectedConsultation(consult);
  };

  const handleCloseModal = () => {
    setSelectedConsultation(null);
  };

  const handleRefresh = () => {
    setSelectedConsultation(null);
    if (onRefreshConsultations) {
      onRefreshConsultations();
    }
  };

  return (
    <>
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
                    ? 'bg-primary-500 dark:bg-primary-600 text-white dark:text-white font-semibold'
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
          <div className="space-y-2">
            {filtered.map((consult, idx) => (
              <article
                key={idx}
                className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 overflow-hidden hover:shadow-sm dark:hover:shadow-2xl/10 transition-shadow cursor-pointer"
                onClick={() => handleConsultationClick(consult)}
              >
                {(() => {
                  const diagnosis = getPrimaryDiagnosis(consult);
                  return (
                    <>
                      {/* Header: Diagnosis + Date */}
                      <div className="px-3.5 py-2.5 flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-700/60">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-secondary-800 dark:text-white truncate" style={{ margin: 0, lineHeight: 1.2 }}>
                            {diagnosis.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {consult.date && <span className="text-xs text-secondary-400 dark:text-neutral-500 whitespace-nowrap">{consult.date}{consult.time ? ` · ${consult.time}` : ''}</span>}
                          <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">View</span>
                        </div>
                      </div>

                      {/* Badges row: type + status + mode + id */}
                      <div className="px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-700/60 flex items-center gap-1.5 flex-wrap">
                        <TypeBadge type={consult.type} />
                        {consult.status && <StatusBadge status={consult.status} />}
                        {consult.mode && <ModeBadge mode={consult.mode} />}
                        {consult.id && <span className="text-[11px] font-mono text-secondary-500 dark:text-neutral-400">{consult.id}</span>}
                      </div>

                      {/* Content: Doctor + Treatment + Notes */}
                      <div className="px-3.5 py-2 space-y-1">
                        {consult.doctor && (
                          <p className="text-sm text-secondary-700 dark:text-neutral-200" style={{ margin: 0, lineHeight: 1.3 }}>
                            <span className="text-secondary-500 dark:text-neutral-400 font-medium">Clinic Staff:</span> {consult.doctor}
                          </p>
                        )}
                        {consult.treatment && (
                          <p className="text-sm text-secondary-700 dark:text-neutral-200" style={{ margin: 0, lineHeight: 1.3 }}>
                            <span className="text-secondary-500 dark:text-neutral-400 font-medium">Treatment:</span> {consult.treatment}
                          </p>
                        )}
                        {consult.notes && (
                          <p className="text-sm text-secondary-700 dark:text-neutral-200" style={{ margin: 0, lineHeight: 1.3 }}>
                            <span className="text-secondary-500 dark:text-neutral-400 font-medium">Notes:</span> {consult.notes}
                          </p>
                        )}
                      </div>

                      {diagnosis.codes.length > 1 && (
                        <div className="px-3.5 py-1.5 border-t border-neutral-100 dark:border-neutral-700/60 flex gap-1 flex-wrap">
                          {diagnosis.codes.slice(0, 4).map((code, codeIdx) => (
                            <span key={`${code}-${codeIdx}`} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 font-medium">
                              {code}
                            </span>
                          ))}
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

      {/* Consultation Detail Modal */}
      {selectedConsultation && (
        <ConsultationDetailModal
          consultation={selectedConsultation}
          patient={patient}
          onClose={handleCloseModal}
          onRefresh={handleRefresh}
          canEditConsultation={canEditConsultation}
          canGenerateDocuments={canGenerateDocuments}
        />
      )}
    </>
  );
}