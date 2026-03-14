import React, { useEffect, useMemo, useState } from 'react';
import PatientSectionCard from './patient-section-card';
import { axiosRequest } from '../../../packages-core-adapter';

const INITIAL_FORM = {
  type: 'Medical',
  doctor: '',
  diagnosis: '',
  treatment: '',
  chiefComplaint: '',
  notes: '',
  height: '',
  weight: '',
  bmi: '',
  bp: '',
  heartRate: '',
  temp: '',
};

function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
    </label>
  );
}

function isLikelyCode(value) {
  return /^[A-Za-z][A-Za-z0-9.\-]*$/.test(value.trim());
}

function codeFromDiagnosis(item) {
  return item?.code || item?.icdCode || item?.icd?.code || '';
}

function titleFromDiagnosis(item) {
  return item?.title || item?.diagnosisName || item?.diagnosis || '';
}

export default function PatientConsultationTab({ patient, consultations = [], onSaveConsultation }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdError, setIcdError] = useState('');
  const [icdServiceUnavailable, setIcdServiceUnavailable] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [submitState, setSubmitState] = useState({ ok: false, message: '' });

  const recentConsultations = useMemo(() => consultations.slice(0, 3), [consultations]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitState.ok) setSubmitState({ ok: false, message: '' });
  };

  useEffect(() => {
    let ignore = false;
    const query = icdQuery.trim();

    if (icdServiceUnavailable) {
      setIcdLoading(false);
      return () => {
        ignore = true;
      };
    }

    if (query.length < 2) {
      setIcdResults([]);
      setIcdError('');
      setIcdLoading(false);
      return () => {
        ignore = true;
      };
    }

    setIcdLoading(true);
    setIcdError('');

    const timer = setTimeout(async () => {
      try {
        const gql = isLikelyCode(query)
          ? {
              query: `
                query SearchIcdByCode($code: String!) {
                  getIcdViaCode(code: $code) {
                    id
                    code
                    title
                  }
                }
              `,
              variables: { code: query },
            }
          : {
              query: `
                query SearchIcdByTitle($title: String!) {
                  getIcdViaTitle(title: $title) {
                    id
                    code
                    title
                  }
                }
              `,
              variables: { title: query },
            };

        const { data } = await axiosRequest.post('/consultation', gql);
        if (ignore) return;

        const raw = data?.data?.getIcdViaCode || data?.data?.getIcdViaTitle || [];
        const cleaned = raw.filter((item) => item?.id && item?.code && item?.title).slice(0, 12);
        setIcdResults(cleaned);
      } catch (err) {
        if (ignore) return;
        setIcdError('ICD lookup is temporarily unavailable. You can still enter diagnosis manually.');
        setIcdServiceUnavailable(true);
        setIcdResults([]);
      } finally {
        if (!ignore) setIcdLoading(false);
      }
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [icdQuery]);

  const addDiagnosis = (item) => {
    setSelectedDiagnoses((prev) => {
      if (prev.some((entry) => String(entry.id) === String(item.id))) return prev;
      return [
        ...prev,
        {
          id: item.id,
          code: item.code,
          title: item.title,
          isPrimary: prev.length === 0,
          notes: '',
        },
      ];
    });
    setIcdQuery('');
    setIcdResults([]);
    setIcdError('');
  };

  const removeDiagnosis = (id) => {
    setSelectedDiagnoses((prev) => {
      const next = prev.filter((entry) => String(entry.id) !== String(id));
      if (next.length > 0 && !next.some((entry) => entry.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const setPrimaryDiagnosis = (id) => {
    setSelectedDiagnoses((prev) => prev.map((entry) => ({ ...entry, isPrimary: String(entry.id) === String(id) })));
  };

  const setDiagnosisNotes = (id, value) => {
    setSelectedDiagnoses((prev) => prev.map((entry) => (String(entry.id) === String(id) ? { ...entry, notes: value } : entry)));
  };

  const handleSave = () => {
    if (!form.chiefComplaint.trim() || !form.notes.trim()) {
      setSubmitState({ ok: false, message: 'Please complete chief complaint and notes.' });
      return;
    }

    if (!icdServiceUnavailable && selectedDiagnoses.length === 0) {
      setSubmitState({ ok: false, message: 'Please select at least one ICD diagnosis.' });
      return;
    }

    if (!icdServiceUnavailable && !selectedDiagnoses.some((entry) => entry.isPrimary)) {
      setSubmitState({ ok: false, message: 'Please mark one diagnosis as primary.' });
      return;
    }

    if (typeof onSaveConsultation === 'function') {
      const primary = selectedDiagnoses.find((entry) => entry.isPrimary) || selectedDiagnoses[0] || null;
      onSaveConsultation({
        type: form.type,
        doctor: form.doctor,
        diagnosis: primary ? `${primary.code} - ${primary.title}` : (form.diagnosis.trim() || 'General consultation'),
        diagnoses: primary ? selectedDiagnoses.map((entry) => ({
          id: entry.id,
          code: entry.code,
          title: entry.title,
          diagnosisName: entry.title,
          icdId: Number(entry.id),
          diagnosisType: entry.isPrimary ? 'Primary' : 'Secondary',
          notes: entry.notes || '',
          isPrimary: entry.isPrimary,
        })) : [],
        treatment: form.treatment,
        notes: `${form.chiefComplaint.trim()}${form.notes.trim() ? ` | ${form.notes.trim()}` : ''}`,
        vitalSigns: {
          height: form.height,
          weight: form.weight,
          bmi: form.bmi,
          bp: form.bp,
          heartRate: form.heartRate,
          temp: form.temp,
        },
      });
    }

    setForm(INITIAL_FORM);
    setSelectedDiagnoses([]);
    setIcdQuery('');
    setIcdResults([]);
    setIcdError('');
    setSubmitState({ ok: true, message: 'Consultation saved. It is now added to Consultation History.' });
  };

  return (
    <div className="space-y-3">
      <PatientSectionCard
        title="New Consultation"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">Patient ID: {patient?.id || 'N/A'}</span>}
      >
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Consultation Type</span>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="Medical">Medical</option>
                <option value="Dental">Dental</option>
              </select>
            </label>

            <InputField
              label="Attending Doctor"
              value={form.doctor}
              onChange={(e) => setField('doctor', e.target.value)}
              placeholder="e.g. Dr. Dela Cruz"
            />

            <InputField
              label={icdServiceUnavailable ? 'Diagnosis (Manual Fallback)' : 'Diagnosis System'}
              value={form.diagnosis}
              onChange={(e) => setField('diagnosis', e.target.value)}
              placeholder={icdServiceUnavailable ? 'Enter diagnosis manually' : 'Used only if ICD lookup is unavailable'}
            />
          </div>

          {!icdServiceUnavailable && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Search ICD</span>
              <input
                type="text"
                value={icdQuery}
                onChange={(e) => setIcdQuery(e.target.value)}
                placeholder="Type ICD code (e.g. CA40) or title (e.g. fever)"
                className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>

            {(icdLoading || icdError || icdResults.length > 0) && (
              <div className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                {icdLoading && <p className="px-3 py-2 text-xs text-secondary-500 dark:text-neutral-400">Searching ICD entries...</p>}
                {icdError && <p className="px-3 py-2 text-xs text-error-600 dark:text-error-400">{icdError}</p>}
                {!icdLoading && !icdError && icdResults.length > 0 && (
                  <ul className="max-h-52 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-700/60">
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

            <div className="space-y-2">
              {selectedDiagnoses.length === 0 ? (
                <p className="text-xs text-secondary-400 dark:text-neutral-500">No ICD diagnosis selected yet.</p>
              ) : (
                selectedDiagnoses.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-secondary-800 dark:text-white">{entry.code}</p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 break-words">{entry.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPrimaryDiagnosis(entry.id)}
                          className={`px-2 py-1 rounded text-[11px] font-medium ${entry.isPrimary ? 'bg-primary-500 text-white' : 'bg-neutral-200 dark:bg-neutral-600 text-secondary-700 dark:text-neutral-200'}`}
                        >
                          {entry.isPrimary ? 'Primary' : 'Set Primary'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDiagnosis(entry.id)}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={entry.notes}
                      onChange={(e) => setDiagnosisNotes(entry.id, e.target.value)}
                      placeholder="Optional diagnosis note"
                      className="mt-2 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {icdServiceUnavailable && (
            <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ICD lookup endpoint returned an error. Manual diagnosis entry is enabled for now.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Chief Complaint</span>
              <textarea
                rows={3}
                value={form.chiefComplaint}
                onChange={(e) => setField('chiefComplaint', e.target.value)}
                placeholder="Main reason for consultation"
                className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Clinical Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Consultation notes"
                className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>
          </div>

          <InputField
            label="Treatment / Plan"
            value={form.treatment}
            onChange={(e) => setField('treatment', e.target.value)}
            placeholder="Medication, advice, and follow-up plan"
          />
        </div>
      </PatientSectionCard>

      <PatientSectionCard title="Vital Signs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <InputField label="Height (cm)" value={form.height} onChange={(e) => setField('height', e.target.value)} placeholder="170" />
          <InputField label="Weight (kg)" value={form.weight} onChange={(e) => setField('weight', e.target.value)} placeholder="65" />
          <InputField label="BMI" value={form.bmi} onChange={(e) => setField('bmi', e.target.value)} placeholder="22.5" />
          <InputField label="Blood Press" value={form.bp} onChange={(e) => setField('bp', e.target.value)} placeholder="120/80" />
          <InputField label="Heart Rate" value={form.heartRate} onChange={(e) => setField('heartRate', e.target.value)} placeholder="80" />
          <InputField label="Temp" value={form.temp} onChange={(e) => setField('temp', e.target.value)} placeholder="36.8" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-xs ${submitState.ok ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {submitState.message || 'Fill out required details and save consultation.'}
          </p>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
          >
            Save Consultation
          </button>
        </div>
      </PatientSectionCard>

      <PatientSectionCard
        title="Recent Consultation Entries"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">{consultations.length} total</span>}
      >
        {recentConsultations.length === 0 ? (
          <p className="text-xs text-secondary-300 dark:text-neutral-600">No consultation records yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
            {recentConsultations.map((item, idx) => (
              <div key={idx} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-secondary-800 dark:text-white">{item.diagnosis || titleFromDiagnosis(item?.diagnoses?.[0]) || 'No diagnosis'}</p>
                  <span className="text-[11px] text-secondary-400 dark:text-neutral-500">{item.date || '-'}{item.time ? ` · ${item.time}` : ''}</span>
                </div>
                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">{item.doctor || 'No doctor assigned'}</p>
                {Array.isArray(item.diagnoses) && item.diagnoses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.diagnoses.slice(0, 3).map((dx, dxIdx) => (
                      <span key={dx.id || dxIdx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300">
                        {codeFromDiagnosis(dx)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PatientSectionCard>
    </div>
  );
}