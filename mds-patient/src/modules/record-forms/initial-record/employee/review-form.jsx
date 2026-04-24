import React from 'react';
import { Checkbox, Input } from '../medical/form-elements';

const EmployeeReviewForm = ({ formData, onEdit, certification, onCertificationChange, catalogs = {}, fieldErrors = {}, onClearFieldError = () => {} }) => {
  const handleCertificationChange = (field, value) => {
    onClearFieldError(field);
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

  const getCatalogName = (catalog, id) => {
    if (!catalog || id === undefined || id === null) return String(id ?? '');
    const item = catalog.find((c) => String(c.id) === String(id));
    return item?.name || String(id);
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
      {/* Error Banner */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-orange-800 mb-0.5">Issues:</h3>
              <ul className="text-xs text-orange-700 space-y-0">
                {Object.entries(fieldErrors).map(([field, error]) => (
                  <li key={field} className="flex items-start">
                    <span className="mr-1.5 flex-shrink-0">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
                  <span key={key} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-success-100 text-success-800 font-medium">
                    {getCatalogName(catalogs?.immunizationCatalog, key)}
                    {formData.medicalBackground?.immunizationDates?.[key] && (
                      <span className="text-xs opacity-70">({formatDate(formData.medicalBackground.immunizationDates[key])})</span>
                    )}
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
          {formData.medicalBackground?.hasHospitalization === 'Yes' &&
            Object.entries(formData.medicalBackground?.hospitalizationConditions || {})
              .filter(([, v]) => v)
              .map(([id]) => (
                <DataRow
                  key={id}
                  label={getCatalogName(catalogs?.hospitalizationCatalog, id)}
                  value={[
                    formData.medicalBackground?.hospitalizationDates?.[id]?.admissionDate
                      ? `Admitted: ${formatDate(formData.medicalBackground.hospitalizationDates[id].admissionDate)}`
                      : 'Admitted: Not specified',
                    formData.medicalBackground?.hospitalizationDates?.[id]?.dischargeDate
                      ? `Discharged: ${formatDate(formData.medicalBackground.hospitalizationDates[id].dischargeDate)}`
                      : 'Discharged: Not specified',
                  ].join(' | ')}
                />
              ))
          }
          <DataRow label="Operations" value={formData.medicalBackground?.hasOperation} />
          {formData.medicalBackground?.hasOperation === 'Yes' &&
            Object.entries(formData.medicalBackground?.operationConditions || {})
              .filter(([, v]) => v)
              .map(([id]) => (
                <DataRow
                  key={id}
                  label={getCatalogName(catalogs?.operationCatalog, id)}
                  value={formData.medicalBackground?.operationDates?.[id]
                    ? formatDate(formData.medicalBackground.operationDates[id])
                    : 'Date not specified'}
                />
              ))
          }
          <DataRow label="Medications" value={formData.medicalBackground?.hasMedications} />
          <DataRow label="Smoker" value={formData.medicalBackground?.smoker === 'yes' ? `Yes (${formData.medicalBackground?.smokerSticksPerDay || 0} sticks/day, ${formData.medicalBackground?.smokerYears || 0} years)` : 'No'} />
          <DataRow label="Alcohol Drinker" value={formData.medicalBackground?.alcoholDrinker === 'yes' ? `Yes (${formData.medicalBackground?.alcoholFrequency || 'Not specified'})` : 'No'} />
          <DataRow label="Vaper" value={formData.medicalBackground?.vaper === 'yes' ? `Yes (${formData.medicalBackground?.vapeType || 'Not specified'}, ${formData.medicalBackground?.vapeFrequency || 'Not specified'})` : 'No'} />
          <DataRow label="Eyeglasses" value={formData.medicalBackground?.eyeglasses ? 'Yes' : 'No'} />
          <DataRow label="Contact Lenses" value={formData.medicalBackground?.contactLenses ? 'Yes' : 'No'} />
          {(formData.medicalBackground?.eyeglasses || formData.medicalBackground?.contactLenses) && !(formData.medicalBackground?.eyeglasses && formData.medicalBackground?.contactLenses) && (
            <>
              <DataRow label="Grade OD" value={formData.medicalBackground?.gradeOD} />
              <DataRow label="Grade OS" value={formData.medicalBackground?.gradeOS} />
            </>
          )}
          {formData.medicalBackground?.eyeglasses && formData.medicalBackground?.contactLenses && (
            <>
              <DataRow label="Eyeglasses Grade OD" value={formData.medicalBackground?.gradeODEyeglasses || formData.medicalBackground?.gradeOD} />
              <DataRow label="Eyeglasses Grade OS" value={formData.medicalBackground?.gradeOSEyeglasses || formData.medicalBackground?.gradeOS} />
              <DataRow label="Contact Lenses Grade OD" value={formData.medicalBackground?.gradeODContactLenses || formData.medicalBackground?.gradeOD} />
              <DataRow label="Contact Lenses Grade OS" value={formData.medicalBackground?.gradeOSContactLenses || formData.medicalBackground?.gradeOS} />
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
      <div className={`form-section ${fieldErrors.verified ? 'border-4 border-error-500 bg-error-50' : 'bg-primary-50 border-2 border-primary-300'}`}>
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Certification
        </h3>

        {fieldErrors.verified && (
          <div className="mb-4 p-3 bg-error-100 border border-error-500 rounded-lg">
            <p className="text-sm text-error-700 font-semibold">{fieldErrors.verified}</p>
          </div>
        )}

        <div className={`bg-white p-4 rounded-xl ${fieldErrors.verified ? 'border-2 border-error-500' : 'border border-primary-200'}`}>
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
      </div>
    </div>
  );
};

export default EmployeeReviewForm;
