import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Stethoscope, FileText, Search } from 'lucide-react';
import * as consultationService from '../../search-patient/consultation-service';

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

function isLikelyCode(value) {
  const trimmed = value.trim();
  return /^[A-Z0-9]{1,3}[\dA-Z.\-]*$/i.test(trimmed) && /\d/.test(trimmed);
}

/* ── Reusable multi-input (same pattern as search-patient consultation-tab) ── */
function MultiInput({ label, values, onChange, placeholder, isTextarea = false }) {
  const cls = `w-full rounded-lg text-xs px-2.5 py-1.5
    bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
    text-secondary-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500
    focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange([...values, ''])}
          className="px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400
                     bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40
                     rounded border border-emerald-200 dark:border-emerald-800 transition-colors"
        >
          + Add
        </button>
      </div>
      <div className="space-y-1.5">
        {values.map((val, i) => (
          <div key={i} className="flex gap-1.5">
            {isTextarea ? (
              <textarea
                rows={2}
                value={val}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
                className={cls + ' resize-none'}
              />
            ) : (
              <input
                value={val}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
                className={cls}
              />
            )}
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="flex-shrink-0 p-1 text-neutral-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ConsultationPanel — right-side panel for creating virtual consultations
 * from within the health-chat. Same logic as search-patient consultation form.
 */
const ConsultationPanel = ({ isOpen, onClose, patientId, patientName, onIssuePrescription }) => {
  /* ── Form state ── */
  const [type, setType]                     = useState('Medical');
  const [notes, setNotes]                   = useState('');
  const [chiefComplaints, setChiefComplaints] = useState(['']);
  const [peFindings, setPeFindings]         = useState(['']);
  const [treatments, setTreatments]         = useState(['']);

  /* ── ICD search ── */
  const [icdQuery, setIcdQuery]               = useState('');
  const [icdResults, setIcdResults]           = useState([]);
  const [icdLoading, setIcdLoading]           = useState(false);
  const [icdError, setIcdError]               = useState('');
  const [icdUnavailable, setIcdUnavailable]   = useState(false);
  const [manualDiagnosis, setManualDiagnosis] = useState('');

  /* ── Selected diagnoses ── */
  const [diagnoses, setDiagnoses] = useState([]);

  /* ── Submit state ── */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);

  /* ── Reset on open ── */
  useEffect(() => {
    if (!isOpen) return;
    setType('Medical');
    setNotes('');
    setChiefComplaints(['']);
    setPeFindings(['']);
    setTreatments(['']);
    setIcdQuery('');
    setIcdResults([]);
    setIcdLoading(false);
    setIcdError('');
    setManualDiagnosis('');
    setDiagnoses([]);
    setSubmitting(false);
    setError(null);
    setSuccess(false);
  }, [isOpen]);

  /* ── ICD search (300ms debounce) ── */
  useEffect(() => {
    const q = typeof icdQuery === 'string' ? icdQuery.trim() : '';
    if (q.length < 2) {
      setIcdResults([]);
      setIcdError('');
      return;
    }

    setIcdLoading(true);
    setIcdError('');

    const timer = setTimeout(async () => {
      try {
        let results;
        if (isLikelyCode(q)) {
          results = await consultationService.getIcdViaCodeCached
            ? consultationService.getIcdViaCodeCached(q)
            : consultationService.getIcdViaCode(q);
        } else {
          results = await consultationService.getIcdViaTitleCached
            ? consultationService.getIcdViaTitleCached(q)
            : consultationService.getIcdViaTitle(q);
        }
        setIcdResults(results || []);
      } catch (err) {
        if (err?.response?.status === 500 || err?.message?.includes('Network')) {
          setIcdUnavailable(true);
          setIcdError('ICD service unavailable — use manual diagnosis.');
        } else {
          setIcdError('Search failed.');
        }
        setIcdResults([]);
      } finally {
        setIcdLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [icdQuery]);

  /* ── Diagnosis helpers ── */
  const addDiagnosis = useCallback((item) => {
    if (!item?.id || !item?.title) return;
    setDiagnoses(prev => {
      if (prev.some(d => String(d.id) === String(item.id))) return prev;
      const dtype = prev.length === 0 ? 'Primary' : 'Secondary';
      return [...prev, { id: item.id, code: item.code, title: item.title, diagnosisType: dtype, notes: '' }];
    });
    setIcdQuery('');
    setIcdResults([]);
  }, []);

  const removeDiagnosis = useCallback((id) => {
    setDiagnoses(prev => {
      const filtered = prev.filter(d => String(d.id) !== String(id));
      if (filtered.length > 0 && !filtered.some(d => d.diagnosisType === 'Primary')) {
        filtered[0] = { ...filtered[0], diagnosisType: 'Primary' };
      }
      return filtered;
    });
  }, []);

  const setDiagnosisType = useCallback((id, dtype) => {
    setDiagnoses(prev => prev.map(d => {
      if (String(d.id) === String(id)) return { ...d, diagnosisType: dtype };
      if (dtype === 'Primary' && d.diagnosisType === 'Primary') return { ...d, diagnosisType: 'Secondary' };
      return d;
    }));
  }, []);

  const setDiagnosisNotes = useCallback((id, value) => {
    setDiagnoses(prev => prev.map(d => String(d.id) === String(id) ? { ...d, notes: value } : d));
  }, []);

  /* ── Save consultation ── */
  const handleSave = async () => {
    const validComplaints = chiefComplaints.map(c => c.trim()).filter(Boolean);
    const validTreatments = treatments.map(t => t.trim()).filter(Boolean);
    const validPeFindings = peFindings.map(p => p.trim()).filter(Boolean);

    if (validComplaints.length === 0 || !notes.trim()) {
      setError('At least one chief complaint and clinical notes are required.');
      return;
    }

    if (!icdUnavailable && diagnoses.length === 0) {
      setError('Please select at least one ICD diagnosis.');
      return;
    }

    if (!icdUnavailable && !diagnoses.some(d => d.diagnosisType === 'Primary')) {
      setError('Please assign a Primary diagnosis.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const normalizedDiagnoses = diagnoses.map(d => consultationService.mapToBackendDiagnosis({
        title: d.title,
        id: d.id,
        diagnosisType: d.diagnosisType,
        notes: d.notes || '',
      }));

      const consultationInput = {
        patientId: String(patientId),
        followUpId: null,
        mode: 'Virtual',
        type,
        notes: notes.trim() || null,
      };

      const outcomeInput = {
        consultationId: null,
        remarks: notes.trim() || null,
        complaints: validComplaints,
        peFindings: validPeFindings,
        treatments: validTreatments,
        diagnoses: normalizedDiagnoses,
      };

      await consultationService.createAndSubmitConsultation(consultationInput, outcomeInput, 'Completed');

      if (consultationService.clearConsultationCache) {
        consultationService.clearConsultationCache(String(patientId));
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to save consultation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs
    bg-neutral-100 dark:bg-neutral-800
    border border-neutral-200 dark:border-neutral-700
    text-secondary-900 dark:text-white
    placeholder-neutral-400 dark:placeholder-neutral-500
    focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20`;

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700"
      style={{ width: '380px', flexShrink: 0 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white leading-tight">
              New Consultation
            </h2>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              {patientName || 'Patient'} · Virtual
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Success screen ── */}
      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Consultation Saved
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[220px]">
            Added to patient's consultation history.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium
                         text-neutral-600 dark:text-neutral-300
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onIssuePrescription?.()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                color: '#1c1a17',
                boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Issue Prescription
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Body (scrollable) ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {/* Type */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1 block">
                  Type
                </span>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls + ' appearance-none'}>
                  <option value="Medical">Medical</option>
                  <option value="Dental">Dental</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1 block">
                  Mode
                </span>
                <input value="Virtual" disabled className={inputCls + ' opacity-60 cursor-not-allowed'} />
              </div>
            </div>

            {/* ICD Search */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1 block">
                {icdUnavailable ? 'Diagnosis (Manual)' : 'Search ICD'}
              </span>
              {icdUnavailable ? (
                <input
                  value={manualDiagnosis}
                  onChange={(e) => setManualDiagnosis(e.target.value)}
                  placeholder="Enter diagnosis manually"
                  className={inputCls}
                />
              ) : (
                <div className="relative">
                  <input
                    value={icdQuery}
                    onChange={(e) => setIcdQuery(e.target.value)}
                    placeholder="Type ICD code (e.g. CA40) or title"
                    className={inputCls}
                  />
                  {icdLoading && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-neutral-400" />
                  )}
                </div>
              )}
              {icdError && <p className="text-[10px] text-red-500 mt-0.5">{icdError}</p>}

              {/* ICD results dropdown */}
              {!icdLoading && !icdError && icdResults.length > 0 && (
                <div className="mt-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden max-h-32 overflow-y-auto">
                  {icdResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addDiagnosis(item)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors"
                    >
                      <p className="text-[10px] font-semibold text-secondary-800 dark:text-white">{item.code}</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1">{item.title}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected diagnoses */}
              {diagnoses.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {diagnoses.map(d => (
                    <div key={d.id} className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2 border border-neutral-100 dark:border-neutral-700/50">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-secondary-800 dark:text-white">{d.code}</p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-2">{d.title}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select
                            value={d.diagnosisType}
                            onChange={(e) => setDiagnosisType(d.id, e.target.value)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium border appearance-none cursor-pointer ${
                              d.diagnosisType === 'Primary'
                                ? 'bg-primary-500 text-white border-primary-600'
                                : 'bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600'
                            }`}
                          >
                            {DIAGNOSIS_TYPES.map(dt => (
                              <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeDiagnosis(d.id)}
                            className="p-0.5 text-neutral-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        value={d.notes}
                        onChange={(e) => setDiagnosisNotes(d.id, e.target.value)}
                        placeholder="Optional note"
                        className={inputCls + ' mt-1'}
                      />
                    </div>
                  ))}
                </div>
              )}
              {diagnoses.length === 0 && !icdUnavailable && (
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">No ICD diagnosis selected yet.</p>
              )}
            </div>

            {/* Clinical Notes + PE Findings */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1 block">
                  Clinical Notes *
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Consultation notes"
                  className={inputCls + ' resize-none'}
                />
              </div>
              <MultiInput
                label="PE Findings"
                values={peFindings}
                onChange={setPeFindings}
                placeholder="Physical exam finding"
                isTextarea
              />
            </div>

            {/* Chief Complaints + Treatment */}
            <div className="grid grid-cols-2 gap-2">
              <MultiInput
                label="Chief Complaints *"
                values={chiefComplaints}
                onChange={setChiefComplaints}
                placeholder="Main reason"
                isTextarea
              />
              <MultiInput
                label="Treatment / Plan"
                values={treatments}
                onChange={setTreatments}
                placeholder="Medication, advice"
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="line-clamp-2">{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                           text-neutral-600 dark:text-neutral-300
                           hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                           transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  color: '#1c1a17',
                  boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
                }}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
                Save Consultation
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsultationPanel;
