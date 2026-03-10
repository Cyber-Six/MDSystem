import React from 'react';
import { Checkbox, Input } from '../medical/form-elements';

const EmployeeReviewForm = ({ formData, onEdit, certification, onCertificationChange }) => {
  const handleCertificationChange = (field, value) => {
    onCertificationChange({ ...certification, [field]: value });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const SectionHeader = ({ title, onEditClick }) => (
    <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-primary-400">
      <h4 className="text-lg font-heading font-semibold text-secondary-900">{title}</h4>
      <button
        type="button"
        onClick={onEditClick}
        className="text-sm text-primary-700 hover:text-primary-800 font-semibold flex items-center transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
    </div>
  );

  const DataRow = ({ label, value }) => {
    if (!value || value === '' || value === 'Not provided') return null;
    return (
      <div className="grid grid-cols-3 gap-4 py-2 border-b border-neutral-100">
        <dt className="font-medium text-secondary-600">{label}</dt>
        <dd className="col-span-2 text-secondary-900">{value}</dd>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="form-section">
        <SectionHeader title="Personal Information" onEditClick={() => onEdit(0)} />
        <dl className="space-y-1">
          <DataRow label="Full Name" value={`${formData.personalInfo?.surname || ''}${formData.personalInfo?.surname ? ', ' : ''}${formData.personalInfo?.firstName || ''} ${formData.personalInfo?.middleName || ''}`.trim()} />
          <DataRow label="Employee ID" value={formData.personalInfo?.employeeId} />
          <DataRow label="Birthday" value={formatDate(formData.personalInfo?.birthday)} />
          <DataRow label="Age" value={formData.personalInfo?.age} />
          <DataRow label="Gender" value={formData.personalInfo?.gender} />
          <DataRow label="Civil Status" value={formData.personalInfo?.civilStatus} />
          <DataRow label="Nationality" value={formData.personalInfo?.nationality} />
          <DataRow label="Religion" value={formData.personalInfo?.religion} />
          <DataRow label="Address" value={formData.personalInfo?.address} />
          <DataRow label="Contact Number" value={formData.personalInfo?.contactNumber} />
          <DataRow label="Email" value={formData.personalInfo?.activeEmail} />
        </dl>
      </div>

      {/* Employment Information */}
      <div className="form-section">
        <SectionHeader title="Employment Information" onEditClick={() => onEdit(0)} />
        <dl className="space-y-1">
          <DataRow label="Department" value={formData.personalInfo?.department} />
          <DataRow 
            label="Employment Category" 
            value={formData.personalInfo?.employmentCategory === 'Other' 
              ? formData.personalInfo?.employmentCategoryOther 
              : formData.personalInfo?.employmentCategory
            } 
          />
          <DataRow label="Employment Status" value={formData.personalInfo?.employmentStatus} />
          <DataRow label="Position" value={formData.personalInfo?.position} />
          <DataRow label="Campus Branch" value={formData.personalInfo?.branch === 'QuezonCity' ? 'Quezon City' : formData.personalInfo?.branch} />
        </dl>
      </div>

      {/* Emergency Contacts */}
      <div className="form-section">
        <SectionHeader title="Emergency Contact Information" onEditClick={() => onEdit(0)} />
        {formData.personalInfo?.emergencyContacts?.map((contact, index) => {
          if (!contact?.name?.trim()) return null; // skip empty optional contacts
          return (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              {index === 1 && (
                <p className="text-xs font-semibold text-secondary-500 mb-2">Additional Contact</p>
              )}
              <dl className="space-y-1">
                <DataRow label="Person/s to be Contacted" value={contact.name} />
                <DataRow label="Relationship" value={contact.relationship} />
                <DataRow label="Address of Contact Person" value={contact.address} />
                <DataRow label="Contact Number During Emergency" value={contact.contactNumber} />
              </dl>
            </div>
          );
        })}
      </div>

      {/* Medical History - Self */}
      <div className="form-section">
        <SectionHeader title="Medical History (Yourself)" onEditClick={() => onEdit(1)} />
        <div className="flex flex-wrap gap-2">
          {formData.medicalHistory?.self && Object.entries(formData.medicalHistory.self).filter(([_, value]) => value).length > 0 ? (
            Object.entries(formData.medicalHistory.self)
              .filter(([_, value]) => value)
              .map(([key, _]) => (
                <span key={key} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-error-100 text-error-800 font-medium">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              ))
          ) : (
            <p className="text-secondary-500 text-sm">No conditions reported</p>
          )}
        </div>
      </div>

      {/* Medical History - Family */}
      <div className="form-section">
        <SectionHeader title="Medical History (Family)" onEditClick={() => onEdit(1)} />
        {formData.medicalHistory?.family && Object.keys(formData.medicalHistory.family).length > 0 ? (
          <dl className="space-y-2">
            {Object.entries(formData.medicalHistory.family).map(([condition, data]) => (
              <DataRow
                key={condition}
                label={condition.replace(/([A-Z])/g, ' $1').trim()}
                value={data.relationship}
              />
            ))}
          </dl>
        ) : (
          <p className="text-secondary-500 text-sm">No family conditions reported</p>
        )}
      </div>

      {/* Medical Background */}
      <div className="form-section">
        <SectionHeader title="Medical Background" onEditClick={() => onEdit(2)} />
        
        {/* Immunizations */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-secondary-700 mb-2">Immunizations</h5>
          <div className="flex flex-wrap gap-2">
            {formData.medicalBackground?.immunizations && Object.entries(formData.medicalBackground.immunizations).filter(([_, value]) => value).length > 0 ? (
              Object.entries(formData.medicalBackground.immunizations)
                .filter(([_, value]) => value)
                .map(([key, _]) => (
                  <span key={key} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-success-100 text-success-800 font-medium">
                    {key.toUpperCase()}
                  </span>
                ))
            ) : (
              <p className="text-secondary-500 text-sm">None reported</p>
            )}
          </div>
        </div>

        <dl className="space-y-1">
          <DataRow label="Allergies" value={formData.medicalBackground?.hasAllergies} />
          <DataRow label="Hospitalizations" value={formData.medicalBackground?.hasHospitalization} />
          <DataRow label="Operations" value={formData.medicalBackground?.hasOperation} />
          <DataRow label="Medications" value={formData.medicalBackground?.hasMedications} />
          <DataRow label="Smoker" value={formData.medicalBackground?.smoker === 'yes' ? `Yes (${formData.medicalBackground?.smokerSticksPerDay || 0} sticks/day, ${formData.medicalBackground?.smokerYears || 0} years)` : 'No'} />
          <DataRow label="Alcohol Drinker" value={formData.medicalBackground?.alcoholDrinker === 'yes' ? `Yes (${formData.medicalBackground?.alcoholFrequency || 'Not specified'})` : 'No'} />
          <DataRow label="Eyeglasses" value={formData.medicalBackground?.eyeglasses ? 'Yes' : 'No'} />
          <DataRow label="Contact Lenses" value={formData.medicalBackground?.contactLenses ? 'Yes' : 'No'} />
          {(formData.medicalBackground?.eyeglasses || formData.medicalBackground?.contactLenses) && (
            <>
              <DataRow label="Grade OD" value={formData.medicalBackground?.gradeOD} />
              <DataRow label="Grade OS" value={formData.medicalBackground?.gradeOS} />
              <DataRow label="Visual Acuity Date" value={formatDate(formData.medicalBackground?.visualAcuityDate)} />
            </>
          )}
        </dl>
      </div>

      {/* Dental History */}
      <div className="form-section">
        <SectionHeader title="Dental History" onEditClick={() => onEdit(3)} />
        <dl className="space-y-1">
          <DataRow label="First Time Dentist" value={formData.dentalHistory?.firstTimeDentist === 'yes' ? 'Yes' : formData.dentalHistory?.firstTimeDentist === 'no' ? 'No' : ''} />
          <DataRow label="Last Dental Cleaning" value={formData.dentalHistory?.lastDentalCleaning} />
          <DataRow label="Intra-Oral Appliance" value={formData.dentalHistory?.hasIntraOralAppliance === 'yes' ? 'Yes' : formData.dentalHistory?.hasIntraOralAppliance === 'no' ? 'No' : ''} />
          <DataRow label="Tooth Extraction (past 24 months)" value={formData.dentalHistory?.toothExtraction === 'yes' ? 'Yes' : formData.dentalHistory?.toothExtraction === 'no' ? 'No' : ''} />
          <DataRow label="Dental Filling (past 24 months)" value={formData.dentalHistory?.dentalFilling === 'yes' ? 'Yes' : formData.dentalHistory?.dentalFilling === 'no' ? 'No' : ''} />
          <DataRow label="Upper Teeth Photo" value={formData.dentalHistory?.upperTeethPhoto ? 'Uploaded' : 'Not uploaded'} />
          <DataRow label="Lower Teeth Photo" value={formData.dentalHistory?.lowerTeethPhoto ? 'Uploaded' : 'Not uploaded'} />
        </dl>
      </div>

      {/* OB-GYNE History (if female) */}
      {formData.personalInfo?.gender === 'Female' && (
        <div className="form-section">
          <SectionHeader title="OB-GYNE History" onEditClick={() => onEdit(4)} />
          <dl className="space-y-1">
            <DataRow label="Last Menstrual Period" value={formatDate(formData.obgyne?.lastMenstrualPeriod)} />
            <DataRow label="Menarche Year/Age" value={formData.obgyne?.menarcheYearAge} />
            <DataRow label="Menstruation Duration" value={formData.obgyne?.menstruationDuration ? `${formData.obgyne.menstruationDuration} days` : ''} />
            <DataRow label="Pads Per Day" value={formData.obgyne?.padsPerDay} />
            <DataRow label="Dysmenorrhea" value={formData.obgyne?.dysmenorrhea} />
          </dl>
        </div>
      )}

      {/* Certification */}
      <div className="form-section bg-primary-50 border-2 border-primary-300">
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Certification
        </h3>

        <div className="bg-white p-4 rounded-xl mb-4 border border-primary-200">
          <Checkbox
            label={
              <span className="text-sm text-secondary-700">
                I certify that the above information is <strong>true and correct</strong> to the best of my knowledge.
              </span>
            }
            checked={certification.verified || false}
            onChange={(e) => handleCertificationChange('verified', e.target.checked)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={certification.fullName || `${formData.personalInfo?.surname || ''}${formData.personalInfo?.surname ? ', ' : ''}${formData.personalInfo?.firstName || ''} ${formData.personalInfo?.middleName || ''}`.trim()}
            onChange={(e) => handleCertificationChange('fullName', e.target.value)}
            placeholder="Enter your full name"
          />
          <Input
            label="Date"
            type="date"
            value={certification.date || new Date().toISOString().split('T')[0]}
            onChange={(e) => handleCertificationChange('date', e.target.value)}
          />
        </div>

        <div className="mt-4">
          <Input
            label="Signature (Type your full name)"
            value={certification.signature || ''}
            onChange={(e) => handleCertificationChange('signature', e.target.value)}
            placeholder="Type your full name as signature"
          />
        </div>
      </div>
    </div>
  );
};

export default EmployeeReviewForm;
