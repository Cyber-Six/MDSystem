import React from 'react';

const ReviewStep = ({ formData, onEdit, recordType, revisionNotes = null, isRevision = false }) => {
  const SectionHeader = ({ title, onEditClick }) => (
    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-primary-500">
      <h4 className="text-lg font-heading font-semibold text-secondary-800 dark:text-white">{title}</h4>
      <button
        type="button"
        onClick={onEditClick}
        className="text-sm text-primary-600 dark:text-primary-500 hover:text-primary-700 font-semibold flex items-center gap-1.5 
                   transition-all duration-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 px-3 py-1.5 rounded-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
    </div>
  );

  const DataRow = ({ label, value }) => {
    if (!value || value === '' || value === 'Not provided') return null;
    return (
      <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150 px-2 -mx-2 rounded">
        <dt className="font-medium text-secondary-700 dark:text-primary-500">{label}</dt>
        <dd className="col-span-2 text-secondary-800 dark:text-neutral-200">{value}</dd>
      </div>
    );
  };

  const personalInfo = {
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
    'Emergency Contact 1': formData.emergencyContact1Name 
      ? `${formData.emergencyContact1Name} (${formData.emergencyContact1Relationship}) - ${formData.emergencyContact1Number}`
      : null,
    'Emergency Contact 2': formData.emergencyContact2Name
      ? `${formData.emergencyContact2Name} (${formData.emergencyContact2Relationship}) - ${formData.emergencyContact2Number}`
      : null
  };

  const selfConditionsList = formData.selfConditions
    ? Object.entries(formData.selfConditions).filter(([_, v]) => v).map(([k]) => k).join(', ')
    : null;
  const familyConditionsList = formData.familyConditions
    ? Object.entries(formData.familyConditions)
        .filter(([_, v]) => v?.checked)
        .map(([k, v]) => v.relationship ? `${k} (${v.relationship})` : k)
        .join(', ')
    : null;

  const medicalHistory = {
    'Self Conditions': selfConditionsList,
    'Family Conditions': familyConditionsList,
    'Allergies': formData.hasAllergies,
    'Allergy Notes': formData.allergiesNotes,
    'Smoker': formData.smoker,
    'Alcohol Drinker': formData.alcoholDrinker,
    'Alcohol Frequency': formData.alcoholDrinker === 'yes' ? (formData.alcoholFrequency || null) : null,
    'Vaper': formData.vaper,
    'Visual Acuity': formData.visualAcuity,
    ...(formData.sex === 'Female' && {
      'Last Menstrual Period': formData.lastMenstrualPeriod,
      'Dysmenorrhea': formData.dysmenorrhea
    }),
    'Immunizations': Array.isArray(formData.immunizations) && formData.immunizations.length > 0
      ? formData.immunizations.join(', ') : null,
    'Hospitalizations': formData.hasHospitalizations,
    'Hospitalization Notes': formData.hospitalizationNotes,
    'Surgeries': formData.hasSurgeries,
    'Surgery Notes': formData.surgeryNotes,
    'Current Medications': formData.hasMedications,
    'Medication Notes': formData.medicationNotes
  };

  const dentalHistory = {
    'Visited Dentist': formData.seenByDentist === true ? 'Yes' : formData.seenByDentist === false ? 'No' : null,
    'Purpose of Last Visit': formData.purpose,
    'Last Cleaning': formData.lastDentalCleaning,
    'Intraoral Appliances': formData.hasOralAppliances === true ? 'Yes' : formData.hasOralAppliances === false ? 'No' : null,
    'Appliance Count': formData.oralAppliances?.length > 0 ? `${formData.oralAppliances.length} appliance(s) added` : null,
    'Dental Procedures': formData.dentalProcedures?.length > 0
      ? `${formData.dentalProcedures.length} procedure(s) selected`
      : null
  };

  // Calculate correct step indices based on recordType
  const getStepIndex = (section) => {
    if (section === 'personal') return 0;
    if (section === 'medical') {
      // Medical is always at index 1 if it exists
      return 1;
    }
    if (section === 'dental') {
      // Dental is at index 1 if recordType is 'dental', otherwise index 2
      return recordType === 'dental' ? 1 : 2;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Revision Notes Banner - Show if this is a revision resubmission */}
      {isRevision && revisionNotes && (
        <div className="bg-accent-50 dark:bg-accent-900/20 border-l-4 border-accent-500 rounded-xl p-4 flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-accent-600 dark:text-accent-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent-900 dark:text-accent-200 mb-2">
              Staff Feedback on Your Revision:
            </p>
            <p className="text-sm text-accent-800 dark:text-accent-300 whitespace-pre-wrap mb-0">
              {revisionNotes}
            </p>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
        <SectionHeader title="Personal Information" onEditClick={() => onEdit(getStepIndex('personal'))} />
        <dl className="space-y-1">
          {Object.entries(personalInfo).map(([label, value]) => (
            <DataRow key={label} label={label} value={value} />
          ))}
        </dl>
      </div>

      {/* Medical History - Only show if recordType is 'medical' or 'both' */}
      {(recordType === 'medical' || recordType === 'both') && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
          <SectionHeader title="Medical History" onEditClick={() => onEdit(getStepIndex('medical'))} />
          <dl className="space-y-1">
            {Object.entries(medicalHistory).map(([label, value]) => (
              <DataRow key={label} label={label} value={value} />
            ))}
          </dl>
        </div>
      )}

      {/* Dental History - Only show if recordType is 'dental' or 'both' */}
      {(recordType === 'dental' || recordType === 'both') && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
          <SectionHeader title="Dental History" onEditClick={() => onEdit(getStepIndex('dental'))} />
          <dl className="space-y-1">
            {Object.entries(dentalHistory).map(([label, value]) => (
              <DataRow key={label} label={label} value={value} />
            ))}
          </dl>
        </div>
      )}

      <div className="p-4 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary-800 dark:text-white">
              Important Information
            </p>
            <p className="text-sm text-secondary-600 dark:text-neutral-400 mt-1">
              By submitting this form, you confirm that all the information provided is accurate and up-to-date. 
              This information will be used for medical purposes and kept confidential according to our privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewStep;
