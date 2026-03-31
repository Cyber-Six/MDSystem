import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Loader2, CheckCircle, AlertCircle, ClipboardList, FileText, ChevronRight } from 'lucide-react';
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

const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs
  bg-neutral-100 dark:bg-neutral-800
  border border-neutral-200 dark:border-neutral-700
  text-secondary-900 dark:text-white
  placeholder-neutral-400 dark:placeholder-neutral-500
  focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20`;

const ConsultationPanel = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  onConsultationSaved,
}) => {
  // Form state
  const [type, setType] = useState('Medical');
  const [chiefComplaints, setChiefComplaints] = useState(['']);
  const [peFindings, setPeFindings] = useState(['']);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [treatments, setTreatments] = useState(['']);

  // ICD state
  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdError, setIcdError] = useState('');
  const [icdServiceUnavailable, setIcdServiceUnavailable] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [manualDiagnosis, setManualDiagnosis] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedConsultation, setSavedConsultation] = useState(null);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setType('Medical');
    setChiefComplaints(['']);
    setPeFindings(['']);
    setClinicalNotes('');
    setTreatments(['']);
    setIcdQuery('');
    setIcdResults([]);
    setIcdLoading(false);
    setIcdError('');
    setSelectedDiagnoses([]);
    setManualDiagnosis('');
    setSubmitting(false);
    setError(null);
    setSavedConsultation(null);
  }, [isOpen]);

  // ICD search debounced
  useEffect(() => {
    let ignore = false;
    if (icdServiceUnavailable) { setIcdLoading(false); return () => { ignore = true; }; }

    const query = typeof icdQuery === 'string' ? icdQuery.trim() : '';
    if (query.length < 2) { setIcdResults([]); setIcdError(''); setIcdLoading(false); return () => { ignore = true; }; }

    setIcdLoading(true);
    setIcdError('');

    const timer = setTimeout(async () => {
      try {
        const results = isLikelyCode(query)
          ? await consultationService.getIcdViaCodeCached(query)
          : await consultationService.getIcdViaTitleCached(query);
        if (ignore) return;
        const cleaned = (results || []).filter(i => i?.id && i?.code && i?.title).slice(0, 10);
        if (cleaned.length === 0) {
          setIcdError(`No ICD match for "${query}".`);
          setIcdResults([]);
        } else {
          setIcdResults(cleaned);
          setIcdError('');
        }
      } catch (err) {
        if (ignore) return;
        if (err?.response?.status >= 500 || !err?.response) {
          setIcdError('ICD service unavailable. Manual entry enabled.');
          setIcdServiceUnavailable(true);
        } else {
          setIcdError('No matching ICD entries found.');
        }
        setIcdResults([]);
      } finally {
        if (!ignore) setIcdLoading(false);
      }
    }, 300);

    return () => { ignore = true; clearTimeout(timer); };
  }, [icdQuery, icdServiceUnavailable]);

  const addDiagnosis = (item) => {
    if (!item?.id || !item?.title) return;
    setSelectedDiagnoses(prev => {
      if (prev.some(e => String(e.id) === String(item.id))) return prev;
      const hasPrimary = prev.some(e => e.diagnosisType === 'Primary');
      return [...prev, { id: item.id, code: item.code, title: item.title, diagnosisType: hasPrimary ? 'Secondary' : 'Primary', notes: '' }];
    });
    setIcdQuery('');
    setIcdResults([]);
    setIcdError('');
  };

  const removeDiagnosis = (id) => {
    setSelectedDiagnoses(prev => {
      const next = prev.filter(e => String(e.id) !== String(id));
      if (next.length > 0 && !next.some(e => e.diagnosisType === 'Primary')) {
        next[0] = { ...next[0], diagnosisType: 'Primary' };
      }
      return next;
    });
  };

  const setDiagnosisType = (id, diagType) => {
    setSelectedDiagnoses(prev => {
      if (diagType === 'Primary') {
        return prev.map(e =>
          String(e.id) === String(id) ? { ...e, diagnosisType: 'Primary' }
            : e.diagnosisType === 'Primary' ? { ...e, diagnosisType: 'Secondary' } : e
        );
      }
      return prev.map(e => String(e.id) === String(id) ? { ...e, diagnosisType: diagType } : e);
    });
  };

  // Multi-input helpers
  const addItem = (setter) => setter(prev => [...prev, '']);
  const removeItem = (setter, idx) => setter(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const updateItem = (setter, idx, val) => setter(prev => { const n = [...prev]; n[idx] = val; return n; });

  const handleSave = useCallback(async () => {
    const validComplaints = chiefComplaints.map(c => c.trim()).filter(Boolean);
    const validPeFindings = peFindings.map(p => p.trim()).filter(Boolean);
    const validTreatments = treatments.map(t => t.trim()).filter(Boolean);

    if (validComplaints.length === 0) { setError('Add at least one chief complaint.'); return; }
    if (!icdServiceUnavailable && selectedDiagnoses.length === 0) { setError('Select at least one ICD diagnosis.'); return; }
    if (!clinicalNotes.trim()) { setError('Clinical notes are required.'); return; }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create consultation
      const consultation = await consultationService.createConsultation({
        patientId: String(patientId),
        followUpId: null,
        mode: 'Virtual',
        type,
        notes: clinicalNotes.trim(),
      });

      // 2. Build diagnosis data
      const normalizedDiagnoses = selectedDiagnoses.map(entry =>
        consultationService.mapToBackendDiagnosis(entry)
      );

      // If ICD unavailable, use manual diagnosis
      const diagnosesForBackend = normalizedDiagnoses.length > 0
        ? normalizedDiagnoses
        : (manualDiagnosis.trim() ? [{ outcomeId: "0", diagnosisName: manualDiagnosis.trim(), icdId: 0, diagnosisType: 'Primary', notes: null }] : []);

      // 3. Open consultation with outcome
      await consultationService.openConsultation({
        consultationId: String(consultation.id),
        remarks: clinicalNotes.trim(),
        complaints: validComplaints,
        peFindings: validPeFindings,
        treatments: validTreatments,
        diagnoses: diagnosesForBackend,
      });

      // 4. Submit as Completed
      await consultationService.submitConsultation(String(consultation.id), 'Completed');

      // Build saved data for prescription flow
      const primary = selectedDiagnoses.find(e => e.diagnosisType === 'Primary') || selectedDiagnoses[0];
      const saved = {
        consultationId: consultation.id,
        chiefComplaints: validComplaints,
        peFindings: validPeFindings,
        treatments: validTreatments,
        diagnosis: primary ? `${primary.code} - ${primary.title}` : (manualDiagnosis.trim() || 'General Consultation'),
        diagnoses: selectedDiagnoses,
        clinicalNotes: clinicalNotes.trim(),
      };

      setSavedConsultation(saved);
      onConsultationSaved?.(saved);

    } catch (err) {
      setError(err.message || 'Failed to save consultation.');
    } finally {
      setSubmitting(false);
    }
  }, [patientId, type, chiefComplaints, peFindings, clinicalNotes, treatments, selectedDiagnoses, manualDiagnosis, icdServiceUnavailable, onConsultationSaved]);

  if (!isOpen) return null;

  // Success screen — consultation saved, offer prescription
  if (savedConsultation) {
    return (
      <div
        className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700"
        style={{ width: '400px', flexShrink: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
              <ClipboardList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white">Consultation</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Consultation Saved
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[250px]">
            Consultation has been recorded with all findings and diagnosis.
          </p>

          {/* Summary */}
          <div className="w-full mt-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50 text-xs space-y-1.5">
            <p><span className="font-medium text-neutral-500 dark:text-neutral-400">Diagnosis:</span> <span className="text-secondary-900 dark:text-white">{savedConsultation.diagnosis}</span></p>
            <p><span className="font-medium text-neutral-500 dark:text-neutral-400">Complaints:</span> <span className="text-secondary-900 dark:text-white">{savedConsultation.chiefComplaints.join(', ')}</span></p>
            {savedConsultation.peFindings.length > 0 && (
              <p><span className="font-medium text-neutral-500 dark:text-neutral-400">PE Findings:</span> <span className="text-secondary-900 dark:text-white">{savedConsultation.peFindings.join(', ')}</span></p>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full mt-3">
            <button
              onClick={() => onConsultationSaved?.({ ...savedConsultation, _openPrescription: true })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                color: '#1c1a17',
                boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Issue Prescription
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Done (No Prescription)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700"
      style={{ width: '400px', flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <ClipboardList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white leading-tight">
              Virtual Consultation
            </h2>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              {patientName || 'Patient'} — {type}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>

        {/* Consultation Type */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">Type</p>
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls + ' appearance-none'}>
            <option value="Medical">Medical</option>
            <option value="Dental">Dental</option>
          </select>
        </div>

        {/* Chief Complaints */}
        <MultiField
          label="Chief Complaints"
          values={chiefComplaints}
          placeholder="Main reason for consultation"
          onAdd={() => addItem(setChiefComplaints)}
          onRemove={(i) => removeItem(setChiefComplaints, i)}
          onChange={(i, v) => updateItem(setChiefComplaints, i, v)}
          isTextarea
        />

        {/* PE Findings */}
        <MultiField
          label="PE Findings"
          values={peFindings}
          placeholder="Physical examination finding"
          onAdd={() => addItem(setPeFindings)}
          onRemove={(i) => removeItem(setPeFindings, i)}
          onChange={(i, v) => updateItem(setPeFindings, i, v)}
          isTextarea
        />

        {/* ICD Diagnosis Search */}
        {!icdServiceUnavailable ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
              Search ICD Diagnosis
            </p>
            <input
              type="text"
              value={icdQuery}
              onChange={e => setIcdQuery(e.target.value)}
              placeholder="Type ICD code (e.g. CA40) or title (e.g. fever)"
              className={inputCls}
            />

            {/* Results dropdown */}
            {(icdLoading || icdError || icdResults.length > 0) && (
              <div className="mt-1 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                {icdLoading && <p className="px-3 py-2 text-[10px] text-neutral-500">Searching…</p>}
                {icdError && <p className="px-3 py-2 text-[10px] text-red-500">{icdError}</p>}
                {!icdLoading && !icdError && icdResults.length > 0 && (
                  <ul className="max-h-40 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-700/60">
                    {icdResults.map(item => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => addDiagnosis(item)}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors"
                        >
                          <p className="text-[10px] font-bold text-secondary-800 dark:text-white">{item.code}</p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1">{item.title}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Selected diagnoses */}
            <div className="mt-2 space-y-1.5">
              {selectedDiagnoses.length === 0 ? (
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">No diagnosis selected.</p>
              ) : selectedDiagnoses.map(entry => (
                <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-secondary-800 dark:text-white truncate">{entry.code} — {entry.title}</p>
                  </div>
                  <select
                    value={entry.diagnosisType}
                    onChange={e => setDiagnosisType(entry.id, e.target.value)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                      entry.diagnosisType === 'Primary'
                        ? 'bg-primary-500 text-white border-primary-600'
                        : 'bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {DIAGNOSIS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button
                    onClick={() => removeDiagnosis(entry.id)}
                    className="text-[9px] font-medium text-red-500 hover:text-red-700 px-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
              Diagnosis (Manual)
            </p>
            <input
              value={manualDiagnosis}
              onChange={e => setManualDiagnosis(e.target.value)}
              placeholder="Enter diagnosis manually"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => { setIcdServiceUnavailable(false); setIcdError(''); setIcdResults([]); setIcdQuery(''); }}
              className="mt-1 text-[9px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              Retry ICD Search
            </button>
          </div>
        )}

        {/* Clinical Notes */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
            Clinical Notes
          </p>
          <textarea
            value={clinicalNotes}
            onChange={e => setClinicalNotes(e.target.value)}
            placeholder="Consultation notes and remarks"
            rows={3}
            className={inputCls + ' resize-none'}
            style={{ scrollbarWidth: 'none' }}
          />
        </div>

        {/* Treatment / Plan */}
        <MultiField
          label="Treatment / Plan"
          values={treatments}
          placeholder="Treatment or medication plan"
          onAdd={() => addItem(setTreatments)}
          onRemove={(i) => removeItem(setTreatments, i)}
          onChange={(i, v) => updateItem(setTreatments, i, v)}
        />
      </div>

      {/* Footer */}
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
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={!submitting ? {
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            } : { background: '#e8e5e0', color: '#a19b93' }}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Save Consultation
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable multi-input field component
function MultiField({ label, values, placeholder, onAdd, onRemove, onChange, isTextarea = false }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{label}</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-0.5 text-[9px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-1.5">
        {values.map((val, idx) => (
          <div key={idx} className="flex gap-1.5">
            {isTextarea ? (
              <textarea
                rows={2}
                value={val}
                onChange={e => onChange(idx, e.target.value)}
                placeholder={`${placeholder}${values.length > 1 ? ` #${idx + 1}` : ''}`}
                className={inputCls + ' flex-1 resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            ) : (
              <input
                type="text"
                value={val}
                onChange={e => onChange(idx, e.target.value)}
                placeholder={`${placeholder}${values.length > 1 ? ` #${idx + 1}` : ''}`}
                className={inputCls + ' flex-1'}
              />
            )}
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="px-1.5 text-[9px] font-medium text-red-500 hover:text-red-700 shrink-0 self-start mt-1.5"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConsultationPanel;
