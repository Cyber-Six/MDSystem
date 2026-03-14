import React from 'react';
import PatientSectionCard from './patient-section-card';

/* ─── helpers ──────────────────────────────────────────────── */

function Tag({ children, variant = 'default' }) {
  const styles = {
    condition:    'bg-error-50   dark:bg-error-900/20   text-error-700   dark:text-error-400   border border-error-200   dark:border-error-800/50',
    medication:   'bg-accent-50  dark:bg-accent-900/20  text-accent-700  dark:text-accent-400  border border-accent-200  dark:border-accent-800/50',
    immunization: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800/50',
    default:      'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium leading-none ${styles[variant]}`}>
      {children}
    </span>
  );
}

function InfoRow({ label, value, alert = false }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700/60 last:border-0">
      <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[100px] shrink-0 pt-px">{label}</span>
      <span className={`text-sm font-medium leading-snug ${alert ? 'text-error-600 dark:text-error-400' : 'text-secondary-800 dark:text-white'}`}>
        {value || <span className="text-secondary-300 dark:text-neutral-600 font-normal">None</span>}
      </span>
    </div>
  );
}

function DetailGroup({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */

export default function PatientMedicalRecordTab({ patient }) {
  const vitals = patient.medical.vitalSigns || {};
  const med    = patient.medical;

  const vitalItems = [
    { label: 'Height',      value: vitals.height      ? `${vitals.height} cm`   : null, unit: null },
    { label: 'Weight',      value: vitals.weight      ? `${vitals.weight} kg`   : null, unit: null },
    { label: 'BMI',         value: vitals.bmi         || null,                          unit: null },
    { label: 'Blood Press', value: vitals.bp          || null,                          unit: 'mmHg' },
    { label: 'Heart Rate',  value: vitals.heartRate   ? `${vitals.heartRate}`   : null, unit: 'bpm' },
    { label: 'Temp',        value: vitals.temperature ? `${vitals.temperature}` : null, unit: '°C' },
  ];

  const conditions       = patient.medicalHistory?.self || [];
  const medications      = med.medications              || [];
  const immunizations    = med.immunizations            || [];
  const hospitalizations = med.hospitalizations         || [];

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
          {vitalItems.map(({ label, value, unit }) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="text-[11px] text-secondary-400 dark:text-neutral-500 leading-none mb-1.5">{label}</p>
              {value ? (
                <p className="text-base font-semibold text-secondary-800 dark:text-white leading-none">
                  {value}
                  {unit && <span className="text-[11px] font-normal text-secondary-400 dark:text-neutral-500 ml-0.5">{unit}</span>}
                </p>
              ) : (
                <p className="text-sm text-secondary-300 dark:text-neutral-600">—</p>
              )}
            </div>
          ))}
        </div>
      </PatientSectionCard>

      {/* ── Medical Summary ──────────────────────────────────── */}
      <PatientSectionCard title="Medical Summary">
        <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4">

          {/* Left: background info */}
          <div className="space-y-0">
            <InfoRow label="Blood Type"    value={med.bloodType} />
            <InfoRow label="Drug Allergy"  value={med.allergies?.drug}  alert={!!med.allergies?.drug} />
            <InfoRow label="Food Allergy"  value={med.allergies?.food}  alert={!!med.allergies?.food} />
            <InfoRow label="Other Allergy" value={med.allergies?.other} alert={!!med.allergies?.other} />
            <InfoRow label="Smoker"        value={med.lifestyle?.smoker} />
            <InfoRow label="Alcohol"       value={med.lifestyle?.alcoholDrinker} />
          </div>

          {/* Right: clinical tags + text details */}
          <div className="space-y-4">

            <DetailGroup title="Conditions">
              {conditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((c, i) => <Tag key={i} variant="condition">{c}</Tag>)}
                </div>
              ) : (
                <p className="text-xs text-secondary-300 dark:text-neutral-600">None</p>
              )}
            </DetailGroup>

            <DetailGroup title="Medications">
              {medications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {medications.map((m, i) => <Tag key={i} variant="medication">{m}</Tag>)}
                </div>
              ) : (
                <p className="text-xs text-secondary-300 dark:text-neutral-600">None</p>
              )}
            </DetailGroup>

            <DetailGroup title="Immunizations">
              {immunizations.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {immunizations.map((v, i) => <Tag key={i} variant="immunization">{v}</Tag>)}
                </div>
              ) : (
                <p className="text-xs text-secondary-300 dark:text-neutral-600">None</p>
              )}
            </DetailGroup>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
              <div>
                <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Operations</p>
                <p className="text-xs text-secondary-700 dark:text-neutral-200">{med.operations || <span className="text-secondary-300 dark:text-neutral-600">None</span>}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Vision</p>
                <p className="text-xs text-secondary-700 dark:text-neutral-200">
                  {med.vision?.gradeOD || med.vision?.gradeOS ? (
                    <>OD {med.vision.gradeOD || '—'} · OS {med.vision.gradeOS || '—'}</>
                  ) : (
                    <span className="text-secondary-300 dark:text-neutral-600">N/A</span>
                  )}
                </p>
                {med.vision?.lastExam && (
                  <p className="text-[11px] text-secondary-400 dark:text-neutral-500 mt-0.5">Last exam {med.vision.lastExam}</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </PatientSectionCard>

      {/* ── Hospitalizations (conditional) ───────────────────── */}
      {hospitalizations.length > 0 && (
        <PatientSectionCard title="Hospitalizations">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
            {hospitalizations.map((hosp, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white leading-none">{hosp.reason || 'N/A'}</p>
                  <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">{hosp.hospital || 'N/A'} · {hosp.duration || 'N/A'}</p>
                </div>
                <span className="text-xs text-secondary-400 dark:text-neutral-500 shrink-0 ml-4">{hosp.year || '—'}</span>
              </div>
            ))}
          </div>
        </PatientSectionCard>
      )}

    </div>
  );
}