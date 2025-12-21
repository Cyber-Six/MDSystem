import React from 'react';
import { Input, Select } from './form-elements';

const PersonalInfoForm = ({ data, onChange }) => {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const handleEmergencyContactChange = (index, field, value) => {
    const contacts = [...data.emergencyContacts];
    contacts[index] = { ...contacts[index], [field]: value };
    onChange({ ...data, emergencyContacts: contacts });
  };

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
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="form-section">
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Surname"
            required
            value={data.surname || ''}
            onChange={(e) => handleChange('surname', e.target.value)}
            placeholder="Enter surname"
          />
          <Input
            label="First Name"
            required
            value={data.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter first name"
          />
          <Input
            label="Middle Name"
            value={data.middleName || ''}
            onChange={(e) => handleChange('middleName', e.target.value)}
            placeholder="Enter middle name"
          />
          <Input
            label="Birthday"
            type="date"
            required
            value={data.birthday || ''}
            onChange={(e) => handleChange('birthday', e.target.value)}
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
              { value: 'Other', label: 'Other' },
            ]}
          />
          <Select
            label="Civil Status"
            required
            value={data.civilStatus || ''}
            onChange={(e) => handleChange('civilStatus', e.target.value)}
            options={[
              { value: 'Single', label: 'Single' },
              { value: 'Married', label: 'Married' },
              { value: 'Divorced', label: 'Divorced' },
              { value: 'Widowed', label: 'Widowed' },
            ]}
          />
          <Input
            label="Nationality"
            required
            value={data.nationality || ''}
            onChange={(e) => handleChange('nationality', e.target.value)}
            placeholder="Enter nationality"
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
            value={data.contactNumber || ''}
            onChange={(e) => handleChange('contactNumber', e.target.value)}
            placeholder="+63 XXX XXX XXXX"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Address"
            required
            value={data.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Enter complete address"
          />
        </div>
      </div>

      {/* School Information */}
      <div className="form-section">
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          School Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Program"
            required
            value={data.program || ''}
            onChange={(e) => handleChange('program', e.target.value)}
            placeholder="e.g., BS Computer Science"
          />
          <Input
            label="Department"
            required
            value={data.department || ''}
            onChange={(e) => handleChange('department', e.target.value)}
            placeholder="e.g., College of Engineering"
          />
          <Input
            label="Student Number"
            required
            value={data.studentNumber || ''}
            onChange={(e) => handleChange('studentNumber', e.target.value)}
            placeholder="Enter student number"
          />
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="form-section">
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Emergency Contacts <span className="text-sm text-secondary-500 ml-2">(2 required)</span>
        </h3>
        {[0, 1].map((index) => (
          <div key={index} className="mb-6 pb-6 border-b last:border-b-0">
            <h4 className="text-sm font-semibold text-secondary-700 mb-4">
              Contact Person {index + 1}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Name"
                required
                value={data.emergencyContacts[index]?.name || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'name', e.target.value)}
                placeholder="Full name"
              />
              <Input
                label="Relationship"
                required
                value={data.emergencyContacts[index]?.relationship || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'relationship', e.target.value)}
                placeholder="e.g., Mother, Father"
              />
              <Input
                label="Contact Number"
                type="tel"
                required
                value={data.emergencyContacts[index]?.contactNumber || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'contactNumber', e.target.value)}
                placeholder="+63 XXX XXX XXXX"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalInfoForm;
