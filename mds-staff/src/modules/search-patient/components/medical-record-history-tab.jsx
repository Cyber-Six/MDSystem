import React, { useState, useEffect, useMemo } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';
import PatientSectionCard from './section-card';

/* ─── copied helpers (identical to medical-record-tab.jsx) ── */

function ConditionTag({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium leading-none bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 border border-error-200 dark:border-error-800/50">
      {children}
    </span>
  );
}

function AllergyTag({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium leading-none bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 border border-error-200 dark:border-error-800/50">
      {children}
    </span>
  );
}

function MedicationTag({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium leading-none bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800/50">
      {children}
    </span>
  );
}

function SubLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700/60 last:border-0">
      <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[140px] shrink-0 pt-px">{label}</span>
      <span className="text-sm font-medium text-secondary-800 dark:text-white leading-snug">
        {value != null && value !== '' ? value : <span className="text-secondary-300 dark:text-neutral-600 font-normal">—</span>}
      </span>
    </div>
  );
}

function EmptyState({ children }) {
  return <p className="text-xs text-secondary-300 dark:text-neutral-600 py-1">{children}</p>;
}

function AllergyGroup({ label, items }) {
  if (!items.length) return null;
  return (
    <div>
      <SubLabel>{label}</SubLabel>
      <div className="space-y-1.5 mb-1">
        {items.map((a, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <AllergyTag>{a.name}</AllergyTag>
            <span className="text-xs text-secondary-400 dark:text-neutral-500">
              {[a.severity && `Severity: ${a.severity}`, a.status && `Status: ${a.status}`].filter(Boolean).join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const GQL_MEDICAL_RECORD_HISTORY = `
  query GetMedicalRecordHistory($userId: ID!) {
    getUserMedicalHistory(userId: $userId, limit: 50) {
      id notes created_at
      conditions { id conditionId description diagnosedDate relationship }
    }
    getUserAllergyProfile(userId: $userId, limit: 50) {
      id notes created_at
      allergies { id allergenCatalogId status severity notes dateIdentified }
    }
    getUserMedicationProfile(userId: $userId, limit: 50) {
      id notes created_at
      medications { id medicineId description }
    }
    getUserImmunizationProfile(userId: $userId, limit: 50) {
      id notes created_at
      immunizations { id vaccineTypeId immunizationDate doseNumber }
    }
    getUserHospitalizationProfile(userId: $userId, limit: 50) {
      id notes created_at
      hospitalizations { id conditionId admissionDate dischargeDate notes }
    }
    getUserOperationProfile(userId: $userId, limit: 50) {
      id notes created_at
      operations { id procedureId operationDate notes }
    }
    getUserLifestyle(userId: $userId, limit: 50) {
      id smoker numberOfCigarettesPerDay yearsSmoked
      alcoholConsumer frequencyOfAlcoholConsumption
      vapeUser vapeType vapeFrequency
      notes created_at
    }
    getUserVisualAcuityProfile(userId: $userId, limit: 50) {
      id notes created_at
      acuity { id acuityId left_eye right_eye notes recorded_at }
    }
    allergenCatalogs: getAllergenCatalogs { id allergen type }
    conditionCatalogs: getDomainCatalogs(domain: MedicalCondition) { id name }
    immunizationCatalogs: getDomainCatalogs(domain: Immunization) { id name }
    operationCatalogs: getDomainCatalogs(domain: Operation) { id name }
    hospitalizationCatalogs: getDomainCatalogs(domain: Hospitalization) { id name }
    medicationCatalogs: getDomainCatalogs(domain: Medication) { id name }
  }
`;

/* ─── Helpers ─────────────────────────────────────────────── */

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return { date: 'Unknown date', time: '' };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
  };
}

/* ─── SnapshotBlock: one full Medical Record layout per snapshot index ─── */
// index=0 (current) starts expanded; older snapshots start collapsed.

function SnapshotBlock({ isCurrent, snapshotDate, children }) {
  const [open, setOpen] = useState(isCurrent);
  const { date, time } = fmtDateTime(snapshotDate);

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      {/* ── Header ── */}
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
      {/* ── Body ── */}
      {open && (
        <div className="p-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function PatientMedicalRecordHistoryTab({ patient }) {
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patient?.id) {
      return;
    }
    const currentPatientId = String(patient.id);
    let cancelled = false;

    axiosRequest.post('/emr/medical', {
      query: GQL_MEDICAL_RECORD_HISTORY,
      variables: { userId: patient.id },
    })
      .then((emrRes) => {
        if (cancelled) return;
        setHistoryData({
          _patientId: currentPatientId,
          ...(emrRes.data?.data || {}),
        });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError({
          patientId: currentPatientId,
          message:
            err?.response?.data?.errors?.[0]?.message ||
            err?.message ||
            'Failed to load medical record history.',
        });
      });

    return () => { cancelled = true; };
  }, [patient?.id]);

  const activePatientId = patient?.id ? String(patient.id) : null;
  const activeHistoryData = historyData && String(historyData._patientId) === activePatientId ? historyData : null;
  const activeError = error && error.patientId === activePatientId ? error.message : null;
  const loading = Boolean(activePatientId) && !activeHistoryData && !activeError;

  const catalogs = useMemo(() => {
    if (!activeHistoryData) return {};
    const allergenMap = {};
    (activeHistoryData.allergenCatalogs || []).forEach((c) => { allergenMap[c.id] = c; });
    const conditionMap = {};
    (activeHistoryData.conditionCatalogs || []).forEach((c) => { conditionMap[c.id] = c.name; });
    const immunizationMap = {};
    (activeHistoryData.immunizationCatalogs || []).forEach((c) => { immunizationMap[c.id] = c.name; });
    const operationMap = {};
    (activeHistoryData.operationCatalogs || []).forEach((c) => { operationMap[c.id] = c.name; });
    const hospitalizationMap = {};
    (activeHistoryData.hospitalizationCatalogs || []).forEach((c) => { hospitalizationMap[c.id] = c.name; });
    const medicationMap = {};
    (activeHistoryData.medicationCatalogs || []).forEach((c) => { medicationMap[c.id] = c.name; });
    return { allergenMap, conditionMap, immunizationMap, operationMap, hospitalizationMap, medicationMap };
  }, [activeHistoryData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin w-6 h-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading medical record history…</span>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="px-3 py-4 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
        {activeError}
      </div>
    );
  }

  const medicalHistory      = activeHistoryData?.getUserMedicalHistory      ?? [];
  const allergyProfiles     = activeHistoryData?.getUserAllergyProfile      ?? [];
  const medicationProfiles  = activeHistoryData?.getUserMedicationProfile   ?? [];
  const immunizationProfiles= activeHistoryData?.getUserImmunizationProfile ?? [];
  const hospitalizationProfiles = activeHistoryData?.getUserHospitalizationProfile ?? [];
  const operationProfiles   = activeHistoryData?.getUserOperationProfile    ?? [];
  const lifestyleProfiles   = activeHistoryData?.getUserLifestyle           ?? [];
  const visualAcuityProfiles= activeHistoryData?.getUserVisualAcuityProfile ?? [];

  const { allergenMap, conditionMap, immunizationMap, operationMap, hospitalizationMap, medicationMap } = catalogs;

  const hasAnyData = [
    medicalHistory, allergyProfiles, medicationProfiles,
    immunizationProfiles, hospitalizationProfiles, operationProfiles,
    lifestyleProfiles, visualAcuityProfiles,
  ].some((arr) => arr.length > 0);

  /* ── Medical History content (same as Medical Record tab) ── */
  const renderMedHistoryEntry = (r) => {
    const conditions  = r.conditions || [];
    const selfConds   = conditions.filter((c) => !c.relationship || c.relationship === 'self');
    const familyConds = conditions.filter((c) => c.relationship && c.relationship !== 'self');
    return (
      <>
        <SubLabel>Personal Conditions</SubLabel>
        {selfConds.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selfConds.map((c, j) => (
              <ConditionTag key={j}>
                {c.description || conditionMap[c.conditionId] || `Condition #${c.conditionId}`}
              </ConditionTag>
            ))}
          </div>
        ) : (
          <EmptyState>None on record</EmptyState>
        )}
        {familyConds.length > 0 && (
          <>
            <SubLabel>Family History</SubLabel>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
              {familyConds.map((c, j) => (
                <div key={j} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-secondary-700 dark:text-neutral-200">
                    {c.description || conditionMap[c.conditionId] || `Condition #${c.conditionId}`}
                  </span>
                  <span className="text-sm font-medium text-secondary-800 dark:text-white capitalize">
                    {c.relationship}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {r.notes && (
          <>
            <SubLabel>Notes</SubLabel>
            <p className="text-sm text-secondary-700 dark:text-neutral-300">{r.notes}</p>
          </>
        )}
      </>
    );
  };

  /* ── Allergies content (same as Medical Record tab) ──────── */
  const renderAllergyEntry = (r) => {
    const allergies = r.allergies || [];
    if (allergies.length === 0) return <EmptyState>None on record</EmptyState>;

    const foodAllergies  = allergies.filter((a) => allergenMap[a.allergenCatalogId]?.type === 'Food')
      .map((a) => ({ name: allergenMap[a.allergenCatalogId]?.allergen || `Allergen #${a.allergenCatalogId}`, severity: a.severity, status: a.status }));
    const drugAllergies  = allergies.filter((a) => allergenMap[a.allergenCatalogId]?.type === 'Drug')
      .map((a) => ({ name: allergenMap[a.allergenCatalogId]?.allergen || `Allergen #${a.allergenCatalogId}`, severity: a.severity, status: a.status }));
    const envAllergies   = allergies.filter((a) => allergenMap[a.allergenCatalogId]?.type === 'Environmental')
      .map((a) => ({ name: allergenMap[a.allergenCatalogId]?.allergen || `Allergen #${a.allergenCatalogId}`, severity: a.severity, status: a.status }));
    const otherAllergies = allergies.filter((a) => {
      const t = allergenMap[a.allergenCatalogId]?.type;
      return t && t !== 'Food' && t !== 'Drug' && t !== 'Environmental';
    }).map((a) => ({ name: allergenMap[a.allergenCatalogId]?.allergen || `Allergen #${a.allergenCatalogId}`, severity: a.severity, status: a.status }));

    return (
      <div className="space-y-0.5">
        <AllergyGroup label="Food"          items={foodAllergies} />
        <AllergyGroup label="Drugs"         items={drugAllergies} />
        <AllergyGroup label="Environmental" items={envAllergies} />
        <AllergyGroup label="Others"        items={otherAllergies} />
      </div>
    );
  };

  /* ── Hospitalizations content ────────────────────────────── */
  const renderHospEntry = (r) => {
    const hosps = r.hospitalizations || [];
    if (hosps.length === 0) return <EmptyState>None on record</EmptyState>;
    return (
      <div className="space-y-2">
        {hosps.map((h, j) => (
          <div key={j} className="rounded-md border border-neutral-100 dark:border-neutral-700/60 p-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Condition</p>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">{hospitalizationMap[h.conditionId] || `Condition #${h.conditionId}`}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Admitted</p>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">{fmt(h.admissionDate)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Discharged</p>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">{h.dischargeDate ? fmt(h.dischargeDate) : 'Ongoing'}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Immunizations table ─────────────────────────────────── */
  const renderImmunEntry = (r) => {
    const imms = r.immunizations || [];
    if (imms.length === 0) return <EmptyState>None on record</EmptyState>;
    return (
      <div className="overflow-x-auto -mx-3 -mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-700/40">
              <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Vaccine</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Date</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-20">Dose #</th>
            </tr>
          </thead>
          <tbody>
            {imms.map((v, j) => (
              <tr key={j} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                <td className="px-3 py-1.5 text-secondary-800 dark:text-white">{immunizationMap[v.vaccineTypeId] || `Vaccine #${v.vaccineTypeId}`}</td>
                <td className="px-3 py-1.5 text-secondary-500 dark:text-neutral-400">{fmt(v.immunizationDate)}</td>
                <td className="px-3 py-1.5 text-center text-secondary-800 dark:text-white">{v.doseNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ── Operations ──────────────────────────────────────────── */
  const renderOpEntry = (r) => {
    const ops = r.operations || [];
    if (ops.length === 0) return <EmptyState>None on record</EmptyState>;
    return (
      <div className="space-y-2">
        {ops.map((o, j) => (
          <div key={j} className="rounded-md border border-neutral-100 dark:border-neutral-700/60 p-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Procedure</p>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">{operationMap[o.procedureId] || `Procedure #${o.procedureId}`}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Date</p>
              <p className="text-sm font-medium text-secondary-800 dark:text-white">{fmt(o.operationDate)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Medications content ─────────────────────────────────── */
  const renderMedEntry = (r) => {
    const meds = r.medications || [];
    if (meds.length === 0) return <EmptyState>None on record</EmptyState>;
    return (
      <div className="flex flex-wrap gap-2">
        {meds.map((m, j) => (
          <span key={j} className="flex items-center gap-1.5">
            <MedicationTag>{medicationMap[m.medicineId] || `Medicine #${m.medicineId}`}</MedicationTag>
            {m.description && (
              <span className="text-xs text-secondary-400 dark:text-neutral-500">— {m.description}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  /* ── Lifestyle content ───────────────────────────────────── */
  const renderLifestyleEntry = (r) => (
    <>
      <DataRow label="Smoker"           value={r.smoker ? 'Yes' : r.smoker === false ? 'No' : null} />
      {r.smoker && (
        <>
          <DataRow label="Cigarettes/Day" value={r.numberOfCigarettesPerDay} />
          <DataRow label="Years Smoked"   value={r.yearsSmoked} />
        </>
      )}
      <DataRow label="Alcohol Consumer" value={r.alcoholConsumer ? 'Yes' : r.alcoholConsumer === false ? 'No' : null} />
      {r.alcoholConsumer && (
        <DataRow label="Alcohol Frequency" value={r.frequencyOfAlcoholConsumption} />
      )}
      <DataRow label="Vaper" value={r.vapeUser ? 'Yes' : r.vapeUser === false ? 'No' : null} />
      {r.vapeUser && (
        <>
          <DataRow label="Vape Type"      value={r.vapeType} />
          <DataRow label="Vape Frequency" value={r.vapeFrequency} />
        </>
      )}
      {r.notes && <DataRow label="Notes" value={r.notes} />}
    </>
  );

  /* ── Visual Acuity content ───────────────────────────────── */
  const renderVisionEntry = (r) => {
    const acuity = r.acuity;
    if (!acuity) return <EmptyState>None on record</EmptyState>;
    return (
      <>
        <DataRow label="Left Eye (OS)"  value={acuity.left_eye} />
        <DataRow label="Right Eye (OD)" value={acuity.right_eye} />
        {acuity.recorded_at && <DataRow label="Recorded" value={fmt(acuity.recorded_at)} />}
        {acuity.notes && <DataRow label="Notes" value={acuity.notes} />}
      </>
    );
  };

  /* ── Build snapshot list (grouped by index across all sections) ── */
  const allArrays = [
    medicalHistory, allergyProfiles, medicationProfiles,
    immunizationProfiles, hospitalizationProfiles, operationProfiles,
    lifestyleProfiles, visualAcuityProfiles,
  ];
  const maxCount = allArrays.reduce((m, a) => Math.max(m, a.length), 0);

  return (
    <div className="space-y-3">
      {!hasAnyData ? (
        <PatientSectionCard title="Medical Record History">
          <p className="text-sm text-secondary-400 dark:text-neutral-500">No medical record history found.</p>
        </PatientSectionCard>
      ) : Array.from({ length: maxCount }, (_, i) => {
        const mh  = medicalHistory[i]             ?? null;
        const ap  = allergyProfiles[i]            ?? null;
        const mp  = medicationProfiles[i]         ?? null;
        const ip  = immunizationProfiles[i]       ?? null;
        const hp  = hospitalizationProfiles[i]    ?? null;
        const op  = operationProfiles[i]          ?? null;
        const lf  = lifestyleProfiles[i]          ?? null;
        const vap = visualAcuityProfiles[i]       ?? null;

        // Use the first non-null record's created_at as the header date
        const snapshotDate =
          [mh, ap, mp, ip, hp, op, lf, vap].find(Boolean)?.created_at ?? null;

        return (
          <SnapshotBlock key={i} isCurrent={i === 0} snapshotDate={snapshotDate}>
            {/* Two-column grid (same layout as Medical Record tab) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {/* ── LEFT COLUMN ── */}
              <div className="space-y-3">
                {mh && (
                  <PatientSectionCard title="Medical History">
                    {renderMedHistoryEntry(mh)}
                  </PatientSectionCard>
                )}
                {ap && (
                  <PatientSectionCard title="Allergies">
                    {renderAllergyEntry(ap)}
                  </PatientSectionCard>
                )}
                {hp && (
                  <PatientSectionCard title="Hospitalizations">
                    {renderHospEntry(hp)}
                  </PatientSectionCard>
                )}
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="space-y-3">
                {ip && (
                  <PatientSectionCard title="Immunizations">
                    {renderImmunEntry(ip)}
                  </PatientSectionCard>
                )}
                {op && (
                  <PatientSectionCard title="Operations / Surgeries">
                    {renderOpEntry(op)}
                  </PatientSectionCard>
                )}
                {mp && (
                  <PatientSectionCard title="Maintenance Medications">
                    {renderMedEntry(mp)}
                  </PatientSectionCard>
                )}
                {lf && (
                  <PatientSectionCard title="Lifestyle">
                    {renderLifestyleEntry(lf)}
                  </PatientSectionCard>
                )}
                {vap && vap.acuity && (
                  <PatientSectionCard title="Visual Acuity">
                    {renderVisionEntry(vap)}
                  </PatientSectionCard>
                )}
              </div>
            </div>
          </SnapshotBlock>
        );
      })}
    </div>
  );
}
