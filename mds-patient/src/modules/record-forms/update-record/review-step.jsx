import React, { useEffect } from 'react';
import { ReviewSectionHeader, ReviewDataRow, ReviewNote, resolveCatalogLabel, formatReviewDate } from '../initial-record/review-components';

const ReviewGroup = ({ title, children }) => (
  <div className="medical-review-group">
    <h5>{title}</h5>
    <dl className="space-y-1">{children}</dl>
  </div>
);
const reviewListTones = {
  medical: 'border-error-200 bg-error-100 text-error-800 dark:border-error-900 dark:bg-error-900/30 dark:text-error-200',
  vaccine: 'border-success-200 bg-success-100 text-success-800 dark:border-success-900 dark:bg-success-900/30 dark:text-success-200',
  allergy: 'border-error-200 bg-error-100 text-error-800 dark:border-error-900 dark:bg-error-900/30 dark:text-error-200',
  hospital: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200',
  operation: 'border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-900/30 dark:text-violet-200',
  medication: 'border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-900 dark:bg-teal-900/30 dark:text-teal-200',
  dental: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  appliance: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200',
};

const ReviewList = ({ items, tone = 'medical' }) => items.length ? (
  <div className="flex flex-wrap gap-1.5">
    {items.map((item, index) => <span key={index} className={`inline-flex max-w-full flex-wrap items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-snug ${reviewListTones[tone] || reviewListTones.medical}`}>{item}</span>)}
  </div>
) : <span className="text-secondary-500 dark:text-neutral-400">None reported</span>;

