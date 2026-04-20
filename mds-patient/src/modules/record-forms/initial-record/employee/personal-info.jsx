import React from 'react';
import { Input, Select } from '../medical/form-elements';

const EmployeePersonalInfoForm = ({ data, onChange, fieldErrors = {}, onClearFieldError = () => {} }) => {
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
  const filterEmployeeId = (val) => val.replace(/[^a-zA-Z0-9\-]/g, '');

  const handleEmergencyContactChange = (index, field, value) => {
    // Clear error for this emergency contact field when user starts typing
    const fieldName = `emergencyContact${index + 1}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    onClearFieldError(fieldName);
    const contacts = [...data.emergencyContacts];
    contacts[index] = { ...contacts[index], [field]: value };
    onChange({ ...data, emergencyContacts: contacts });
  };

  const employmentCategoryOptions = [
    { value: 'Teaching', label: 'Teaching' },
    { value: 'Teaching (Officer)', label: 'Teaching (Officer)' },
    { value: 'Non-Teaching', label: 'Non-Teaching' },
    { value: 'Non-Teaching (Officer)', label: 'Non-Teaching (Officer)' },
    { value: 'Other', label: 'Other' },
  ];

  const employmentStatusOptions = [
    { value: 'Full time', label: 'Full time' },
    { value: 'Part time', label: 'Part time' },
    { value: 'Agency / Contractual', label: 'Agency / Contractual' },
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
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-neutral-200">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
          <h3 className="text-lg font-heading font-semibold text-secondary-900" style={{ margin: 0 }}>
            Personal Information
          </h3>
        </div>

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
            label="Given Name"
            required
            value={data.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter given name"
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
            label="Employee ID Number"
            required
            value={data.employeeId || ''}
            onChange={(e) => handleChange('employeeId', filterEmployeeId(e.target.value))}
            placeholder="Enter employee ID number"
            error={fieldErrors.employeeId}
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
            label="Contact Number (Mobile / Landline)"
            type="tel"
            required
            reserveErrorSpace
            value={data.contactNumber || ''}
            onChange={(e) => handleChange('contactNumber', handlePhone('contactNumber', e.target.value))}
            placeholder="09XXXXXXXXX"
            className="mb-0"
            error={phoneWarnings.contactNumber ? 'Contact number cannot exceed 11 digits.' : fieldErrors.contactNumber}
          />
          <Input
            label="Active Email Address"
            type="email"
            value={data.activeEmail || ''}
            onChange={(e) => handleChange('activeEmail', e.target.value)}
            placeholder="Preferably T.I.P. Email Address"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Complete Address"
            required
            value={data.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="House Number, Street Name, Barangay, City / Municipality, Province"
            error={fieldErrors.address}
          />
        </div>
      </div>

      {/* ── Employment Information Card ── */}
      <div className="form-section">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-neutral-200">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <h3 className="text-lg font-heading font-semibold text-secondary-900" style={{ margin: 0 }}>
            Employment Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Department"
            required
            value={data.department || ''}
            onChange={(e) => handleChange('department', e.target.value)}
            placeholder="Enter department"
            error={fieldErrors.department}
          />
          <Select
            label="Employment Category"
            required
            value={data.employmentCategory || ''}
            onChange={(e) => handleChange('employmentCategory', e.target.value)}
            options={employmentCategoryOptions}
            error={fieldErrors.employmentCategory}
          />
          {data.employmentCategory === 'Other' && (
            <Input
              label="Specify Employment Category"
              required
              value={data.employmentCategoryOther || ''}
              onChange={(e) => handleChange('employmentCategoryOther', e.target.value)}
              placeholder="Enter your employment category"
              error={fieldErrors.employmentCategoryOther}
            />
          )}
          <Select
            label="Employment Status"
            required
            value={data.employmentStatus || ''}
            onChange={(e) => handleChange('employmentStatus', e.target.value)}
            options={employmentStatusOptions}
            error={fieldErrors.employmentStatus}
          />
          <Input
            label="Position"
            value={data.position || ''}
            onChange={(e) => handleChange('position', e.target.value)}
            placeholder="Enter position"
          />
          <Select
            label="Campus Branch"
            required
            value={data.branch || ''}
            onChange={(e) => handleChange('branch', e.target.value)}
            options={[
              { value: 'Manila', label: 'Manila' },
              { value: 'QuezonCity', label: 'Quezon City' },
            ]}
            error={fieldErrors.branch}
          />
        </div>
      </div>

      {/* ── Emergency Contacts Card ── */}
      <div className="form-section">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-neutral-200">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-error-100 text-error-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <h3 className="text-lg font-heading font-semibold text-secondary-900" style={{ margin: 0 }}>
            Emergency Contact Information
          </h3>
        </div>

        <div className="border border-neutral-200 rounded-xl p-4 bg-white mb-3">
          <h5 className="font-semibold text-secondary-700 mb-2 text-xs uppercase tracking-wide">Primary Emergency Contact</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              label="Name"
              required
              value={data.emergencyContacts[0]?.name || ''}
              onChange={(e) => handleEmergencyContactChange(0, 'name', e.target.value)}
              placeholder="Contact Name"
              error={fieldErrors.emergencyContact1Name}
            />
            <Input
              label="Relationship"
              required
              value={data.emergencyContacts[0]?.relationship || ''}
              onChange={(e) => handleEmergencyContactChange(0, 'relationship', e.target.value)}
              placeholder="e.g., Spouse, Parent"
              error={fieldErrors.emergencyContact1Relationship}
            />
            <Input
              label="Contact Number"
              type="tel"
              required
              reserveErrorSpace
              value={data.emergencyContacts[0]?.contactNumber || ''}
              onChange={(e) => handleEmergencyContactChange(0, 'contactNumber', handlePhone('ec0', e.target.value))}
              placeholder="Contact Number"
              error={phoneWarnings.ec0 ? 'Contact number cannot exceed 11 digits.' : fieldErrors.emergencyContact1ContactNumber}
            />
          </div>
          <div className="mt-2">
            <Input
              label="Address"
              required
              value={data.emergencyContacts[0]?.address || ''}
              onChange={(e) => handleEmergencyContactChange(0, 'address', e.target.value)}
              placeholder="Contact's home address"
              error={fieldErrors.emergencyContact1Address}
            />
          </div>
        </div>

        <div className="border border-neutral-200 rounded-xl p-4 bg-white">
          <h5 className="font-semibold text-secondary-700 mb-2 text-xs uppercase tracking-wide flex items-center gap-2">
            Additional Emergency Contact
            <span className="text-[10px] font-normal bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-full normal-case tracking-normal">Optional</span>
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              label="Name"
              value={data.emergencyContacts[1]?.name || ''}
              onChange={(e) => handleEmergencyContactChange(1, 'name', e.target.value)}
              placeholder="Contact Name"
              error={fieldErrors.emergencyContact2Name}
            />
            <Input
              label="Relationship"
              value={data.emergencyContacts[1]?.relationship || ''}
              onChange={(e) => handleEmergencyContactChange(1, 'relationship', e.target.value)}
              placeholder="e.g., Sibling, Guardian"
              error={fieldErrors.emergencyContact2Relationship}
            />
            <Input
              label="Contact Number"
              type="tel"
              reserveErrorSpace
              value={data.emergencyContacts[1]?.contactNumber || ''}
              onChange={(e) => handleEmergencyContactChange(1, 'contactNumber', handlePhone('ec1', e.target.value))}
              placeholder="Contact Number"
              error={phoneWarnings.ec1 ? 'Contact number cannot exceed 11 digits.' : fieldErrors.emergencyContact2ContactNumber}
            />
          </div>
          <div className="mt-2">
            <Input
              label="Address"
              value={data.emergencyContacts[1]?.address || ''}
              onChange={(e) => handleEmergencyContactChange(1, 'address', e.target.value)}
              placeholder="Contact's home address"
              error={fieldErrors.emergencyContact2Address}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePersonalInfoForm;
