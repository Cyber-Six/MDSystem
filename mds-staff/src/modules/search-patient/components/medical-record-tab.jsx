import React from 'react';
import PatientSectionCard from './section-card';

/* ─── helpers ──────────────────────────────────────────────── */

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

/* ─── main component ────────────────────────────────────────── */

export default function PatientMedicalRecordTab({ patient }) {
  const vitals   = patient.medical.vitalSigns || {};
  const med      = patient.medical;
  const history  = patient.medicalHistory || {};

  const selfConditions   = history.self   || [];
  const familyConditions = history.family || [];
  const historyNotes     = history.notes  || '';

  const allergiesList    = med.allergiesList    || [];
  const medications      = med.medications      || [];
  const immunizations    = med.immunizations    || [];
  const hospitalizations = med.hospitalizations || [];
  const operations       = med.operations       || [];
  const lifestyle        = med.lifestyle        || {};
  const vision           = med.vision           || {};

  // Group allergies by type
  const foodAllergies  = allergiesList.filter((a) => a.type === 'Food');
  const drugAllergies  = allergiesList.filter((a) => a.type === 'Drug');
  const envAllergies   = allergiesList.filter((a) => a.type === 'Environmental');
  const otherAllergies = allergiesList.filter((a) => a.type && a.type !== 'Food' && a.type !== 'Drug' && a.type !== 'Environmental');

  const vitalItems = [
    { label: 'Height',      value: vitals.height      ? `${vitals.height} cm`      : null },
    { label: 'Weight',      value: vitals.weight      ? `${vitals.weight} kg`      : null },
    { label: 'BMI',         value: vitals.bmi         || null },
    { label: 'Blood Press', value: vitals.bp          || null },
    { label: 'Heart Rate',  value: vitals.heartRate   ? `${vitals.heartRate} bpm`  : null },
    { label: 'Temp',        value: vitals.temperature ? `${vitals.temperature} °C` : null },
  ];

  return (
    <div className="space-y-3">

      {/* ── Vital Signs ─────────────────────────────────────── */}
      <PatientSectionCard
        title="Vital Signs"
        right={
          vitals.lastChecked && (
            <span className="text-xs text-secondary-400 dark:text-neutral-500">
              Last checked: {vitals.lastChecked}
            </span>
          )
        }
      >
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-neutral-200 dark:divide-neutral-700 -mx-3 -mb-3 border-t border-neutral-100 dark:border-neutral-700/60">
          {vitalItems.map(({ label, value }) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="text-[11px] text-secondary-400 dark:text-neutral-500 leading-none mb-1.5">{label}</p>
              {value ? (
                <p className="text-base font-semibold text-secondary-800 dark:text-white leading-none">{value}</p>
              ) : (
                <p className="text-sm text-secondary-300 dark:text-neutral-600">—</p>
              )}
            </div>
          ))}
        </div>
      </PatientSectionCard>

      {/* ── 2-column layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────── */}
        <div className="space-y-3">

          {/* Medical History */}
          <PatientSectionCard title="Medical History">
            <SubLabel>Personal Conditions</SubLabel>
            {selfConditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selfConditions.map((c, i) => <ConditionTag key={i}>{c}</ConditionTag>)}
              </div>
            ) : (
              <EmptyState>None on record</EmptyState>
            )}

            {familyConditions.length > 0 && (
              <>
                <SubLabel>Family History</SubLabel>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
                  {familyConditions.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-secondary-700 dark:text-neutral-200">{f.name}</span>
                      <span className="text-sm font-medium text-secondary-800 dark:text-white capitalize">{f.relationship}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {historyNotes && (
              <>
                <SubLabel>Notes</SubLabel>
                <p className="text-sm text-secondary-700 dark:text-neutral-300">{historyNotes}</p>
              </>
            )}
          </PatientSectionCard>

          {/* Allergies grouped by type */}
          <PatientSectionCard title="Allergies">
            {allergiesList.length === 0 ? (
              <EmptyState>None on record</EmptyState>
            ) : (
              <div className="space-y-0.5">
                <AllergyGroup label="Food" items={foodAllergies} />
                <AllergyGroup label="Drugs" items={drugAllergies} />
                <AllergyGroup label="Environmental" items={envAllergies} />
                <AllergyGroup label="Others" items={otherAllergies} />
              </div>
            )}
          </PatientSectionCard>

          {/* Hospitalizations */}
          <PatientSectionCard title="Hospitalizations">
            {hospitalizations.length > 0 ? (
              <div className="space-y-2">
                {hospitalizations.map((h, i) => (
                  <div key={i} className="rounded-md border border-neutral-100 dark:border-neutral-700/60 p-3 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Condition</p>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{h.condition || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Admitted</p>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{h.admittedDate || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Discharged</p>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{h.dischargedDate || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>None on record</EmptyState>
            )}
          </PatientSectionCard>

        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────── */}
        <div className="space-y-3">

          {/* Immunizations */}
          <PatientSectionCard title="Immunizations">
            {immunizations.length > 0 ? (
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
                    {immunizations.map((v, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                        <td className="px-3 py-1.5 text-secondary-800 dark:text-white">{v.name}</td>
                        <td className="px-3 py-1.5 text-secondary-500 dark:text-neutral-400">{v.date || '—'}</td>
                        <td className="px-3 py-1.5 text-center text-secondary-800 dark:text-white">{v.doseNumber || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>None on record</EmptyState>
            )}
          </PatientSectionCard>

          {/* Operations / Surgeries */}
          <PatientSectionCard title="Operations / Surgeries">
            {operations.length > 0 ? (
              <div className="space-y-2">
                {operations.map((o, i) => (
                  <div key={i} className="rounded-md border border-neutral-100 dark:border-neutral-700/60 p-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Procedure</p>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{o.procedure || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Date</p>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{o.date || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>None on record</EmptyState>
            )}
          </PatientSectionCard>

          {/* Maintenance Medications */}
          <PatientSectionCard title="Maintenance Medications">
            {medications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {medications.map((m, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <MedicationTag>{m.name}</MedicationTag>
                    {m.description && (
                      <span className="text-xs text-secondary-400 dark:text-neutral-500">— {m.description}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState>None on record</EmptyState>
            )}
          </PatientSectionCard>

          {/* Lifestyle */}
          <PatientSectionCard title="Lifestyle">
            <DataRow label="Smoker"           value={lifestyle.smoker} />
            {lifestyle.smoker === 'Yes' && (
              <>
                <DataRow label="Cigarettes/Day" value={lifestyle.cigarettesPerDay} />
                <DataRow label="Years Smoked"   value={lifestyle.yearsSmoked} />
              </>
            )}
            <DataRow label="Alcohol Consumer" value={lifestyle.alcoholConsumer} />
            {lifestyle.alcoholConsumer === 'Yes' && (
              <DataRow label="Alcohol Frequency" value={lifestyle.alcoholFrequency} />
            )}
          </PatientSectionCard>

          {/* Visual Acuity */}
          {(vision.gradeOD || vision.gradeOS) && (
            <PatientSectionCard title="Visual Acuity">
              <DataRow label="Left Eye (OS)"  value={vision.gradeOS} />
              <DataRow label="Right Eye (OD)" value={vision.gradeOD} />
              {vision.lastExam && <DataRow label="Recorded" value={vision.lastExam} />}
            </PatientSectionCard>
          )}

        </div>
      </div>

    </div>
  );
}