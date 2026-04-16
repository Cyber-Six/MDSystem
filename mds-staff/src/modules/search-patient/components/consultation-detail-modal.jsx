import React, { useState, useEffect } from 'react';
import * as consultationService from '../consultation-service';
import ConsultationPrescriptionModal from './consultation-prescription-modal';

const DIAGNOSIS_TYPES = [
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'Differential', label: 'Differential' },
  { value: 'RuledOut', label: 'Ruled Out' },
  { value: 'Provisional', label: 'Provisional' },
  { value: 'Complication', label: 'Complication' },
  { value: 'Chronic', label: 'Chronic' },
  { value: 'FollowUp', label: 'Follow-Up' },
];

const TYPE_STYLES = {
  Medical: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50',
  Dental: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800/50',
};

const STATUS_STYLES = {
  Created: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-800/50',
  Open: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
  ReOpen: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50',
  Completed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50',
  Referred: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50',
  Monitored: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50',
};

function isLikelyCode(value) {
  const trimmed = value.trim();
  return /^[A-Z0-9]{1,3}[\dA-Z.-]*$/i.test(trimmed) && /\d/.test(trimmed);
}

function MultiInputField({ label, values, onChange, placeholder, isTextarea = false }) {
  const handleAdd = () => {
    onChange([...values, '']);
  };

  const handleRemove = (index) => {
    if (values.length === 1) return;
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const handleChange = (index, value) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">{label}</span>
        <button
          type="button"
          onClick={handleAdd}
          className="px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded border border-primary-200 dark:border-primary-800 transition-colors"
        >
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            {isTextarea ? (
              <textarea
                rows={2}
                value={value}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder={`${placeholder} ${values.length > 1 ? `#${index + 1}` : ''}`}
                className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder={`${placeholder} ${values.length > 1 ? `#${index + 1}` : ''}`}
                className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            )}
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="px-2 py-1 rounded text-[11px] font-medium bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/40 transition-colors shrink-0"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OutcomeCard({ outcome, index, total }) {
  const recordedDate = outcome.recordedAt
    ? new Date(outcome.recordedAt).toLocaleString('en-PH', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 overflow-hidden">
      <div className="bg-neutral-100 dark:bg-neutral-700/50 px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-secondary-700 dark:text-neutral-300">
          Entry #{total - index}
        </span>
        <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{recordedDate}</span>
      </div>
      <div className="p-3.5 space-y-2">
        {outcome.complaints?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
              Chief Complaints
            </p>
            <ul className="space-y-0.5">
              {outcome.complaints.map((c, i) => (
                <li key={c.id || i} className="text-xs text-secondary-700 dark:text-neutral-300 flex items-start gap-2" style={{ margin: 0, lineHeight: 1.3 }}>
                  <span className="text-primary-500 mt-0.5">-</span>
                  <span>{c.complaint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {outcome.diagnoses?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
              Diagnoses
            </p>
            <div className="space-y-0.5">
              {outcome.diagnoses.map((d, i) => (
                <div key={d.id || i} className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${
                      d.diagnosisType === 'Primary'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : 'bg-neutral-200 dark:bg-neutral-600 text-secondary-700 dark:text-neutral-300'
                    }`}
                  >
                    {d.diagnosisType}
                  </span>
                  <span className="text-xs text-secondary-700 dark:text-neutral-300">{d.diagnosisName}</span>
                  {d.notes && (
                    <span className="text-[9px] text-secondary-400 dark:text-neutral-500 italic">({d.notes})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {outcome.treatments?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
              Treatments
            </p>
            <ul className="space-y-0.5">
              {outcome.treatments.map((t, i) => (
                <li key={t.id || i} className="text-xs text-secondary-700 dark:text-neutral-300 flex items-start gap-2" style={{ margin: 0, lineHeight: 1.3 }}>
                  <span className="text-success-500 mt-0.5">-</span>
                  <span>{t.treatment}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {outcome.peFindings?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
              PE Findings
            </p>
            <ul className="space-y-0.5">
              {outcome.peFindings.map((f, i) => (
                <li key={f.id || i} className="text-xs text-secondary-700 dark:text-neutral-300 flex items-start gap-2" style={{ margin: 0, lineHeight: 1.3 }}>
                  <span className="text-accent-500 mt-0.5">-</span>
                  <span>{f.finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {outcome.remarks && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
              Remarks
            </p>
            <p className="text-xs text-secondary-700 dark:text-neutral-300" style={{ margin: 0, lineHeight: 1.3 }}>{outcome.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConsultationDetailModal({
  consultation,
  patient,
  onClose,
  onRefresh,
  canEditConsultation = true,
  canGenerateDocuments = true,
}) {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showPrescription, setShowPrescription] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenError, setReopenError] = useState('');
  const [reopenSuccess, setReopenSuccess] = useState('');

  // Reopen form state
  const [newComplaints, setNewComplaints] = useState(['']);
  const [newTreatments, setNewTreatments] = useState(['']);
  const [newPeFindings, setNewPeFindings] = useState(['']);
  const [newRemarks, setNewRemarks] = useState('');
  const [newDiagnoses, setNewDiagnoses] = useState([]);

  // ICD search state
  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdError, setIcdError] = useState('');

  const canReopen = Boolean(canEditConsultation);

  useEffect(() => {
    if (!canEditConsultation && showReopenForm) {
      setShowReopenForm(false);
    }
  }, [canEditConsultation, showReopenForm]);

  useEffect(() => {
    if (!canGenerateDocuments && showPrescription) {
      setShowPrescription(false);
    }
  }, [canGenerateDocuments, showPrescription]);

  useEffect(() => {
    if (!consultation?.id) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    consultationService
      .getOutcomes(consultation.id)
      .then((data) => {
        if (!cancelled) {
          setOutcomes(data || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load consultation outcomes.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [consultation?.id]);

  // ICD search effect
  useEffect(() => {
    const query = typeof icdQuery === 'string' ? icdQuery.trim() : '';
    if (query.length < 2) {
      setIcdResults([]);
      setIcdError('');
      setIcdLoading(false);
      return;
    }

    setIcdLoading(true);
    setIcdError('');

    const timer = setTimeout(async () => {
      try {
        let results;
        if (isLikelyCode(query)) {
          results = await consultationService.getIcdViaCodeCached(query);
        } else {
          results = await consultationService.getIcdViaTitleCached(query);
        }

        const cleaned = (results || []).filter((item) => item?.id && item?.code && item?.title).slice(0, 12);

        if (cleaned.length === 0) {
          setIcdError(`No ICD entries found for "${query}".`);
          setIcdResults([]);
        } else {
          setIcdResults(cleaned);
          setIcdError('');
        }
      } catch {
        setIcdError('ICD search failed. Please try again.');
        setIcdResults([]);
      } finally {
        setIcdLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [icdQuery]);

  const addDiagnosis = (item) => {
    if (!item?.id || !item?.title) return;

    setNewDiagnoses((prev) => {
      if (prev.some((entry) => String(entry.id) === String(item.id))) return prev;
      const hasPrimary = prev.some((entry) => entry.diagnosisType === 'Primary');
      return [
        ...prev,
        {
          id: item.id,
          code: item.code,
          title: item.title,
          diagnosisType: hasPrimary ? 'Secondary' : 'Primary',
          notes: '',
        },
      ];
    });
    setIcdQuery('');
    setIcdResults([]);
  };

  const removeDiagnosis = (id) => {
    setNewDiagnoses((prev) => {
      const next = prev.filter((entry) => String(entry.id) !== String(id));
      if (next.length > 0 && !next.some((entry) => entry.diagnosisType === 'Primary')) {
        next[0] = { ...next[0], diagnosisType: 'Primary' };
      }
      return next;
    });
  };

  const setDiagnosisType = (id, diagnosisType) => {
    setNewDiagnoses((prev) => {
      if (diagnosisType === 'Primary') {
        return prev.map((entry) =>
          String(entry.id) === String(id)
            ? { ...entry, diagnosisType: 'Primary' }
            : entry.diagnosisType === 'Primary'
            ? { ...entry, diagnosisType: 'Secondary' }
            : entry
        );
      }
      return prev.map((entry) => (String(entry.id) === String(id) ? { ...entry, diagnosisType } : entry));
    });
  };

  const setDiagnosisNotes = (id, value) => {
    setNewDiagnoses((prev) =>
      prev.map((entry) => (String(entry.id) === String(id) ? { ...entry, notes: value } : entry))
    );
  };

  const handleReopen = async () => {
    const validComplaints = newComplaints.map((c) => c.trim()).filter(Boolean);
    const validTreatments = newTreatments.map((t) => t.trim()).filter(Boolean);
    const validPeFindings = newPeFindings.map((p) => p.trim()).filter(Boolean);

    if (validComplaints.length === 0 && validTreatments.length === 0 && newDiagnoses.length === 0 && validPeFindings.length === 0 && !newRemarks.trim()) {
      setReopenError('Please add at least one complaint, treatment, PE finding, diagnosis, or remark.');
      return;
    }

    setReopenLoading(true);
    setReopenError('');
    setReopenSuccess('');

    try {
      const input = {
        consultationId: consultation.id,
        remarks: newRemarks.trim() || null,
        complaints: validComplaints,
        peFindings: validPeFindings,
        treatments: validTreatments,
        diagnoses: newDiagnoses.map((d) => consultationService.mapToBackendDiagnosis(d)),
      };

      // Step 1: Reopen consultation with new details
      await consultationService.reOpenConsultation(input);

      // Step 2: Mark consultation as completed so it can be reopened again
      await consultationService.submitConsultation(consultation.id, 'Completed');

      setReopenSuccess('New details added successfully. Consultation is ready for additional entries.');
      setShowReopenForm(false);
      setNewComplaints(['']);
      setNewTreatments(['']);
      setNewPeFindings(['']);
      setNewRemarks('');
      setNewDiagnoses([]);

      // Refresh outcomes
      const updatedOutcomes = await consultationService.getOutcomes(consultation.id);
      setOutcomes(updatedOutcomes || []);

      // Clear consultation cache to ensure fresh data on next load
      consultationService.clearConsultationCache(consultation.patientId || consultation.patient?.id);

      if (onRefresh) onRefresh();
    } catch (err) {
      // Handle specific GraphQL errors
      if (err.message?.includes('Outcome cannot be created in its consultation status')) {
        setReopenError('This consultation cannot be reopened in its current status. It may have already been reopened or is in a final state.');
      } else if (err.graphQLErrors?.length > 0) {
        const graphqlError = err.graphQLErrors[0];
        setReopenError(graphqlError.message || 'Failed to add new details. Please try again.');
      } else {
        setReopenError(err.message || 'Failed to add new details. Please try again.');
      }
    } finally {
      setReopenLoading(false);
    }
  };

  const resetReopenForm = () => {
    setShowReopenForm(false);
    setNewComplaints(['']);
    setNewTreatments(['']);
    setNewPeFindings(['']);
    setNewRemarks('');
    setNewDiagnoses([]);
    setIcdQuery('');
    setIcdResults([]);
    setReopenError('');
    setReopenSuccess('');
  };

  if (!consultation) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between rounded-t-xl">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white" style={{ margin: 0, lineHeight: 1.2 }}>Consultation Details</h2>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                  TYPE_STYLES[consultation.type] || TYPE_STYLES.Medical
                }`}
              >
                {consultation.type}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                  STATUS_STYLES[consultation.status] || STATUS_STYLES.Created
                }`}
              >
                {consultation.status}
              </span>
            </div>
            <div className="flex items-center text-xs text-secondary-600 dark:text-neutral-400 flex-wrap" style={{ gap: '4px' }}>
              <span className="font-mono text-[10px]">{consultation.id}</span>
              <span>&middot;</span>
              <span>{consultation.date}</span>
              {consultation.time && (
                <>
                  <span>&middot;</span>
                  <span>{consultation.time}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Error/Loading state */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <svg className="w-3.5 h-3.5 text-error-600 dark:text-error-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-error-700 dark:text-error-400 mb-0">{error}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              <div className="h-32 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse" />
              <div className="h-32 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse" />
            </div>
          )}

          {/* Success message */}
          {reopenSuccess && (
            <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
              <svg className="w-3.5 h-3.5 text-success-600 dark:text-success-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-success-700 dark:text-success-400 mb-0">{reopenSuccess}</p>
            </div>
          )}

          {/* Consultation notes */}
          {consultation.notes && (
            <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1">
                Consultation Notes
              </p>
              <p className="text-xs text-secondary-700 dark:text-neutral-300" style={{ margin: 0, lineHeight: 1.3 }}>{consultation.notes}</p>
            </div>
          )}

          {/* Outcomes history */}
          {!loading && outcomes.length === 0 && (
            <p className="text-sm text-secondary-400 dark:text-neutral-500 text-center py-8">
              No outcome records found for this consultation.
            </p>
          )}

          {!loading && outcomes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-secondary-800 dark:text-white mb-2">
                Consultation History ({outcomes.length} {outcomes.length === 1 ? 'entry' : 'entries'})
              </h3>
              <div className="space-y-2">
                {outcomes.map((outcome, idx) => (
                  <OutcomeCard key={outcome.id || idx} outcome={outcome} index={idx} total={outcomes.length} />
                ))}
              </div>
            </div>
          )}

          {/* Reopen form */}
          {showReopenForm && (
            <div className="border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
              <div className="bg-orange-50 dark:bg-orange-900/20 px-3.5 py-2.5 border-b border-orange-200 dark:border-orange-800">
                <h3 className="text-xs font-semibold text-orange-900 dark:text-orange-400">
                  Add New Consultation Details
                </h3>
                <p className="text-[11px] text-orange-700 dark:text-orange-500 mt-0.5" style={{ margin: 0, lineHeight: 1.3 }}>
                  Add new complaints, treatments, diagnoses, or remarks. You can add multiple entries to this consultation.
                </p>
              </div>
              <div className="p-3.5 space-y-3 bg-white dark:bg-neutral-800">
                <div className="grid md:grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400 mb-1 block">
                      New Clinical Notes (Optional)
                    </span>
                    <textarea
                      rows={3}
                      value={newRemarks}
                      onChange={(e) => setNewRemarks(e.target.value)}
                      placeholder="Additional clinical notes"
                      className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-xs text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </label>

                  <MultiInputField
                    label="New PE Findings"
                    values={newPeFindings}
                    onChange={setNewPeFindings}
                    placeholder="Physical examination finding"
                    isTextarea={true}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-2.5">
                  <MultiInputField
                    label="New Chief Complaints"
                    values={newComplaints}
                    onChange={setNewComplaints}
                    placeholder="Enter complaint"
                    isTextarea={true}
                  />

                  <MultiInputField
                    label="New Treatments"
                    values={newTreatments}
                    onChange={setNewTreatments}
                    placeholder="Enter treatment"
                    isTextarea={false}
                  />
                </div>

                {/* ICD Search */}
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">
                      Search ICD for New Diagnoses
                    </span>
                    <input
                      type="text"
                      value={icdQuery}
                      onChange={(e) => setIcdQuery(e.target.value)}
                      placeholder="Type ICD code or diagnosis title"
                      className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-xs text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </label>

                  {(icdLoading || icdError || icdResults.length > 0) && (
                    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                      {icdLoading && <p className="px-3 py-2 text-xs text-secondary-500 dark:text-neutral-400">Searching...</p>}
                      {icdError && <p className="px-3 py-2 text-xs text-error-600 dark:text-error-400">{icdError}</p>}
                      {!icdLoading && !icdError && icdResults.length > 0 && (
                        <ul className="max-h-40 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-700/60">
                          {icdResults.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => addDiagnosis(item)}
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors"
                              >
                                <p className="text-xs font-semibold text-secondary-800 dark:text-white">{item.code}</p>
                                <p className="text-xs text-secondary-500 dark:text-neutral-400 line-clamp-2">{item.title}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Selected new diagnoses */}
                  <div className="space-y-2">
                    {newDiagnoses.length === 0 ? (
                      <p className="text-xs text-secondary-400 dark:text-neutral-500">No new diagnoses added.</p>
                    ) : (
                      newDiagnoses.map((entry) => (
                        <div key={entry.id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-secondary-800 dark:text-white">{entry.code}</p>
                              <p className="text-xs text-secondary-500 dark:text-neutral-400 break-words">{entry.title}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={entry.diagnosisType}
                                onChange={(e) => setDiagnosisType(entry.id, e.target.value)}
                                className={`px-2 py-1 rounded text-[10px] font-medium border ${
                                  entry.diagnosisType === 'Primary'
                                    ? 'bg-primary-500 text-white border-primary-600'
                                    : 'bg-white dark:bg-neutral-600 text-secondary-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-500'
                                } focus:outline-none focus:ring-2 focus:ring-primary-300`}
                              >
                                {DIAGNOSIS_TYPES.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeDiagnosis(entry.id)}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) => setDiagnosisNotes(entry.id, e.target.value)}
                            placeholder="Optional diagnosis note"
                            className="mt-1.5 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {reopenError && (
                  <p className="text-xs text-error-600 dark:text-error-400">{reopenError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3 rounded-b-xl">
          {showReopenForm ? (
            <>
              <button
                onClick={resetReopenForm}
                disabled={reopenLoading}
                className="px-3.5 py-2 text-xs font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={reopenLoading}
                className="px-3.5 py-2 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {reopenLoading && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                Add & Save Details
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                {patient && canGenerateDocuments && (
                  <button
                    onClick={() => setShowPrescription(true)}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Prescription
                  </button>
                )}
                {canReopen && (
                  <button
                    onClick={() => setShowReopenForm(true)}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Details
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Prescription modal overlay */}
      <ConsultationPrescriptionModal
        isOpen={showPrescription}
        onClose={() => setShowPrescription(false)}
        patient={patient}
        consultation={consultation}
        outcomes={outcomes}
      />
    </div>
  );
}
