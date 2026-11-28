import React, { useEffect } from 'react';
import { ReviewSectionHeader, ReviewDataRow, ReviewNote, resolveCatalogLabel, formatReviewDate } from '../initial-record/review-components';

const ReviewGroup = ({ title, children }) => (
  <div className="medical-review-group"><h5>{title}</h5><dl className="space-y-1">{children}</dl></div>
);
const ReviewList = ({ items }) => items.length ? <ul className="space-y-2">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : 'None reported';

const ReviewStep = ({ formData, onEdit, steps = [], recordType, revisionNotes = null, isRevision = false, onValidationStateChange = () => {} }) => {
  const registry = formData.catalogRegistry || {};
  const getCatalogName = (domain, id) => resolveCatalogLabel(null, id, registry?.[domain] || {}) || `Unresolved choice (${id})`;
  const selectedMap = (selection, domain) => Object.entries(selection || {}).filter(([, selected]) => selected).map(([id]) => getCatalogName(domain, id));
  const selectedArray = (selection, domain) => (Array.isArray(selection) ? selection : []).map((id) => getCatalogName(domain, id));
  const isEmployee = formData.profileType === 'Employee';
  const personalRows = {
    'Full Name': [formData.personalInfo?.lastName, formData.personalInfo?.firstName, formData.personalInfo?.middleName].filter(Boolean).join(', '),
    'Birthday': formatReviewDate(formData.personalInfo?.birthday),
    'Age': formData.personalInfo?.age,
    'Gender': formData.personalInfo?.sex,
    'Civil Status': formData.personalInfo?.civilStatus,
    'Nationality': formData.personalInfo?.nationality,
    'Religion': formData.personalInfo?.religion,
    'Present Address': formData.personalInfo?.address,
    'Province Address': formData.personalInfo?.provinceAddress,
    'Contact Number': formData.personalInfo?.contactNumber,
    'Email': formData.personalInfo?.email,
    'Suffix': formData.personalInfo?.suffix,
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
  const medicalRows = {
    'Your medical conditions': <ReviewList items={selfConditions} />,
    'Family medical conditions': <ReviewList items={familyConditions} />,
    'Allergies': formData.hasAllergies,
    'Selected allergies': <ReviewList items={allergies} />,
    'Allergy details': formData.allergiesDetail,
    'Allergy notes': formData.allergiesNotes,
    'Immunizations': <ReviewList items={vaccines} />,
    'Hospitalizations': formData.hasHospitalizations,
    'Hospitalization history': <ReviewList items={hospitals} />,
    'Hospitalization notes': formData.hospitalizationNotes,
    'Surgeries': formData.hasSurgeries,
    'Operations': <ReviewList items={operations} />,
    'Surgery notes': formData.surgeryNotes,
    'Medications': formData.hasMedications,
    'Selected medications': <ReviewList items={medications} />,
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
    'Visual acuity type': formData.acuityId ? getCatalogName('visualAcuity', formData.acuityId) : undefined,
    'Right eye': formData.visualAcuity === 'yes' ? formData.rightEye : undefined,
    'Left eye': formData.visualAcuity === 'yes' ? formData.leftEye : undefined,
    'Years vaping': formData.yearsVaping,
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
    'Appliances': <ReviewList items={appliances} />,
    'Dental procedures': <ReviewList items={procedures} />,
    'Upper teeth photo': formData.upperTeethPhoto?.name || (formData.upperTeethPhoto ? 'Uploaded' : 'Not uploaded'),
    'Lower teeth photo': formData.lowerTeethPhoto?.name || (formData.lowerTeethPhoto ? 'Uploaded' : 'Not uploaded'),
  };
  const stepIndex = (name) => steps.indexOf(name);
  const renderRows = (rows, labels) => labels.map(label => <ReviewDataRow key={label} label={label} value={rows[label]} />);
  const medicalEdit = () => onEdit(stepIndex('Medical History'));
  const dentalEdit = () => onEdit(stepIndex('Dental History'));

  return (
    <div className="space-y-6">
      {steps.includes('Personal Info') && <>
        <section className="form-section">
          <ReviewSectionHeader title="Personal Information" />
          <dl className="space-y-1">{renderRows(personalRows, ['Full Name', 'Birthday', 'Age', 'Gender', 'Civil Status', 'Nationality', 'Religion', 'Present Address', 'Province Address', 'Contact Number', 'Email', 'Suffix'])}</dl>
        </section>
        <section className="form-section">
          <ReviewSectionHeader title={isEmployee ? 'Employment Information' : 'School Information'} onEditClick={() => onEdit(stepIndex('Personal Info'))} />
          <dl className="space-y-1">{renderRows(personalRows, isEmployee ? ['Department', 'Employment Category', 'Position'] : ['Program', 'Student Category'])}</dl>
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
            <ReviewGroup title="Yourself">{renderRows(medicalRows, ['Your medical conditions'])}</ReviewGroup>
            <ReviewGroup title="Family">{renderRows(medicalRows, ['Family medical conditions'])}</ReviewGroup>
          </div>
        </section>
        <section className="form-section">
          <ReviewSectionHeader title="Medical Background" onEditClick={medicalEdit} />
          <div className="medical-review-groups">
            <ReviewGroup title="Immunization & Vaccines">{renderRows(medicalRows, ['Immunizations'])}</ReviewGroup>
            <ReviewGroup title="History of Allergies">{renderRows(medicalRows, ['Allergies'])}{formData.hasAllergies === 'yes' && renderRows(medicalRows, ['Selected allergies'])}<ReviewNote label="Allergy details" value={formData.allergiesDetail} /><ReviewNote label="Allergy notes" value={formData.allergiesNotes} /></ReviewGroup>
            <ReviewGroup title="History of Hospitalizations">{renderRows(medicalRows, ['Hospitalizations'])}{formData.hasHospitalizations === 'yes' && renderRows(medicalRows, ['Hospitalization history'])}<ReviewNote label="Hospitalization notes" value={formData.hospitalizationNotes} /></ReviewGroup>
            <ReviewGroup title="History of Operation">{renderRows(medicalRows, ['Surgeries'])}{formData.hasSurgeries === 'yes' && renderRows(medicalRows, ['Operations'])}<ReviewNote label="Surgery notes" value={formData.surgeryNotes} /></ReviewGroup>
            <ReviewGroup title="Medications">{renderRows(medicalRows, ['Medications'])}{formData.hasMedications === 'yes' && renderRows(medicalRows, ['Selected medications'])}<ReviewNote label="Medication notes" value={formData.medicationNotes} /></ReviewGroup>
            <ReviewGroup title="Lifestyle">{renderRows(medicalRows, ['Smoker', ...(formData.smoker === 'yes' ? ['Cigarettes per day', 'Years smoking'] : []), 'Alcohol use', ...(formData.alcoholDrinker === 'yes' ? ['Alcohol frequency'] : []), 'Vaping', ...(formData.vaper === 'yes' ? ['Vape type', 'Vape frequency', 'Years vaping'] : [])])}</ReviewGroup>
            <ReviewGroup title="Visual Acuity">{renderRows(medicalRows, ['Visual acuity', ...(formData.visualAcuity === 'yes' ? ['Visual acuity type', 'Right eye', 'Left eye'] : [])])}<ReviewNote label="Visual acuity notes" value={formData.visualAcuityNotes} /></ReviewGroup>
          </div>
        </section>
        {formData.sex === 'Female' && <section className="form-section">
          <ReviewSectionHeader title="OB-GYNE History" onEditClick={medicalEdit} />
          <dl className="space-y-1">{renderRows(medicalRows, ['Last menstrual period', 'Menstruation duration', 'Dysmenorrhea'])}</dl>
        </section>}
      </>}
      {(recordType === 'dental' || recordType === 'both') && <section className="form-section">
        <ReviewSectionHeader title="Dental History" onEditClick={dentalEdit} />
        <div className="medical-review-groups">
          <ReviewGroup title="Dental visits">{renderRows(dentalRows, ['Visited a dentist', 'Last dental cleaning', 'Last visit date', 'Purpose of last visit'])}</ReviewGroup>
          <ReviewGroup title="Intra-Oral Appliances">{renderRows(dentalRows, ['Intraoral appliances', 'Appliances'])}<ReviewNote label="Other appliance" value={formData.oralApplianceOtherDescription} />{formData.oralApplianceOtherDescription && <ReviewDataRow label="Other appliance location" value={formData.oralApplianceOtherArch} />}<ReviewNote label="Appliance notes" value={formData.oralApplianceNotes} /></ReviewGroup>
          <ReviewGroup title="Dental Procedures">{renderRows(dentalRows, ['Dental procedures'])}<ReviewNote label="Procedure notes" value={formData.dentalProcedureNotes} /></ReviewGroup>
          <ReviewGroup title="Dental Photos">{renderRows(dentalRows, ['Upper teeth photo', 'Lower teeth photo'])}
            {formData.upperTeethPhoto?.preview && <img className="mt-3 max-w-full sm:max-w-xs rounded border" src={formData.upperTeethPhoto.preview} alt="Upper teeth preview" />}
            {formData.lowerTeethPhoto?.preview && <img className="mt-3 max-w-full sm:max-w-xs rounded border" src={formData.lowerTeethPhoto.preview} alt="Lower teeth preview" />}
          </ReviewGroup>
        </div>
      </section>}
      <div className="form-section"><p>Review each section and edit any details that need correction before submitting.</p></div>
    </div>
  );
};

export default ReviewStep;
