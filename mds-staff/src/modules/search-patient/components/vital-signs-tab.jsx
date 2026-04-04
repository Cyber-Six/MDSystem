import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

/* ─── GraphQL ─────────────────────────────────────────────── */

const GQL_GET_VITAL_SIGNS = `
  query GetPatientVitalSigns($patientId: ID!) {
    getPatientVitalSigns(patientId: $patientId, limit: 50) {
      id height_cm weight_kg blood_pressure heart_rate temperature notes created_at
    }
  }
`;

const GQL_CREATE_VITAL_SIGNS = `
  mutation CreateVitalSigns($patientId: ID!, $input: VitalSignsInput!) {
    createVitalSigns(patientId: $patientId, input: $input) {
      id height_cm weight_kg blood_pressure heart_rate temperature notes created_at
    }
  }
`;

/* ─── Helpers ─────────────────────────────────────────────── */

function fmtDateTime(dateStr) {
  if (!dateStr) return { date: 'Unknown date', time: '' };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
  };
}

/* ─── Sub-components ──────────────────────────────────────── */

function InputField({ label, value, onChange, placeholder, type = 'text', step }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
    </label>
  );
}

function VitalGrid({ record }) {
  const bmi = record.height_cm && record.weight_kg
    ? (record.weight_kg / ((record.height_cm / 100) ** 2)).toFixed(1)
    : null;
  const items = [
    { label: 'Height',      value: record.height_cm      ? `${record.height_cm} cm`   : null },
    { label: 'Weight',      value: record.weight_kg      ? `${record.weight_kg} kg`   : null },
    { label: 'BMI',         value: bmi },
    { label: 'Blood Press', value: record.blood_pressure || null },
    { label: 'Heart Rate',  value: record.heart_rate     ? `${record.heart_rate} bpm` : null },
    { label: 'Temp',        value: record.temperature    ? `${record.temperature} °C` : null },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-neutral-200 dark:divide-neutral-700 -mx-3 border-t border-neutral-100 dark:border-neutral-700/60">
      {items.map(({ label, value }) => (
        <div key={label} className="px-3 py-3 text-center">
          <p className="text-[11px] text-secondary-400 dark:text-neutral-500 leading-none mb-1.5">{label}</p>
          {value
            ? <p className="text-base font-semibold text-secondary-800 dark:text-white leading-none">{value}</p>
            : <p className="text-sm text-secondary-300 dark:text-neutral-600">—</p>
          }
        </div>
      ))}
    </div>
  );
}

function HistoryBlock({ index, isCurrent, record }) {
  const [open, setOpen] = useState(isCurrent);
  const { date, time } = fmtDateTime(record.created_at);

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isCurrent && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 uppercase">
              Current
            </span>
          )}
          <span className="text-sm font-semibold text-secondary-800 dark:text-white">{date}</span>
          {time && <span className="text-xs text-secondary-400 dark:text-neutral-500">{time}</span>}
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <VitalGrid record={record} />
          {record.notes && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-secondary-700 dark:text-neutral-300">{record.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Analytics Component ─────────────────────────────────── */

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
  color: '#e5e7eb',
};
const AXIS_STYLE = { fontSize: 11, fill: '#9ca3af' };
const GRID_STYLE = { stroke: '#374151', strokeDasharray: '3 3' };
const CHART_MARGIN = { top: 8, right: 12, left: -16, bottom: 4 };

