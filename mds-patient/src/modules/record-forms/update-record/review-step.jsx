import React, { useEffect } from 'react';
import { ReviewSectionHeader, ReviewDataRow, resolveCatalogLabel, formatReviewDate } from '../initial-record/review-components';

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
    'Yourself — medical conditions': selfConditions.join(', ') || 'None reported',
    'Family medical conditions': familyConditions.join('; ') || 'None reported',
    'Allergies': formData.hasAllergies,
    'Selected allergies': allergies.join('; ') || 'None selected',
    'Allergy details': formData.allergiesDetail,
    'Allergy notes': formData.allergiesNotes,
    'Immunizations': vaccines.join('; ') || 'None selected',
    'Immunization notes': formData.immunizationNotes,
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
  const renderRows = (rows) => Object.entries(rows).map(([label, value]) => <ReviewDataRow key={label} label={label} value={value} />);

  return (
    <div className="space-y-6">
      {isRevision && revisionNotes && <div className="rounded-xl border-l-4 border-accent-500 bg-accent-50 p-4"><strong>Staff feedback</strong><p className="whitespace-pre-wrap">{revisionNotes}</p></div>}
      {steps.includes('Personal Info') && <section className="rounded-xl border border-neutral-200 bg-white p-6"><ReviewSectionHeader title="Personal Information" onEditClick={() => onEdit(stepIndex('Personal Info'))} /><dl>{renderRows(personalRows)}</dl></section>}
      {unresolvedSelections.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">Some selected catalog choices cannot be identified. Edit the affected section before submitting.<div className="mt-2 flex gap-3">{unresolvedSelections.some(([domain]) => domain === 'medicalConditions' || domain === 'allergens' || domain === 'immunizations' || domain === 'hospitalizations' || domain === 'operations' || domain === 'medications') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Medical History'))}>Edit Medical History</button>}{unresolvedSelections.some(([domain]) => domain === 'dentalProcedures' || domain === 'oralAppliances') && <button type="button" className="underline font-semibold" onClick={() => onEdit(stepIndex('Dental History'))}>Edit Dental History</button>}</div></div>}
      {(recordType === 'medical' || recordType === 'both') && <section className="rounded-xl border border-neutral-200 bg-white p-6"><ReviewSectionHeader title="Medical History" onEditClick={() => onEdit(stepIndex('Medical History'))} /><dl>{renderRows(medicalRows)}</dl></section>}
      {(recordType === 'dental' || recordType === 'both') && <section className="rounded-xl border border-neutral-200 bg-white p-6"><ReviewSectionHeader title="Dental History" onEditClick={() => onEdit(stepIndex('Dental History'))} /><dl>{renderRows(dentalRows)}</dl>
        {formData.upperTeethPhoto?.preview && <img className="mt-3 max-w-xs rounded border" src={formData.upperTeethPhoto.preview} alt="Upper teeth preview" />}
        {formData.lowerTeethPhoto?.preview && <img className="mt-3 max-w-xs rounded border" src={formData.lowerTeethPhoto.preview} alt="Lower teeth preview" />}
      </section>}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4"><strong>Before submitting</strong><p>Review each section and edit any details that need correction.</p></div>
    </div>
  );
};

export default ReviewStep;
