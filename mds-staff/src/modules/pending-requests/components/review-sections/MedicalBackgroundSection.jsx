import React from 'react';
import SectionWrapper, { DataRow } from './SectionWrapper';

/**
 * MedicalBackgroundSection
 *
 * Displays sub-sections for: Allergies, Immunizations, Hospitalizations,
 * Operations/Surgeries, Medications, Lifestyle, Visual Acuity, Vital Signs.
 */
const MedicalBackgroundSection = ({
  allergyProfile,
  immunizationProfile,
  hospitalizationProfile,
  operationProfile,
  medicationProfile,
  lifestyle,
  visualAcuityProfile,
  vitalSigns,
  isEditing = false,
  editedFields = {},
  onFieldChange,
  editReason = '',
  onEditReasonChange,
  onToggleEdit,
  isPending = false,
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <SectionWrapper
      title="Medical Background"
      scopeLabel="Medical"
      isLocked={isLocked}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      }
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      editReason={editReason}
      onEditReasonChange={onEditReasonChange}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {/* ── Allergies ── */}
      <div>
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Allergies
        </h4>
        {allergyProfile?.allergies?.length > 0 ? (
          <div className="space-y-2">
            {allergyProfile.allergies.map((a, i) => (
              <div key={a.id ?? i} className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  a.status === 'Active'
                    ? 'bg-error-100 dark:bg-error-900/20 text-error-800 dark:text-error-400'
                    : a.status === 'Resolved'
                    ? 'bg-success-100 dark:bg-success-900/20 text-success-800 dark:text-success-400'
                    : 'bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-400'
                }`}>
                  Allergen #{a.allergenCatalogId}
                </span>
                <span className="text-xs text-secondary-600 dark:text-neutral-400">
                  Severity: {a.severity || '—'} &middot; Status: {a.status}
                </span>
                {a.notes && (
                  <span className="text-xs text-secondary-500 dark:text-neutral-500 italic">
                    — {a.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No allergies reported</p>
        )}
        {allergyProfile?.notes && (
          <p className="mt-1 text-xs text-secondary-500 dark:text-neutral-500">Note: {allergyProfile.notes}</p>
        )}
      </div>

      {/* ── Immunizations ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Immunizations
        </h4>
        {immunizationProfile?.immunizations?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase">Vaccine</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase">Date</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase">Dose #</th>
                </tr>
              </thead>
              <tbody>
                {immunizationProfile.immunizations.map((imm, i) => (
                  <tr key={imm.id ?? i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="py-1.5 px-2 text-secondary-900 dark:text-white">
                      Vaccine #{imm.vaccineTypeId}
                    </td>
                    <td className="py-1.5 px-2 text-secondary-700 dark:text-neutral-300">
                      {formatDate(imm.immunizationDate)}
                    </td>
                    <td className="py-1.5 px-2 text-secondary-700 dark:text-neutral-300">
                      {imm.doseNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No immunizations reported</p>
        )}
      </div>

      {/* ── Hospitalizations ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Hospitalizations
        </h4>
        {hospitalizationProfile?.hospitalizations?.length > 0 ? (
          <div className="space-y-2">
            {hospitalizationProfile.hospitalizations.map((h, i) => (
              <div key={h.id ?? i} className="bg-neutral-50 dark:bg-neutral-800/30 rounded-lg p-3">
                <DataRow label="Condition" value={h.notes || `Condition #${h.conditionId}`} />
                <DataRow label="Admitted" value={formatDate(h.admissionDate)} />
                <DataRow label="Discharged" value={formatDate(h.dischargeDate) || 'Ongoing'} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No hospitalizations reported</p>
        )}
      </div>

      {/* ── Operations / Surgeries ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Operations / Surgeries
        </h4>
        {operationProfile?.operations?.length > 0 ? (
          <div className="space-y-2">
            {operationProfile.operations.map((op, i) => (
              <div key={op.id ?? i} className="bg-neutral-50 dark:bg-neutral-800/30 rounded-lg p-3">
                <DataRow label="Procedure" value={op.notes || `Procedure #${op.procedureId}`} />
                <DataRow label="Date" value={formatDate(op.operationDate)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No operations reported</p>
        )}
      </div>

      {/* ── Maintenance Medications ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Maintenance Medications
        </h4>
        {medicationProfile?.medications?.length > 0 ? (
          <div className="space-y-1">
            {medicationProfile.medications.map((med, i) => (
              <div key={med.id ?? i} className="flex items-center gap-2 py-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-accent-100 dark:bg-accent-900/20 text-accent-800 dark:text-accent-400">
                  Medicine #{med.medicineId}
                </span>
                {med.description && (
                  <span className="text-sm text-secondary-600 dark:text-neutral-400">
                    — {med.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No maintenance medications</p>
        )}
      </div>

      {/* ── Lifestyle ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Lifestyle
        </h4>
        {lifestyle ? (
          <dl className="space-y-0">
            <DataRow
              label="Smoker"
              value={
                lifestyle.smoker
                  ? `Yes — ${lifestyle.numberOfCigarettesPerDay ?? 0} sticks/day, ${lifestyle.yearsSmoked ?? 0} years`
                  : 'No'
              }
            />
            <DataRow
              label="Alcohol Consumer"
              value={
                lifestyle.alcoholConsumer
                  ? `Yes — ${lifestyle.frequencyOfAlcoholConsumption || 'Frequency not specified'}`
                  : 'No'
              }
            />
            {lifestyle.notes && <DataRow label="Notes" value={lifestyle.notes} />}
          </dl>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No lifestyle data</p>
        )}
      </div>

      {/* ── Visual Acuity ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Visual Acuity
        </h4>
        {visualAcuityProfile?.acuity ? (
          <dl className="space-y-0">
            <DataRow label="Left Eye (OS)" value={visualAcuityProfile.acuity.left_eye} />
            <DataRow label="Right Eye (OD)" value={visualAcuityProfile.acuity.right_eye} />
            <DataRow label="Recorded" value={formatDate(visualAcuityProfile.acuity.recorded_at)} />
            {visualAcuityProfile.acuity.notes && (
              <DataRow label="Notes" value={visualAcuityProfile.acuity.notes} />
            )}
          </dl>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No visual acuity data</p>
        )}
      </div>

      {/* ── Vital Signs (Height / Weight) ── */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Physical Measurements
        </h4>
        {vitalSigns ? (
          <dl className="space-y-0">
            <DataRow label="Height" value={vitalSigns.height_cm ? `${vitalSigns.height_cm} cm` : null} />
            <DataRow label="Weight" value={vitalSigns.weight_kg ? `${vitalSigns.weight_kg} kg` : null} />
            {vitalSigns.blood_pressure && <DataRow label="Blood Pressure" value={vitalSigns.blood_pressure} />}
            {vitalSigns.heart_rate && <DataRow label="Heart Rate" value={`${vitalSigns.heart_rate} bpm`} />}
            {vitalSigns.temperature && <DataRow label="Temperature" value={`${vitalSigns.temperature} °C`} />}
          </dl>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No physical measurements</p>
        )}
      </div>
    </SectionWrapper>
  );
};

export default MedicalBackgroundSection;