function MiniLineChart({ data, dataKeys, colors, height = 150 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="label" tick={AXIS_STYLE} interval="preserveStartEnd" />
        <YAxis tick={AXIS_STYLE} width={36} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
        {dataKeys.map(({ key, name, color }, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color || colors?.[i] || '#f59e0b'}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name={name || key}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function VitalSignsAnalytics({ history }) {
  const chartData = useMemo(() => {
    return [...history].reverse().map((r) => {
      const bmi =
        r.height_cm && r.weight_kg
          ? parseFloat((r.weight_kg / ((r.height_cm / 100) ** 2)).toFixed(1))
          : null;
      const bpParts = r.blood_pressure ? r.blood_pressure.split('/') : [];
      const systolic = bpParts[0] ? parseInt(bpParts[0], 10) : null;
      const diastolic = bpParts[1] ? parseInt(bpParts[1], 10) : null;
      const d = new Date(r.created_at);
      const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      return {
        label,
        weight: r.weight_kg ? parseFloat(r.weight_kg) : null,
        bmi,
        systolic,
        diastolic,
        heartRate: r.heart_rate ? parseInt(r.heart_rate, 10) : null,
      };
    });
  }, [history]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm text-center text-secondary-400 dark:text-neutral-500">
          At least 2 vital sign entries are needed to display trends.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Weight */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-neutral-500 mb-2">
          Weight (kg)
        </p>
        <MiniLineChart
          data={chartData}
          dataKeys={[{ key: 'weight', name: 'Weight (kg)', color: '#f59e0b' }]}
        />
      </div>

      {/* BMI */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-neutral-500 mb-2">
          BMI
        </p>
        <MiniLineChart
          data={chartData}
          dataKeys={[{ key: 'bmi', name: 'BMI', color: '#60a5fa' }]}
        />
      </div>

      {/* Blood Pressure */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-neutral-500 mb-2">
          Blood Pressure (mmHg)
        </p>
        <MiniLineChart
          data={chartData}
          dataKeys={[
            { key: 'systolic', name: 'Systolic', color: '#f87171' },
            { key: 'diastolic', name: 'Diastolic', color: '#fb923c' },
          ]}
        />
      </div>

      {/* Heart Rate */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-neutral-500 mb-2">
          Heart Rate (bpm)
        </p>
        <MiniLineChart
          data={chartData}
          dataKeys={[{ key: 'heartRate', name: 'Heart Rate (bpm)', color: '#34d399' }]}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

const INITIAL_FORM = {
  height_cm: '',
  weight_kg: '',
  blood_pressure: '',
  heart_rate: '',
  temperature: '',
  notes: '',
};

export default function VitalSignsTab({ patient }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchHistory = useCallback(() => {
    if (!patient?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    axiosRequest.post('/staff/emr', {
      query: GQL_GET_VITAL_SIGNS,
      variables: { patientId: patient.id },
    })
      .then((res) => {
        setHistory(res.data?.data?.getPatientVitalSigns || []);
      })
      .catch((err) => {
        setLoadError(err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to load vital signs.');
      })
      .finally(() => setLoading(false));
  }, [patient?.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const input = {
      height_cm: parseFloat(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
      blood_pressure: form.blood_pressure.trim(),
      heart_rate: parseInt(form.heart_rate, 10),
      temperature: parseFloat(form.temperature),
      notes: form.notes.trim() || null,
    };

    // Basic validation
    if (isNaN(input.height_cm) || isNaN(input.weight_kg) || !input.blood_pressure || isNaN(input.heart_rate) || isNaN(input.temperature)) {
      setSaving(false);
      setSaveError('Please fill in all required fields with valid numbers.');
      return;
    }

    try {
      await axiosRequest.post('/staff/emr', {
        query: GQL_CREATE_VITAL_SIGNS,
        variables: { patientId: patient.id, input },
      });
      setSaveSuccess(true);
      setForm(INITIAL_FORM);
      fetchHistory();
    } catch (err) {
      setSaveError(err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to create vital signs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Create Vital Signs form ── */}
      <PatientSectionCard title="Create Vital Signs">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InputField label="Height (cm) *" value={form.height_cm} onChange={handleChange('height_cm')} placeholder="e.g. 170" type="number" step="0.1" />
            <InputField label="Weight (kg) *" value={form.weight_kg} onChange={handleChange('weight_kg')} placeholder="e.g. 65" type="number" step="0.1" />
            <InputField label="Blood Pressure *" value={form.blood_pressure} onChange={handleChange('blood_pressure')} placeholder="e.g. 120/80" />
            <InputField label="Heart Rate (bpm) *" value={form.heart_rate} onChange={handleChange('heart_rate')} placeholder="e.g. 72" type="number" />
            <InputField label="Temperature (°C) *" value={form.temperature} onChange={handleChange('temperature')} placeholder="e.g. 36.5" type="number" step="0.1" />
          </div>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Optional notes..."
              className="mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>

          {saveError && (
            <div className="px-3 py-2 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div className="px-3 py-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
              Vital signs recorded successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Vital Signs'}
            </button>
          </div>
        </form>
      </PatientSectionCard>

      {/* ── Analytics + History side-by-side ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Analytics — 50% */}
        <PatientSectionCard title="Vital Signs Analytics">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="animate-spin w-5 h-5 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading…</span>
            </div>
          ) : loadError ? null : (
            <VitalSignsAnalytics history={history} />
          )}
        </PatientSectionCard>

        {/* History — 50% */}
        <PatientSectionCard title="Vital Signs History">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin w-6 h-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading vital signs…</span>
            </div>
          ) : loadError ? (
            <div className="px-3 py-4 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
              {loadError}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-secondary-400 dark:text-neutral-500">No vital signs recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((record, i) => (
                <HistoryBlock key={record.id} index={i} isCurrent={i === 0} record={record} />
              ))}
            </div>
          )}
        </PatientSectionCard>
      </div>
    </div>
  );
}
