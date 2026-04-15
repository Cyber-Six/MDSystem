import React, { useEffect, useMemo, useState } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import { CODE_TO_ENUM, TOOTH_LAYOUT } from './tooth-chart-constants';
import * as consultationService from '../consultation-service';

const INITIAL_FORM = {
  type: 'Medical',
  mode: 'Onsite',
  diagnosis: '',
  treatments: [''],
  chiefComplaints: [''],
  peFindings: [''],
  notes: '',
  vitalSigns: {
    height_cm: '',
    weight_kg: '',
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    notes: '',
  },
};

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

const GQL_ORAL_FINDING_CATALOGS = `
  query GetOralFindingCatalogs {
    getOralFindingCatalogs { id name }
  }
`;

function ConsultDentalOralFindingsTable({ catalogs, findings, onFindingChange }) {
  if (!catalogs || catalogs.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm border-separate border-spacing-0">
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
          {catalogs.map((catalog, idx) => {
            const value = findings[catalog.id];
            return (
              <tr
                key={catalog.id}
                className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'} hover:bg-primary-50/50 dark:hover:bg-neutral-700/30 transition-colors`}
              >
                <td className="px-3 py-2 text-xs text-secondary-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-700">
                  {catalog.name}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <input
                    type="radio"
                    name={`consult-finding-${catalog.id}`}
                    checked={value === true}
                    onChange={() => onFindingChange(catalog.id, true)}
                    className="w-4 h-4 accent-green-600 dark:accent-green-400 border-neutral-300 dark:border-neutral-500 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <input
                    type="radio"
                    name={`consult-finding-${catalog.id}`}
                    checked={value === false}
                    onChange={() => onFindingChange(catalog.id, false)}
                    className="w-4 h-4 accent-red-600 dark:accent-red-400 border-neutral-300 dark:border-neutral-500 cursor-pointer"
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

function InputField({ label, value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 px-2.5 py-2 text-sm placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300 ${
          disabled
            ? 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-400 cursor-not-allowed'
            : 'bg-white dark:bg-neutral-800 text-secondary-800 dark:text-neutral-200'
        }`}
      />
    </label>
  );
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

function isLikelyCode(value) {
  const trimmed = value.trim();
  // ICD codes must contain at least one number (e.g. A01, CA40, 8A61.41)
  // Plain words like "fever" should NOT match
  return /^[A-Z0-9]{1,3}[\dA-Z.\-]*$/i.test(trimmed) && /\d/.test(trimmed);
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

  // Dental grading state (used when consultation type = Dental)
  const [dentalCatalogs, setDentalCatalogs] = useState([]);
  const [dentalCatalogsLoading, setDentalCatalogsLoading] = useState(false);
  const [dentalToothStates, setDentalToothStates] = useState({});
  const [dentalFindings, setDentalFindings] = useState({});
  const [dentalNotes, setDentalNotes] = useState('');
  const [dentalChartKey, setDentalChartKey] = useState(0);
  const [dentalGradingOpen, setDentalGradingOpen] = useState(false);
  const emptyDentalToothStates = useMemo(() => ({}), []);

  const recentConsultations = useMemo(() => consultations.slice(0, 3), [consultations]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitState.ok) setSubmitState({ ok: false, message: '' });
  };

  // Fetch oral finding catalogs when dental type is selected (lazy load once)
  useEffect(() => {
    if (form.type !== 'Dental') return;
    if (dentalCatalogs.length > 0) return;
    let ignore = false;
    setDentalCatalogsLoading(true);
    axiosRequest
      .post('/staff/emr', { query: GQL_ORAL_FINDING_CATALOGS })
      .then((res) => {
        if (ignore) return;
        const cats = res.data?.data?.getOralFindingCatalogs || [];
        setDentalCatalogs(cats);
        setDentalFindings(Object.fromEntries(cats.map((c) => [c.id, null])));
      })
      .catch(() => {})
      .finally(() => { if (!ignore) setDentalCatalogsLoading(false); });
    return () => { ignore = true; };
  }, [form.type, dentalCatalogs.length]);

  useEffect(() => {
    let ignore = false;

    if (icdServiceUnavailable) {
      setIcdLoading(false);
      return () => {
        ignore = true;
      };
    }

    const query = typeof icdQuery === 'string' ? icdQuery.trim() : '';
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
        let results;
        if (isLikelyCode(query)) {
          results = await consultationService.getIcdViaCodeCached(query);
        } else {
          results = await consultationService.getIcdViaTitleCached(query);
        }

        if (ignore) return;

        const cleaned = (results || []).filter((item) => item?.id && item?.code && item?.title).slice(0, 12);

        if (cleaned.length === 0) {
          setIcdError(`No ICD ${isLikelyCode(query) ? 'code' : 'diagnosis'} found for "${query}". Try a different search term.`);
          setIcdResults([]);
        } else {
          setIcdResults(cleaned);
          setIcdError('');
        }
      } catch (err) {
        if (ignore) return;
        // Only switch to manual mode on actual service errors (500, network issues)
        if (err?.response?.status >= 500 || !err?.response) {
          setIcdError('ICD lookup service is temporarily unavailable. Manual diagnosis entry is enabled.');
          setIcdServiceUnavailable(true);
        } else {
          setIcdError(`Could not find any matching ICD entries. Please try a different search term.`);
        }
        setIcdResults([]);
      } finally {
        if (!ignore) setIcdLoading(false);
      }
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [icdQuery, icdServiceUnavailable]);

  const addDiagnosis = (item) => {
    if (!item?.id || !item?.title) {
      setIcdError('Selected ICD entry is invalid. Please choose a valid diagnosis.');
      return;
    }

    setSelectedDiagnoses((prev) => {
      if (prev.some((entry) => String(entry.id) === String(item.id))) return prev;
      const hasPrimary = prev.some((entry) => entry.diagnosisType === 'Primary');
      const newEntry = {
        id: item.id,
        code: item.code,
        title: item.title,
        diagnosisType: hasPrimary ? 'Secondary' : 'Primary',
        notes: '',
      };
      return [...prev, newEntry];
    });
    setIcdQuery('');
    setIcdResults([]);
    setIcdError('');
  };

  const removeDiagnosis = (id) => {
    setSelectedDiagnoses((prev) => {
      const next = prev.filter((entry) => String(entry.id) !== String(id));
      if (next.length > 0 && !next.some((entry) => entry.diagnosisType === 'Primary')) {
        next[0] = { ...next[0], diagnosisType: 'Primary' };
      }
      return next;
    });
  };

  const setDiagnosisType = (id, diagnosisType) => {
    setSelectedDiagnoses((prev) => {
      // If setting to Primary, change all others to Secondary (or keep their type if not Primary)
      if (diagnosisType === 'Primary') {
        return prev.map((entry) =>
          String(entry.id) === String(id)
            ? { ...entry, diagnosisType: 'Primary' }
            : entry.diagnosisType === 'Primary'
            ? { ...entry, diagnosisType: 'Secondary' }
            : entry
        );
      }
      // For non-Primary types, just update the specific entry
      return prev.map((entry) =>
        String(entry.id) === String(id) ? { ...entry, diagnosisType } : entry
      );
    });
  };

  const setDiagnosisNotes = (id, value) => {
    setSelectedDiagnoses((prev) => prev.map((entry) => (String(entry.id) === String(id) ? { ...entry, notes: value } : entry)));
  };

  const mapToBackendDiagnosis = (entry) => {
    // Use the centralized service function for mapping
    return consultationService.mapToBackendDiagnosis(entry);
  };

  // Update diagnosis field when primary diagnosis changes
  useEffect(() => {
    const primary = selectedDiagnoses.find((entry) => entry.diagnosisType === 'Primary');
    if (primary) {
      setField('diagnosis', `${primary.code} - ${primary.title}`);
    } else if (selectedDiagnoses.length === 0) {
      setField('diagnosis', '');
    }
  }, [selectedDiagnoses]);

  const handleSave = () => {
    const validComplaints = form.chiefComplaints.map(c => c.trim()).filter(Boolean);
    const validTreatments = form.treatments.map(t => t.trim()).filter(Boolean);
    const validPeFindings = form.peFindings.map(p => p.trim()).filter(Boolean);

    if (validComplaints.length === 0 || !form.notes.trim()) {
      setSubmitState({ ok: false, message: 'Please complete at least one chief complaint and notes.' });
      return;
    }

    if (!icdServiceUnavailable && selectedDiagnoses.length === 0) {
      setSubmitState({ ok: false, message: 'Please select at least one ICD diagnosis.' });
      return;
    }

    if (!icdServiceUnavailable && !selectedDiagnoses.some((entry) => entry.diagnosisType === 'Primary')) {
      setSubmitState({ ok: false, message: 'Please select a Primary diagnosis.' });
      return;
    }

    if (typeof onSaveConsultation === 'function') {
      const primary = selectedDiagnoses.find((entry) => entry.diagnosisType === 'Primary') || selectedDiagnoses[0] || null;
      const normalizedDiagnoses = primary
        ? selectedDiagnoses.map((entry) => ({
            id: entry.id,
            code: entry.code,
            title: entry.title,
            diagnosisName: entry.title,
            icdId: Number(entry.id),
            type: entry.diagnosisType,
            notes: entry.notes || '',
            diagnosisType: entry.diagnosisType,
          }))
        : [];

      onSaveConsultation({
        type: form.type,
        diagnosis: primary ? `${primary.code} - ${primary.title}` : (form.diagnosis.trim() || 'General consultation'),
        diagnoses: normalizedDiagnoses,
        treatment: validTreatments.join('; '),
        treatments: validTreatments,
        chiefComplaints: validComplaints,
        notes: form.notes.trim(),
        backendPayload: {
          consultationInput: {
            patientId: String(patient?.id || ''),
            followUpId: null,
            mode: form.mode,
            type: form.type,
            notes: form.notes.trim() || null,
          },
          consultationOutcomeInput: {
            consultationId: null,
            remarks: form.notes.trim() || null,
            complaints: validComplaints,
            peFindings: validPeFindings,
            treatments: validTreatments,
            diagnoses: normalizedDiagnoses.map(mapToBackendDiagnosis),
          },
          vitalSignsData: form.type !== 'Dental' ? (() => {
            const vs = form.vitalSigns;
            const h = parseFloat(vs.height_cm);
            const w = parseFloat(vs.weight_kg);
            const bp = vs.blood_pressure.trim();
            const hr = parseInt(vs.heart_rate, 10);
            const temp = parseFloat(vs.temperature);
            if (!isNaN(h) && !isNaN(w) && bp && !isNaN(hr) && !isNaN(temp)) {
              const result = { height_cm: h, weight_kg: w, blood_pressure: bp, heart_rate: hr, temperature: temp };
              if (vs.notes && vs.notes.trim()) result.notes = vs.notes.trim();
              return result;
            }
            return null;
          })() : null,
          dentalGradingData: form.type === 'Dental' && dentalGradingOpen ? (() => {
            const allTeeth = [
              ...TOOTH_LAYOUT.upper.right, ...TOOTH_LAYOUT.upper.left,
              ...TOOTH_LAYOUT.lower.right, ...TOOTH_LAYOUT.lower.left,
            ];
            const ToothPlacements = allTeeth.map((toothIndex) => {
              const code = dentalToothStates[toothIndex] ?? '✓';
              return { toothIndex, legend: CODE_TO_ENUM[code] ?? 'PRESENT' };
            });
            const oralFindingsInput = dentalCatalogs.map((c) => ({
              oralFindingId: c.id,
              status: dentalFindings[c.id] === true ? 'true' : 'false',
              notes: null,
            }));
            return { notes: dentalNotes.trim() || '', ToothPlacements, oralFindings: oralFindingsInput };
          })() : null,
          patientId: String(patient?.id || ''),
        },
      });
    }

    setForm(INITIAL_FORM);
    setSelectedDiagnoses([]);
    setIcdQuery('');
    setIcdResults([]);
    setIcdError('');
    setDentalToothStates({});
    setDentalFindings(Object.fromEntries(dentalCatalogs.map((c) => [c.id, null])));
    setDentalNotes('');
    setDentalChartKey((k) => k + 1);
    setDentalGradingOpen(false);
    setSubmitState({ ok: true, message: 'Consultation saved. It is now added to Consultation History.' });
  };

  return (
    <div className="space-y-3">
      <PatientSectionCard
        title="New Consultation"
        right={<span className="text-xs text-secondary-400 dark:text-neutral-500">Patient ID: {patient?.id || 'N/A'}</span>}
      >
        <div className="space-y-4">
          {/* ── VITAL SIGNS (Medical) or DENTAL GRADING (Dental) ── */}
          {form.type !== 'Dental' ? (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-green-50 dark:bg-green-900/10">
                <span className="text-sm font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                  Vital Signs
                </span>
                <span className="block text-xs font-normal text-green-600 dark:text-green-500 mt-1">
                  Optional — fill all fields to record
                </span>
              </div>
              <div className="p-3 grid md:grid-cols-5 gap-3">
                <InputField
                  label="Height (cm)"
                  value={form.vitalSigns.height_cm}
                  onChange={(e) => setField('vitalSigns', { ...form.vitalSigns, height_cm: e.target.value })}
                  placeholder="170"
                  type="number"
                />
                <InputField
                  label="Weight (kg)"
                  value={form.vitalSigns.weight_kg}
                  onChange={(e) => setField('vitalSigns', { ...form.vitalSigns, weight_kg: e.target.value })}
                  placeholder="65"
                  type="number"
                />
                <InputField
                  label="Blood Pressure"
                  value={form.vitalSigns.blood_pressure}
                  onChange={(e) => setField('vitalSigns', { ...form.vitalSigns, blood_pressure: e.target.value })}
                  placeholder="120/80"
                />
                <InputField
                  label="Heart Rate (bpm)"
                  value={form.vitalSigns.heart_rate}
                  onChange={(e) => setField('vitalSigns', { ...form.vitalSigns, heart_rate: e.target.value })}
                  placeholder="72"
                  type="number"
                />
                <InputField
                  label="Temperature (°C)"
                  value={form.vitalSigns.temperature}
                  onChange={(e) => setField('vitalSigns', { ...form.vitalSigns, temperature: e.target.value })}
                  placeholder="36.5"
                  type="number"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-900/10 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Dental Grading
                  </span>
                  <span className="block text-xs font-normal text-blue-600 dark:text-blue-500 mt-0.5">
                    Optional — record tooth chart and oral findings
                  </span>
                </div>
                {!dentalGradingOpen ? (
                  <button
                    type="button"
                    onClick={() => setDentalGradingOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Grade
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDentalGradingOpen(false);
                      setDentalToothStates({});
                      setDentalFindings(Object.fromEntries(dentalCatalogs.map((c) => [c.id, null])));
                      setDentalNotes('');
                      setDentalChartKey((k) => k + 1);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="p-4">
                {!dentalGradingOpen ? (
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">
                    Click Grade to open the dental grading form.
                  </p>
                ) : dentalCatalogsLoading ? (
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Loading dental data…</p>
                ) : (
                  <div className="space-y-4">
                    <PatientSectionCard title="Tooth Chart">
                      <ToothChart
                        key={dentalChartKey}
                        initialStates={emptyDentalToothStates}
                        isEditing={true}
                        onStateChange={setDentalToothStates}
                      />
                    </PatientSectionCard>
                    {dentalCatalogs.length > 0 && (
                      <PatientSectionCard title="Oral Findings">
                        <ConsultDentalOralFindingsTable
                          catalogs={dentalCatalogs}
                          findings={dentalFindings}
                          onFindingChange={(id, val) => setDentalFindings((p) => ({ ...p, [id]: val }))}
                        />
                      </PatientSectionCard>
                    )}
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">
                        Dental Notes
                      </span>
                      <textarea
                        rows={2}
                        value={dentalNotes}
                        onChange={(e) => setDentalNotes(e.target.value)}
                        placeholder="Optional dental/clinical notes…"
                        className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Full form: 70/30 split from the very top ── */}
          <div className="flex gap-4">
            {/* Left side (70%): all consultation fields */}
            <div className="grow min-w-0 space-y-4">
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

                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Consultation Mode</span>
                  <select
                    value={form.mode}
                    onChange={(e) => setField('mode', e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="Onsite">Onsite</option>
                    <option value="Virtual">Virtual</option>
                  </select>
                </label>

                <InputField
                  label={icdServiceUnavailable ? 'Diagnosis (Manual Fallback)' : 'Diagnosis System'}
                  value={form.diagnosis}
                  onChange={(e) => {
                    if (icdServiceUnavailable) {
                      setField('diagnosis', e.target.value);
                    }
                  }}
                  placeholder={icdServiceUnavailable ? 'Enter diagnosis manually' : 'Primary diagnosis will appear here'}
                  disabled={!icdServiceUnavailable}
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
                            <select
                              value={entry.diagnosisType}
                              onChange={(e) => setDiagnosisType(entry.id, e.target.value)}
                              className={`px-2 py-1 rounded text-[11px] font-medium border ${
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
                <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Diagnosis you're looking for is unavailable. Manual diagnosis entry is enabled or retry to search for diagnosis again.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIcdServiceUnavailable(false);
                      setIcdError('');
                      setIcdResults([]);
                      setField('diagnosis', '');
                      setIcdQuery('');
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800/70 rounded border border-amber-300 dark:border-amber-600 transition-colors shrink-0"
                  >
                    Retry ICD Search
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <MultiInputField
                    label="Chief Complaints"
                    values={form.chiefComplaints}
                    onChange={(values) => setField('chiefComplaints', values)}
                    placeholder="Main reason for consultation"
                    isTextarea={true}
                  />

                  <MultiInputField
                    label="PE Findings"
                    values={form.peFindings}
                    onChange={(values) => setField('peFindings', values)}
                    placeholder="Physical examination finding"
                    isTextarea={true}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400 mb-1 block">Clinical Notes</span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                      placeholder="Consultation notes"
                      className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </label>

                  <MultiInputField
                    label="Treatment / Plan"
                    values={form.treatments}
                    onChange={(values) => setField('treatments', values)}
                    placeholder="Medication, advice, and follow-up plan"
                    isTextarea={false}
                  />
                </div>
              </div>
            </div>
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