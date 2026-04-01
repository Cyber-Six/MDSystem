import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import { CODE_TO_ENUM, ENUM_TO_CODE, TOOTH_LAYOUT } from './tooth-chart-constants';

/* ─── GraphQL ─────────────────────────────────────────────── */

const GQL_GET_DENTAL_RECORDS = `
  query GetPatientDentalRecords($patientId: ID!) {
    getPatientDentalRecord(patientId: $patientId, limit: 50) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
    }
    getOralFindingCatalogs { id name }
  }
`;

const GQL_CREATE_DENTAL_RECORD = `
  mutation CreateDentalRecord($patientId: ID!, $input: DentalRecordInput!) {
    createDentalRecord(patientId: $patientId, input: $input) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
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

function buildInitialFindings(catalogs) {
  const map = {};
  (catalogs || []).forEach((c) => { map[c.id] = null; });
  return map;
}

/* ─── Oral Findings Table ──────────────────────────────────── */

function OralFindingsTable({ catalogs, findings, onFindingChange, readOnly = false }) {
  if (!catalogs || catalogs.length === 0) {
    return (
      <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">
        No oral finding catalog available.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto -mx-3 -mb-3">
      <table className="w-full text-sm">
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
                  {readOnly ? (
                    <div className="flex justify-center items-center">
                      <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === true || value === 'true' || value === 'yes' ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                        {(value === true || value === 'true' || value === 'yes') && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="radio"
                      name={`grading-finding-${catalog.id}`}
                      checked={value === true}
                      onChange={() => onFindingChange(catalog.id, true)}
                      className="w-4 h-4 text-green-600 border-neutral-300 dark:border-neutral-500 focus:ring-green-500 dark:bg-neutral-700 cursor-pointer"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  {readOnly ? (
                    <div className="flex justify-center items-center">
                      <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === false || value === 'false' || value === 'no' ? 'border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                        {(value === false || value === 'false' || value === 'no') && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="radio"
                      name={`grading-finding-${catalog.id}`}
                      checked={value === false}
                      onChange={() => onFindingChange(catalog.id, false)}
                      className="w-4 h-4 text-red-600 border-neutral-300 dark:border-neutral-500 focus:ring-red-500 dark:bg-neutral-700 cursor-pointer"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Read-only History Entry ──────────────────────────────── */

function GradingHistoryEntry({ index, record, catalogs }) {
  const [open, setOpen] = useState(index === 0);
  const { date, time } = fmtDateTime(record.created_at);

  const toothStates = useMemo(() => {
    const states = {};
    (record.ToothPlacements || []).forEach((tp) => {
      states[tp.toothIndex] = ENUM_TO_CODE[tp.legend] ?? tp.legend;
    });
    return states;
  }, [record]);

  const oralFindings = useMemo(() => {
    const map = {};
    (record.oralFindings || []).forEach((f) => {
      const raw = f.status;
      map[f.oralFindingId] =
        raw === true || raw === 'true' || raw === 'yes' ? true
          : raw === false || raw === 'false' || raw === 'no' ? false
          : null;
    });
    return map;
  }, [record]);

  const conditionCount = Object.values(toothStates).filter((s) => s !== '✓').length;
  const positiveCount = Object.values(oralFindings).filter((v) => v === true).length;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {index === 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 uppercase">
              Latest
            </span>
          )}
          <span className="text-sm font-semibold text-secondary-800 dark:text-white">{date}</span>
          {time && <span className="text-xs text-secondary-400 dark:text-neutral-500">{time}</span>}
          {conditionCount > 0 && (
            <span className="text-[11px] text-warning-600 dark:text-warning-400 font-medium">
              · {conditionCount} tooth condition{conditionCount !== 1 ? 's' : ''}
            </span>
          )}
          {positiveCount > 0 && (
            <span className="text-[11px] text-error-600 dark:text-error-400">
              · {positiveCount} positive finding{positiveCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-white dark:bg-neutral-800">
          <PatientSectionCard title="Tooth Chart">
            <ToothChart initialStates={toothStates} isEditing={false} />
          </PatientSectionCard>

          {catalogs.length > 0 && (
            <PatientSectionCard
              title="Oral Findings"
              right={
                positiveCount > 0
                  ? <span className="text-[11px] text-error-500 dark:text-error-400">{positiveCount} positive finding{positiveCount !== 1 ? 's' : ''}</span>
                  : null
              }
            >
              <OralFindingsTable
                catalogs={catalogs}
                findings={oralFindings}
                readOnly
              />
            </PatientSectionCard>
          )}

          {record.notes && (
            <div>
              <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-secondary-700 dark:text-neutral-300">{record.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function DentalGradingTab({ patient }) {
  const [catalogs, setCatalogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Grading mode state (mirrors dental-record-tab pattern)
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gradeError, setGradeError] = useState(null);
  const [gradeSuccess, setGradeSuccess] = useState(false);

  // Form state (only active while grading)
  const [chartKey, setChartKey] = useState(0);
  const [toothStates, setToothStates] = useState({});
  const [findings, setFindings] = useState({});
  const [notes, setNotes] = useState('');

  // Stable empty object — must NOT be inline `{}` or ToothChart's useEffect
  // will see a new reference on every render and reset the tooth states.
  const emptyToothStates = useMemo(() => ({}), []);

  const fetchData = useCallback(() => {
    if (!patient?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    axiosRequest
      .post('/staff/emr', {
        query: GQL_GET_DENTAL_RECORDS,
        variables: { patientId: patient.id },
      })
      .then((res) => {
        const data = res.data?.data || {};
        const cats = data.getOralFindingCatalogs || [];
        setCatalogs(cats);
        setHistory(data.getPatientDentalRecord || []);
        setFindings(buildInitialFindings(cats));
      })
      .catch((err) => {
        setLoadError(
          err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to load dental records.'
        );
      })
      .finally(() => setLoading(false));
  }, [patient?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFindingChange = (catalogId, value) => {
    setFindings((prev) => ({ ...prev, [catalogId]: value }));
  };

  const handleToothStateChange = (states) => {
    setToothStates(states);
  };

  const handleGradeStart = () => {
    setGradeError(null);
    setGradeSuccess(false);
    setToothStates({});
    setFindings(buildInitialFindings(catalogs));
    setNotes('');
    setIsGrading(true);
  };

  const handleGradeCancel = () => {
    setChartKey((k) => k + 1);
    setToothStates({});
    setFindings(buildInitialFindings(catalogs));
    setNotes('');
    setIsGrading(false);
    setGradeError(null);
  };

  const handleGradeSave = async () => {
    setIsSaving(true);
    setGradeError(null);
    try {
      const allTeeth = [
        ...TOOTH_LAYOUT.upper.right, ...TOOTH_LAYOUT.upper.left,
        ...TOOTH_LAYOUT.lower.right, ...TOOTH_LAYOUT.lower.left,
      ];
      const ToothPlacements = allTeeth.map((toothIndex) => {
        const code = toothStates[toothIndex] ?? '✓';
        return { toothIndex, legend: CODE_TO_ENUM[code] ?? 'PRESENT' };
      });

      const oralFindingsInput = catalogs.map((c) => ({
        oralFindingId: c.id,
        status: findings[c.id] === true ? 'true' : 'false',
        notes: null,
      }));

      await axiosRequest.post('/staff/emr', {
        query: GQL_CREATE_DENTAL_RECORD,
        variables: {
          patientId: patient.id,
          input: {
            notes: notes.trim() || '',
            ToothPlacements,
            oralFindings: oralFindingsInput,
          },
        },
      });

      setGradeSuccess(true);
      setIsGrading(false);
      setChartKey((k) => k + 1);
      setToothStates({});
      setNotes('');
      fetchData();
    } catch (err) {
      setGradeError(
        err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to save dental grading.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const conditionsCount = Object.values(toothStates).filter((s) => s !== '✓').length;
  const positiveCount = Object.values(findings).filter((v) => v === true).length;

  return (
    <div className="space-y-4">
      {/* ── Tooth Chart with Grade button ── */}
      <PatientSectionCard
        title="Tooth Chart"
        right={
          <div className="flex items-center gap-2">
            {conditionsCount > 0 && !isGrading && (
              <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
                {conditionsCount} condition{conditionsCount !== 1 ? 's' : ''} marked
              </span>
            )}
            {!isGrading ? (
              <button
                onClick={handleGradeStart}
                className="px-3 py-1.5 text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Grade
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGradeCancel}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGradeSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-success-500 hover:bg-success-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Save Grade
                </button>
              </div>
            )}
          </div>
        }
      >
        {gradeError && (
          <div className="mb-3 px-3 py-2 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-xs text-error-700 dark:text-error-400">
            {gradeError}
          </div>
        )}
        {gradeSuccess && (
          <div className="mb-3 px-3 py-2 rounded-md bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 text-xs text-success-700 dark:text-success-400">
            Dental grading recorded successfully.
          </div>
        )}
        <ToothChart
          key={chartKey}
          initialStates={emptyToothStates}
          isEditing={isGrading}
          onStateChange={handleToothStateChange}
        />
      </PatientSectionCard>

      {/* ── Oral Findings ── */}
      {catalogs.length > 0 && (
        <PatientSectionCard
          title="Oral Findings"
          right={
            positiveCount > 0 && !isGrading ? (
              <span className="text-[10px] text-secondary-500 dark:text-neutral-500">
                {positiveCount} positive finding{positiveCount !== 1 ? 's' : ''}
              </span>
            ) : isGrading ? (
              <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">Grading mode</span>
            ) : null
          }
        >
          <OralFindingsTable
            catalogs={catalogs}
            findings={findings}
            onFindingChange={isGrading ? handleFindingChange : undefined}
            readOnly={!isGrading}
          />
        </PatientSectionCard>
      )}

      {/* ── Notes (visible only while grading) ── */}
      {isGrading && (
        <PatientSectionCard title="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional clinical notes…"
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </PatientSectionCard>
      )}

      {/* ── Dental Grading History ── */}
      <PatientSectionCard title="Dental Grading History">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin w-6 h-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading dental grading history…</span>
          </div>
        ) : loadError ? (
          <div className="px-3 py-4 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
            {loadError}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-secondary-400 dark:text-neutral-500">No dental grading records yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((record, i) => (
              <GradingHistoryEntry key={record.id} index={i} record={record} catalogs={catalogs} />
            ))}
          </div>
        )}
      </PatientSectionCard>
    </div>
  );
}
