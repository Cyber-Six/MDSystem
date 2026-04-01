import React from 'react';
import { Input, Select } from './form-elements';

const PersonalInfoForm = ({ data, onChange, fieldErrors = {}, onClearFieldError = () => {} }) => {
  const handleChange = (field, value) => {
    // Clear error for this field when user starts typing
    onClearFieldError(field);
    onChange({ ...data, [field]: value });
  };

  const [phoneWarnings, setPhoneWarnings] = React.useState({});

  // Strip non-phone chars and enforce a maximum of 11 digits
  const handlePhone = (fieldKey, rawVal) => {
    const filtered = rawVal.replace(/[^\d+\-\s()]/g, '');
    const digits = filtered.replace(/\D/g, '');
    if (digits.length > 11) {
      let digitCount = 0;
      let result = '';
      for (const char of filtered) {
        if (/\d/.test(char)) {
          if (digitCount >= 11) break;
          digitCount++;
        }
        result += char;
      }
      setPhoneWarnings(prev => ({ ...prev, [fieldKey]: true }));
      return result;
    }
    setPhoneWarnings(prev => ({ ...prev, [fieldKey]: false }));
    return filtered;
  };
  // Strip any character that is not alphanumeric or a dash
  const filterStudentNumber = (val) => val.replace(/[^a-zA-Z0-9\-]/g, '');

  const handleEmergencyContactChange = (index, field, value) => {
    // Clear error for this emergency contact field when user starts typing
    const fieldName = `emergencyContact${index + 1}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    onClearFieldError(fieldName);
    const contacts = [...data.emergencyContacts];
    contacts[index] = { ...contacts[index], [field]: value };
    onChange({ ...data, emergencyContacts: contacts });
  };

  const programOptions = [
    { value: 'AB ENGLISH (COA)', label: 'AB ENGLISH (COA)' },
    { value: 'AB POLITICAL SCIENCE (COA)', label: 'AB POLITICAL SCIENCE (COA)' },
    { value: 'ACT', label: 'ACT' },
    { value: 'ACCOUNTANCY (BSA)', label: 'ACCOUNTANCY (BSA)' },
    { value: 'BS BA ACCOUNTING INFORMATION SYSTEM (AIS) - (CBE)', label: 'BS BA ACCOUNTING INFORMATION SYSTEM (AIS) - (CBE)' },
    { value: 'ARCHITECTURE (CEA)', label: 'ARCHITECTURE (CEA)' },
    { value: 'BS MATHEMATICS', label: 'BS MATHEMATICS' },
    { value: 'BS ACCOUNTANCY (CBE)', label: 'BS ACCOUNTANCY (CBE)' },
    { value: 'BS BUSINESS ADMINISTRATION - FINANCIAL MANAGEMENT (CBE)', label: 'BS BUSINESS ADMINISTRATION - FINANCIAL MANAGEMENT (CBE)' },
    { value: 'BS BUSINESS ADMINISTRATION - HRM (CBE)', label: 'BS BUSINESS ADMINISTRATION - HRM (CBE)' },
    { value: 'BS BUSINESS ADMINISTRATION - LSCM (CBE)', label: 'BS BUSINESS ADMINISTRATION - LSCM (CBE)' },
    { value: 'BS BUSINESS ADMINISTRATION - MARKETING MANAGEMENT (CBE)', label: 'BS BUSINESS ADMINISTRATION - MARKETING MANAGEMENT (CBE)' },
    { value: 'CIVIL ENGINEERING (CEA)', label: 'CIVIL ENGINEERING (CEA)' },
    { value: 'CHEMICAL ENGINEERING (CEA)', label: 'CHEMICAL ENGINEERING (CEA)' },
    { value: 'COMPUTER ENGINEERING (CEA)', label: 'COMPUTER ENGINEERING (CEA)' },
    { value: 'COMPUTER SCIENCE (CCS)', label: 'COMPUTER SCIENCE (CCS)' },
    { value: 'DATA SCIENCE (CCS)', label: 'DATA SCIENCE (CCS)' },
    { value: 'ELECTRICAL ENGINEERING (CEA)', label: 'ELECTRICAL ENGINEERING (CEA)' },
    { value: 'ELECTRONICS AND COMMUNICATION ENGINEERING (CEA)', label: 'ELECTRONICS AND COMMUNICATION ENGINEERING (CEA)' },
    { value: 'EMC-DAT (CCS)', label: 'EMC-DAT (CCS)' },
    { value: 'EMC-GD (CCS)', label: 'EMC-GD (CCS)' },
    { value: 'GRADUATE PROGRAM', label: 'GRADUATE PROGRAM' },
    { value: 'INDUSTRIAL ENGINEERING (CEA)', label: 'INDUSTRIAL ENGINEERING (CEA)' },
    { value: 'INFORMATION SYSTEM (CCS)', label: 'INFORMATION SYSTEM (CCS)' },
    { value: 'INFORMATION TECHNOLOGY (CCS)', label: 'INFORMATION TECHNOLOGY (CCS)' },
    { value: 'MARINE TRANSPORTATION (MARINE)', label: 'MARINE TRANSPORTATION (MARINE)' },
    { value: 'MECHANICAL ENGINEERING (CEA)', label: 'MECHANICAL ENGINEERING (CEA)' },
    { value: 'Other', label: 'Other' },
  ];

  const studentCategoryOptions = [
    { value: 'Freshmen', label: 'Freshmen' },
    { value: 'Freshmen - New student', label: 'Freshmen - New student' },
    { value: 'Transferee', label: 'Transferee' },
    { value: 'Graduate studies (New student)', label: 'Graduate studies (New student)' },
    { value: 'Returnee', label: 'Returnee' },
    { value: 'Old Student', label: 'Old Student' },
    { value: 'Graduate studies (Old student)', label: 'Graduate studies (Old student)' },
  ];

  const calculateAge = (birthday) => {
    if (!birthday) return '';
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  React.useEffect(() => {
    if (data.birthday) {
      const age = calculateAge(data.birthday);
      if (age !== data.age) {
        handleChange('age', age);
      }
    }
  }, [data.birthday]);

  return (
    <div className="space-y-4">
      {/* ── Personal Information Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Surname"
            required
            value={data.surname || ''}
            onChange={(e) => handleChange('surname', e.target.value)}
            placeholder="Enter surname"
            error={fieldErrors.surname}
          />
          <Input
            label="First Name"
            required
            value={data.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter first name"
            error={fieldErrors.firstName}
          />
          <Input
            label="Middle Name"
            value={data.middleName || ''}
            onChange={(e) => handleChange('middleName', e.target.value)}
            placeholder="Enter middle name"
          />
          <Input
            label="Suffix"
            value={data.suffix || ''}
            onChange={(e) => handleChange('suffix', e.target.value)}
            placeholder="e.g., Jr., Sr., III"
          />
          <Input
            label="Birthday"
            type="date"
            required
            value={data.birthday || ''}
            onChange={(e) => handleChange('birthday', e.target.value)}
            error={fieldErrors.birthday}
          />
          <Input
            label="Age"
            type="number"
            value={data.age || ''}
            disabled
            placeholder="Auto-calculated"
          />
          <Select
            label="Gender"
            required
            value={data.gender || ''}
            onChange={(e) => handleChange('gender', e.target.value)}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
            error={fieldErrors.gender}
          />
          <Select
            label="Civil Status"
            required
            value={data.civilStatus || ''}
            onChange={(e) => handleChange('civilStatus', e.target.value)}
            options={[
              { value: 'Single', label: 'Single' },
              { value: 'Married', label: 'Married' },
              { value: 'Widowed', label: 'Widowed' },
              { value: 'Separated', label: 'Separated' },
            ]}
            error={fieldErrors.civilStatus}
          />
          <Input
            label="Nationality"
            required
            value={data.nationality || ''}
            onChange={(e) => handleChange('nationality', e.target.value)}
            placeholder="Enter nationality"
            error={fieldErrors.nationality}
          />
          <Input
            label="Religion"
            value={data.religion || ''}
            onChange={(e) => handleChange('religion', e.target.value)}
            placeholder="Enter religion"
          />
          <Input
            label="Personal Contact Number"
            type="tel"
            required
            reserveErrorSpace
            value={data.contactNumber || ''}
            onChange={(e) => handleChange('contactNumber', handlePhone('contactNumber', e.target.value))}
            placeholder="09XXXXXXXXX"
            className="mb-0"
            error={phoneWarnings.contactNumber ? 'Contact number cannot exceed 11 digits.' : fieldErrors.contactNumber}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Present Address"
            required
            value={data.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Enter current/present address"
            error={fieldErrors.address}
          />
          <Input
            label="Province Address"
            required
            value={data.provinceAddress || ''}
            onChange={(e) => handleChange('provinceAddress', e.target.value)}
            placeholder="Enter province/permanent address"
            error={fieldErrors.provinceAddress}
          />
        </div>
      </div>

      {/* ── School Information Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </span>
          School Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Select
              label="Program"
              required
              value={data.program || ''}
              onChange={(e) => handleChange('program', e.target.value)}
              options={programOptions}
              error={fieldErrors.program}
            />
            {data.program === 'Other' && (
              <div className="mt-2">
                <Input
                  label="Specify Program"
                  required
                  value={data.programOther || ''}
                  onChange={(e) => handleChange('programOther', e.target.value)}
                  placeholder="Enter your specific program"
                  error={fieldErrors.programOther}
                />
              </div>
            )}
          </div>
          <Input
            label="Student Number"
            required
            value={data.studentNumber || ''}
            onChange={(e) => handleChange('studentNumber', filterStudentNumber(e.target.value))}
            placeholder="Enter student number"
            error={fieldErrors.studentNumber}
          />
        </div>
      </div>

      {/* ── Student Status Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          Student Status
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <Select
            label="Student Category"
            required
            value={data.studentCategory || ''}
            onChange={(e) => handleChange('studentCategory', e.target.value)}
            options={studentCategoryOptions}
            error={fieldErrors.studentCategory}
          />
          <Input
            label="Last School Attended"
            value={data.lastSchoolAttended || ''}
            onChange={(e) => handleChange('lastSchoolAttended', e.target.value)}
            placeholder="Enter last school attended"
          />
          <div>
            <label className="form-label">
              Are you done with your Drug Test?
            </label>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="drugTest"
                  value="Yes"
                  checked={data.drugTestDone === 'Yes'}
                  onChange={(e) => handleChange('drugTestDone', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="drugTest"
                  value="No"
                  checked={data.drugTestDone === 'No'}
                  onChange={(e) => handleChange('drugTestDone', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Emergency Contacts Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-error-100 text-error-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          Emergency Contacts
          <span className="text-xs font-normal text-secondary-500 bg-secondary-100 px-2 py-0.5 rounded-full">2 required</span>
        </h3>
        {[0, 1].map((index) => (
          <div key={index} className={`${index === 0 ? 'mb-6 pb-6 border-b border-neutral-200' : ''}`}>
            <h4 className="text-sm font-semibold text-secondary-600 mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary-200 text-secondary-700 text-xs font-bold">{index + 1}</span>
              Contact Person {index + 1}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                label="Name"
                required
                value={data.emergencyContacts[index]?.name || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'name', e.target.value)}
                placeholder="Full name"
                error={index === 0 ? fieldErrors.emergencyContact1Name : fieldErrors.emergencyContact2Name}
              />
              <Input
                label="Relationship"
                required
                value={data.emergencyContacts[index]?.relationship || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'relationship', e.target.value)}
                placeholder="e.g., Mother, Father"
                error={index === 0 ? fieldErrors.emergencyContact1Relationship : fieldErrors.emergencyContact2Relationship}
              />
              <Input
                label="Contact Number"
                type="tel"
                required
                reserveErrorSpace
                value={data.emergencyContacts[index]?.contactNumber || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'contactNumber', handlePhone(`ec${index}`, e.target.value))}
                placeholder="09XXXXXXXXX"
                error={phoneWarnings[`ec${index}`] ? 'Contact number cannot exceed 11 digits.' : (index === 0 ? fieldErrors.emergencyContact1ContactNumber : fieldErrors.emergencyContact2ContactNumber)}
              />
            </div>
            <div className="mt-2">
              <Input
                label="Address"
                required
                value={data.emergencyContacts[index]?.address || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'address', e.target.value)}
                placeholder="Complete address of contact person"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalInfoForm;