const ReviewStep = ({ formData, onEdit, steps = [], recordType, revisionNotes = null, isRevision = false, isReviewConfirmed = false, reviewConfirmationError = false, onReviewConfirmedChange = () => {}, onValidationStateChange = () => {} }) => {
  const registry = formData.catalogRegistry || {};
  const getCatalogName = (domain, id) => resolveCatalogLabel(null, id, registry?.[domain] || {}) || `Unresolved choice (${id})`;
  const selectedMap = (selection, domain) => Object.entries(selection || {}).filter(([, selected]) => selected).map(([id]) => getCatalogName(domain, id));
  const selectedArray = (selection, domain) => (Array.isArray(selection) ? selection : []).map((id) => getCatalogName(domain, id));
  const isEmployee = formData.profileType === 'Employee';
  const profileRows = {
    'Program': formData.program,
    'Student Category': formData.schoolYear,
    'Department': formData.employeeDepartment,
    'Employment Category': formData.employeeRole === 'Other' ? formData.employeeCategoryOther : formData.employeeRole,
    'Position': formData.employeePosition,
  };
  const selfConditions = selectedMap(formData.selfConditions, 'medicalConditions');
  const familyConditions = Object.entries(formData.familyConditions || {}).filter(([, value]) => value?.checked).map(([id, value]) => `${getCatalogName('medicalConditions', id)} — ${value.relationship || 'Relationship not provided'}`);
  const allergies = selectedArray(formData.selectedAllergies, 'allergens').map((name, index) => {
    const id = formData.selectedAllergies[index];
    const detail = formData.allergyDetails?.[id] || {};
    return `${name} (type: ${detail.type || registry.allergens?.[id]?.type || 'Not provided'}; severity: ${detail.severity || 'Unknown'}; status: ${detail.status || 'Active'})`;
  });
  const vaccines = selectedArray(formData.immunizations, 'immunizations').map((name, index) => {
    const id = formData.immunizations[index];
    const detail = formData.immunizationDetails?.[id] || {};
    return `${name} (Dose: ${detail.doseNumber ?? 'Not provided'}; date: ${formatReviewDate(detail.date) || 'Not provided'})`;
  });
  const hospitals = Object.entries(formData.hospitalizationConditions || {}).filter(([, selected]) => selected).map(([id]) => {
    const dates = formData.hospitalizationDates?.[id] || {};
    return `${getCatalogName('hospitalizations', id)} (admitted: ${formatReviewDate(dates.admissionDate) || 'Not provided'}; discharged: ${formatReviewDate(dates.dischargeDate) || 'Not provided'})`;
  });
  const operations = Object.entries(formData.operationConditions || {}).filter(([, selected]) => selected).map(([id]) => `${getCatalogName('operations', id)} (${formatReviewDate(formData.operationDates?.[id]) || 'Date not provided'})`);
  const medications = Object.entries(formData.selectedMedications || {}).filter(([, selected]) => selected).map(([id]) => [getCatalogName('medications', id), formData.medicationDescriptions?.[id] || formData.medicationReason].filter(Boolean).join(' - '));
  const smokingDetails = formData.smoker === 'yes'
    ? `Yes (${formData.smokerSticksPerDay ?? 'Not provided'} ${Number(formData.smokerSticksPerDay) === 1 ? 'stick' : 'sticks'}/day, ${formData.smokerYears ?? 'Not provided'} ${Number(formData.smokerYears) === 1 ? 'year' : 'years'})`
    : formData.smoker === 'no' ? 'No' : undefined;
  const alcoholDetails = formData.alcoholDrinker === 'yes'
    ? `Yes${formData.alcoholFrequency ? ` (${formData.alcoholFrequency})` : ''}`
    : formData.alcoholDrinker === 'no' ? 'No' : undefined;
  const vapingDetails = formData.vaper === 'yes'
    ? `Yes${[formData.vapeType, formData.vapeFrequency].filter(Boolean).length ? ` (${[formData.vapeType, formData.vapeFrequency].filter(Boolean).join(', ')})` : ''}`
    : formData.vaper === 'no' ? 'No' : undefined;
  const medicalRows = {
    'Your medical conditions': <ReviewList items={selfConditions} tone="medical" />,
    'Family medical conditions': <ReviewList items={familyConditions} tone="medical" />,
    'Allergies': formData.hasAllergies,
    'Selected allergies': <ReviewList items={allergies} tone="allergy" />,
    'Allergy details': formData.allergiesDetail,
    'Allergy notes': formData.allergiesNotes,
    'Immunizations': <ReviewList items={vaccines} tone="vaccine" />,
    'Hospitalizations': formData.hasHospitalizations,
    'Hospitalization history': <ReviewList items={hospitals} tone="hospital" />,
    'Hospitalization notes': formData.hospitalizationNotes,
    'Surgeries': formData.hasSurgeries,
    'Operations': <ReviewList items={operations} tone="operation" />,
    'Surgery notes': formData.surgeryNotes,
    'Medications': formData.hasMedications,
    'Selected medications': <ReviewList items={medications} tone="medication" />,
    'Medication notes': formData.medicationNotes,
    'Smoker': smokingDetails,
    'Alcohol Drinker': alcoholDetails,
    'Vaper': vapingDetails,
    'Glasses or contact lenses': formData.visualAcuity,
    'Visual acuity type': formData.visualAcuity === 'yes' && formData.acuityId ? getCatalogName('visualAcuity', formData.acuityId) : undefined,
    'Grade OD': formData.visualAcuity === 'yes' ? formData.rightEye : undefined,
    'Grade OS': formData.visualAcuity === 'yes' ? formData.leftEye : undefined,
    'Menstruation duration': formData.menstruationDuration != null && formData.menstruationDuration !== '' ? formData.menstruationDuration + ' days' : undefined,
    'Visual acuity notes': formData.visualAcuityNotes,
    'Last menstrual period': formData.sex === 'Female' ? formatReviewDate(formData.lastMenstrualPeriod) : undefined,
    'Dysmenorrhea': formData.sex === 'Female' ? formData.dysmenorrhea : undefined,
  };
  const appliances = (formData.oralAppliances || []).map((item, index) => `Appliance ${index + 1}: ${getCatalogName('oralAppliances', item.tagId)}; location: ${item.arch || 'Not provided'}; status: ${item.status || 'Not provided'}; issued: ${formatReviewDate(item.dateIssued) || 'Not provided'}`);
  const procedures = (formData.dentalProcedures || []).map((item) => `${getCatalogName('dentalProcedures', item.procedureTypeId)}${item.procedureDate ? ' (' + formatReviewDate(item.procedureDate) + ')' : ''}`);
  const activeSelections = [
    ...Object.entries(formData.selfConditions || {}).filter(([, selected]) => selected).map(([id]) => ['medicalConditions', id]),
    ...Object.entries(formData.familyConditions || {}).filter(([, value]) => value?.checked).map(([id]) => ['medicalConditions', id]),
    ...(formData.selectedAllergies || []).map((id) => ['allergens', id]),
    ...(formData.immunizations || []).map((id) => ['immunizations', id]),
    ...Object.entries(formData.hospitalizationConditions || {}).filter(([, selected]) => selected).map(([id]) => ['hospitalizations', id]),
    ...Object.entries(formData.operationConditions || {}).filter(([, selected]) => selected).map(([id]) => ['operations', id]),
    ...Object.entries(formData.selectedMedications || {}).filter(([, selected]) => selected).map(([id]) => ['medications', id]),
    ...(formData.dentalProcedures || []).map((item) => ['dentalProcedures', item.procedureTypeId]),
    ...(formData.oralAppliances || []).filter((item) => item.tagId).map((item) => ['oralAppliances', item.tagId]),
  ];
  const unresolvedSelections = activeSelections.filter(([domain]) => ['oralAppliances', 'dentalProcedures'].includes(domain) ? recordType !== 'medical' : recordType !== 'dental').filter(([domain, id]) => !/^[1-9]\d*$/.test(String(id ?? '')) || !resolveCatalogLabel(null, id, registry?.[domain] || {}));
  useEffect(() => onValidationStateChange(unresolvedSelections.length > 0), [unresolvedSelections.length, onValidationStateChange]);
  const dentalRows = {
    'Visited a dentist': formData.seenByDentist,
    'Last dental cleaning': formData.lastDentalCleaning,
    'Last visit date': formatReviewDate(formData.lastVisitDate),
    'Purpose of last visit': formData.purpose,
    'Intraoral appliances': formData.hasOralAppliances,
    'Appliances': <ReviewList items={appliances} tone="appliance" />,
    'Dental procedures': <ReviewList items={procedures} tone="dental" />,
    'Upper teeth photo': formData.upperTeethPhoto?.name || (formData.upperTeethPhoto ? 'Uploaded' : 'Not uploaded'),
    'Lower teeth photo': formData.lowerTeethPhoto?.name || (formData.lowerTeethPhoto ? 'Uploaded' : 'Not uploaded'),
  };
  const stepIndex = (name) => steps.indexOf(name);
  const renderRows = (rows, labels, fullWidth = false) => labels.map(label => fullWidth ? (
    <div key={label} className="grid grid-cols-1 gap-1 border-b border-neutral-100 py-2 dark:border-neutral-700">
      <dt className="font-medium text-secondary-600 dark:text-neutral-300">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-wrap text-secondary-900 dark:text-neutral-100">{rows[label] ?? <span className="text-secondary-400">Not provided</span>}</dd>
    </div>
  ) : <ReviewDataRow key={label} label={label} value={rows[label]} />);
  const medicalEdit = () => onEdit(stepIndex('Medical History'));
  const dentalEdit = () => onEdit(stepIndex('Dental History'));

  return (
    <div className="space-y-6">
      {steps.includes('Personal Info') && <>
        <section className="form-section">
          <ReviewSectionHeader title={isEmployee ? 'Employment Information' : 'School Information'} onEditClick={() => onEdit(stepIndex('Personal Info'))} />
          <dl className="space-y-1">{renderRows(profileRows, isEmployee ? ['Department', 'Employment Category', 'Position'] : ['Program', 'Student Category'])}</dl>
        </section>
        <section className="form-section">
          <ReviewSectionHeader title="Emergency Contact Information" onEditClick={() => onEdit(stepIndex('Personal Info'))} />
          <div className="medical-review-groups">{[1, 2].map(index => <ReviewGroup key={index} title={index === 1 ? 'Primary Emergency Contact' : 'Secondary Emergency Contact'}>
            <ReviewDataRow label="Name" value={formData['emergencyContact' + index + 'Name']} />
            <ReviewDataRow label="Relationship" value={formData['emergencyContact' + index + 'Relationship']} />
            <ReviewDataRow label="Contact Number" value={formData['emergencyContact' + index + 'Number']} />
            <ReviewDataRow label="Address" value={formData['emergencyContact' + index + 'Address']} />
          </ReviewGroup>)}</div>
        </section>
      </>}
      {unresolvedSelections.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">Some selected catalog choices cannot be identified. Edit the affected section before submitting.<div className="mt-2 flex gap-3">{unresolvedSelections.some(([domain]) => domain === 'medicalConditions' || domain === 'allergens' || domain === 'immunizations' || domain === 'hospitalizations' || domain === 'operations' || domain === 'medications') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Medical History'))}>Edit Medical History</button>}{unresolvedSelections.some(([domain]) => domain === 'dentalProcedures' || domain === 'oralAppliances') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Dental History'))}>Edit Dental History</button>}</div></div>}
      {(recordType === 'medical' || recordType === 'both') && <>
        <section className="form-section">
          <ReviewSectionHeader title="Medical History" onEditClick={medicalEdit} />
          <div className="medical-review-groups">
            <ReviewGroup title="Yourself">{renderRows(medicalRows, ['Your medical conditions'], true)}</ReviewGroup>
            <ReviewGroup title="Family">{renderRows(medicalRows, ['Family medical conditions'], true)}</ReviewGroup>
          </div>
        </section>
        <section className="form-section">
          <ReviewSectionHeader title="Medical Background" onEditClick={medicalEdit} />
          <div className="medical-review-groups">
            <ReviewGroup title="Immunization & Vaccines">{renderRows(medicalRows, ['Immunizations'], true)}</ReviewGroup>
            <ReviewGroup title="History of Allergies">{renderRows(medicalRows, ['Allergies'])}{formData.hasAllergies === 'yes' && renderRows(medicalRows, ['Selected allergies'], true)}<ReviewNote label="Allergy details" value={formData.allergiesDetail} /><ReviewNote label="Allergy notes" value={formData.allergiesNotes} /></ReviewGroup>
            <ReviewGroup title="History of Hospitalizations">{renderRows(medicalRows, ['Hospitalizations'])}{formData.hasHospitalizations === 'yes' && renderRows(medicalRows, ['Hospitalization history'], true)}<ReviewNote label="Hospitalization notes" value={formData.hospitalizationNotes} /></ReviewGroup>
            <ReviewGroup title="History of Operation">{renderRows(medicalRows, ['Surgeries'])}{formData.hasSurgeries === 'yes' && renderRows(medicalRows, ['Operations'], true)}<ReviewNote label="Surgery notes" value={formData.surgeryNotes} /></ReviewGroup>
            <ReviewGroup title="Medications">{renderRows(medicalRows, ['Medications'])}{formData.hasMedications === 'yes' && renderRows(medicalRows, ['Selected medications'], true)}<ReviewNote label="Medication notes" value={formData.medicationNotes} /></ReviewGroup>
            <ReviewGroup title="Daily habits and vision">{renderRows(medicalRows, ['Smoker', 'Alcohol Drinker', 'Vaper', 'Glasses or contact lenses', ...(formData.visualAcuity === 'yes' ? ['Visual acuity type', 'Grade OD', 'Grade OS'] : [])])}<ReviewNote label="Visual acuity notes" value={formData.visualAcuityNotes} /></ReviewGroup>
          </div>
        </section>
        {formData.sex === 'Female' && <section className="form-section">
          <ReviewSectionHeader title="OB-GYNE History" onEditClick={medicalEdit} />
          <ReviewGroup title="Menstrual health">{renderRows(medicalRows, ['Last menstrual period', 'Menstruation duration', 'Dysmenorrhea'])}</ReviewGroup>
        </section>}
      </>}
      {(recordType === 'dental' || recordType === 'both') && <section className="form-section">
        <ReviewSectionHeader title="Dental History" onEditClick={dentalEdit} />
        <div className="medical-review-groups">
          <ReviewGroup title="Dental visits">{renderRows(dentalRows, ['Visited a dentist', 'Last dental cleaning', 'Last visit date', 'Purpose of last visit'])}</ReviewGroup>
          <ReviewGroup title="Intra-Oral Appliances">{renderRows(dentalRows, ['Intraoral appliances'])}{renderRows(dentalRows, ['Appliances'], true)}<ReviewNote label="Other appliance" value={formData.oralApplianceOtherDescription} />{formData.oralApplianceOtherDescription && <ReviewDataRow label="Other appliance location" value={formData.oralApplianceOtherArch} />}<ReviewNote label="Appliance notes" value={formData.oralApplianceNotes} /></ReviewGroup>
          <ReviewGroup title="Dental Procedures">{renderRows(dentalRows, ['Dental procedures'], true)}<ReviewNote label="Procedure notes" value={formData.dentalProcedureNotes} /></ReviewGroup>
          <ReviewGroup title="Dental Photos">{renderRows(dentalRows, ['Upper teeth photo', 'Lower teeth photo'])}
            {formData.upperTeethPhoto?.preview && <img className="mt-3 max-w-full sm:max-w-xs rounded border" src={formData.upperTeethPhoto.preview} alt="Upper teeth preview" />}
            {formData.lowerTeethPhoto?.preview && <img className="mt-3 max-w-full sm:max-w-xs rounded border" src={formData.lowerTeethPhoto.preview} alt="Lower teeth preview" />}
          </ReviewGroup>
        </div>
      </section>}
      <div className="form-section"><p>Review each section and edit any details that need correction before submitting.</p></div>
      {formData.profileType === 'Student' && !isRevision && <div>
        <label className={`flex items-start gap-3 rounded-lg border p-4 text-sm text-secondary-800 dark:text-neutral-100 ${reviewConfirmationError ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-primary-300 bg-primary-50 dark:border-primary-500/50 dark:bg-primary-500/10'}`}>
          <input
            type="checkbox"
            required
            aria-required="true"
            aria-invalid={reviewConfirmationError}
            aria-describedby={reviewConfirmationError ? 'update-review-confirmation-error' : undefined}
            className="mt-0.5 h-4 w-4 accent-primary-500"
            checked={isReviewConfirmed}
            onChange={(event) => onReviewConfirmedChange(event.target.checked)}
          />
          <span><strong>Review required:</strong> I have reviewed my complete update and confirm the information is accurate before submitting.</span>
        </label>
        {reviewConfirmationError && <p id="update-review-confirmation-error" role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">Check this box to confirm you reviewed the update before submitting.</p>}
      </div>}
    </div>
  );
};

export default ReviewStep;
