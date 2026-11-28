import React, { useEffect } from 'react';
import { ReviewSectionHeader, ReviewNote, resolveCatalogLabel, formatReviewDate } from '../initial-record/review-components';

const ReviewField = ({ label, value, wide = false }) => {
  const hasValue = value !== undefined && value !== null && value !== '' && value !== 'undefined';
  const normalized = typeof value === 'string' ? value.toLowerCase() : value;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : normalized === 'yes' ? 'Yes' : normalized === 'no' ? 'No' : value;

  return (
    <div className={`min-w-0 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-700 dark:bg-neutral-800/70${wide ? ' sm:col-span-2' : ''}`}>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-neutral-400">{label}</dt>
      <dd className="break-words whitespace-pre-wrap text-sm leading-relaxed text-secondary-900 dark:text-neutral-100">
        {hasValue ? displayValue : <span className="italic text-secondary-400 dark:text-neutral-500">Not provided</span>}
      </dd>
    </div>
  );
};

const ReviewGroup = ({ title, children }) => (
  <div className="mt-5 first:mt-0">
    <h5 className="mb-2 text-sm font-semibold text-secondary-700 dark:text-neutral-200">{title}</h5>
    <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</dl>
  </div>
);

const ReviewStep = ({ formData, onEdit, steps = [], recordType, revisionNotes = null, isRevision = false, onValidationStateChange = () => {} }) => {
  const registry = formData.catalogRegistry || {};
  const getCatalogName = (domain, id) => resolveCatalogLabel(null, id, registry?.[domain] || {}) || `Unresolved choice (${id})`;
  const selectedMap = (selection, domain) => Object.entries(selection || {}).filter(([, selected]) => selected).map(([id]) => getCatalogName(domain, id));
  const selectedArray = (selection, domain) => (Array.isArray(selection) ? selection : []).map((id) => getCatalogName(domain, id));
  const personalRows = {
    'First Name': formData.firstName,
    'Last Name': formData.lastName,
    'Middle Initial': formData.middleInitial,
    'Student ID': formData.studentId,
    'Program': formData.program,
    'Age': formData.age,
    'School Year': formData.schoolYear,
    'Sex': formData.sex,
    'Home Address': formData.homeAddress,
    'Boarding Address': formData.boardingAddress,
    'Contact Number': formData.contactNumber,
    'Email': formData.email,
    'Civil Status': formData.civilStatus,
    'Emergency Contact 1': formData.emergencyContact1Name ? `${formData.emergencyContact1Name}; ${formData.emergencyContact1Relationship}; ${formData.emergencyContact1Number}; ${formData.emergencyContact1Address || 'Address not provided'}` : undefined,
    'Emergency Contact 2': formData.emergencyContact2Name ? `${formData.emergencyContact2Name}; ${formData.emergencyContact2Relationship}; ${formData.emergencyContact2Number}; ${formData.emergencyContact2Address || 'Address not provided'}` : undefined,
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
  const medications = selectedMap(formData.selectedMedications, 'medications');
  const medicalRows = {
    'Your medical conditions': selfConditions.join(', ') || 'None reported',
    'Family medical conditions': familyConditions.join('; ') || 'None reported',
    'Allergies': formData.hasAllergies,
    'Selected allergies': allergies.join('; ') || 'None selected',
    'Allergy details': formData.allergiesDetail,
    'Allergy notes': formData.allergiesNotes,
    'Immunizations': vaccines.join('; ') || 'None selected',
    'Hospitalizations': formData.hasHospitalizations,
    'Hospitalization history': hospitals.join('; ') || 'None selected',
    'Hospitalization notes': formData.hospitalizationNotes,
    'Surgeries': formData.hasSurgeries,
    'Operations': operations.join('; ') || 'None selected',
    'Surgery notes': formData.surgeryNotes,
    'Medications': formData.hasMedications,
    'Selected medications': medications.join(', ') || 'None selected',
    'Medication notes': formData.medicationNotes,
    'Smoker': formData.smoker,
    'Cigarettes per day': formData.smoker === 'yes' ? formData.smokerSticksPerDay : undefined,
    'Years smoking': formData.smoker === 'yes' ? formData.smokerYears : undefined,
    'Alcohol use': formData.alcoholDrinker,
    'Alcohol frequency': formData.alcoholDrinker === 'yes' ? formData.alcoholFrequency : undefined,
    'Vaping': formData.vaper,
    'Vape type': formData.vaper === 'yes' ? formData.vapeType : undefined,
    'Vape frequency': formData.vaper === 'yes' ? formData.vapeFrequency : undefined,
    'Visual acuity': formData.visualAcuity,
    'Right eye': formData.visualAcuity === 'yes' ? formData.rightEye : undefined,
    'Left eye': formData.visualAcuity === 'yes' ? formData.leftEye : undefined,
    'Visual acuity notes': formData.visualAcuityNotes,
    'Last menstrual period': formData.sex === 'Female' ? formatReviewDate(formData.lastMenstrualPeriod) : undefined,
    'Dysmenorrhea': formData.sex === 'Female' ? formData.dysmenorrhea : undefined,
  };
  const appliances = (formData.oralAppliances || []).map((item, index) => `Appliance ${index + 1}: ${getCatalogName('oralAppliances', item.tagId)}; location: ${item.arch || 'Not provided'}; status: ${item.status || 'Not provided'}; issued: ${formatReviewDate(item.dateIssued) || 'Not provided'}`);
  const procedures = (formData.dentalProcedures || []).map((item) => `${getCatalogName('dentalProcedures', item.procedureTypeId)} (${formatReviewDate(item.procedureDate) || 'Date not provided'})`);
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
  const unresolvedSelections = activeSelections.filter(([domain, id]) => !/^[1-9]\d*$/.test(String(id ?? '')) || !resolveCatalogLabel(null, id, registry?.[domain] || {}));
  useEffect(() => onValidationStateChange(unresolvedSelections.length > 0), [unresolvedSelections.length, onValidationStateChange]);
  const dentalRows = {
    'Visited a dentist': formData.seenByDentist,
    'Last dental cleaning': formData.lastDentalCleaning,
    'Last visit date': formData.lastVisitDate,
    'Purpose of last visit': formData.purpose,
    'Intraoral appliances': formData.hasOralAppliances,
    'Appliances': appliances.join('; ') || (formData.hasOralAppliances === false ? 'None reported' : undefined),
    'Dental procedures': procedures.join('; ') || 'None selected',
    'Upper teeth photo': formData.upperTeethPhoto?.name || (formData.upperTeethPhoto ? 'Uploaded' : 'Not uploaded'),
    'Lower teeth photo': formData.lowerTeethPhoto?.name || (formData.lowerTeethPhoto ? 'Uploaded' : 'Not uploaded'),
  };
  const stepIndex = (name) => steps.indexOf(name);
  const renderRows = (rows, labels) => labels.map((label) => (
    <ReviewField key={label} label={label} value={rows[label]} wide={['Emergency Contact 1', 'Emergency Contact 2', 'Selected allergies', 'Allergy details', 'Immunizations', 'Hospitalization history', 'Operations', 'Selected medications', 'Dental procedures', 'Appliances'].includes(label)} />
  ));

  return (
    <div className="space-y-6">
      {isRevision && revisionNotes && <div className="rounded-xl border-l-4 border-accent-500 bg-accent-50 p-4"><strong>Staff feedback</strong><p className="whitespace-pre-wrap">{revisionNotes}</p></div>}
      {steps.includes('Personal Info') && <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 sm:p-6"><ReviewSectionHeader title="Personal Information" onEditClick={() => onEdit(stepIndex('Personal Info'))} />
        <ReviewGroup title="Basic details">{renderRows(personalRows, ['First Name', 'Last Name', 'Middle Initial', 'Student ID', 'Program', 'Age', 'School Year', 'Sex'])}</ReviewGroup>
        <ReviewGroup title="Contact information">{renderRows(personalRows, ['Home Address', 'Boarding Address', 'Contact Number', 'Email', 'Civil Status', 'Emergency Contact 1', 'Emergency Contact 2'])}</ReviewGroup>
      </section>}
      {unresolvedSelections.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">Some selected catalog choices cannot be identified. Edit the affected section before submitting.<div className="mt-2 flex gap-3">{unresolvedSelections.some(([domain]) => domain === 'medicalConditions' || domain === 'allergens' || domain === 'immunizations' || domain === 'hospitalizations' || domain === 'operations' || domain === 'medications') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Medical History'))}>Edit Medical History</button>}{unresolvedSelections.some(([domain]) => domain === 'dentalProcedures' || domain === 'oralAppliances') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Dental History'))}>Edit Dental History</button>}</div></div>}
      {(recordType === 'medical' || recordType === 'both') && <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 sm:p-6"><ReviewSectionHeader title="Medical History" onEditClick={() => onEdit(stepIndex('Medical History'))} />
        <ReviewGroup title="Conditions">{renderRows(medicalRows, ['Your medical conditions', 'Family medical conditions'])}</ReviewGroup>
        <ReviewGroup title="Allergies & immunizations">{renderRows(medicalRows, ['Allergies', 'Selected allergies', 'Allergy details', 'Immunizations'])}<ReviewNote label="Allergy notes" value={formData.allergiesNotes} /></ReviewGroup>
        <ReviewGroup title="Hospitalizations & operations">{renderRows(medicalRows, ['Hospitalizations', 'Hospitalization history', 'Surgeries', 'Operations'])}<ReviewNote label="Hospitalization notes" value={formData.hospitalizationNotes} /><ReviewNote label="Surgery notes" value={formData.surgeryNotes} /></ReviewGroup>
        <ReviewGroup title="Medications">{renderRows(medicalRows, ['Medications', 'Selected medications'])}<ReviewNote label="Medication notes" value={formData.medicationNotes} /></ReviewGroup>
        <ReviewGroup title="Daily habits & vision">{renderRows(medicalRows, ['Smoker', 'Cigarettes per day', 'Years smoking', 'Alcohol use', 'Alcohol frequency', 'Vaping', 'Vape type', 'Vape frequency', 'Visual acuity', 'Right eye', 'Left eye', 'Last menstrual period', 'Dysmenorrhea'])}<ReviewNote label="Visual acuity notes" value={formData.visualAcuityNotes} /></ReviewGroup>
      </section>}
      {(recordType === 'dental' || recordType === 'both') && <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 sm:p-6"><ReviewSectionHeader title="Dental History" onEditClick={() => onEdit(stepIndex('Dental History'))} />
        <ReviewGroup title="Dental visits">{renderRows(dentalRows, ['Visited a dentist', 'Last dental cleaning', 'Last visit date', 'Purpose of last visit'])}</ReviewGroup>
        <ReviewGroup title="Appliances & procedures">{renderRows(dentalRows, ['Intraoral appliances', 'Appliances', 'Dental procedures'])}</ReviewGroup>
        <ReviewGroup title="Photos">{renderRows(dentalRows, ['Upper teeth photo', 'Lower teeth photo'])}</ReviewGroup>
        {formData.upperTeethPhoto?.preview && <img className="mt-3 max-w-xs rounded border" src={formData.upperTeethPhoto.preview} alt="Upper teeth preview" />}
        {formData.lowerTeethPhoto?.preview && <img className="mt-3 max-w-xs rounded border" src={formData.lowerTeethPhoto.preview} alt="Lower teeth preview" />}
      </section>}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4"><strong>Before submitting</strong><p>Review each section and edit any details that need correction.</p></div>
    </div>
  );
};

export default ReviewStep;
