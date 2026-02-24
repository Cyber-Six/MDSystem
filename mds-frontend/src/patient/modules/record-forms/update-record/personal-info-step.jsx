import React from 'react';
import { Input, Select } from './form-elements';

const PersonalInfoStep = ({ formData, onChange }) => {
  const programs = [
    { value: 'AB Communication', label: 'AB Communication' },
    { value: 'AB English Language', label: 'AB English Language' },
    { value: 'AB Literature', label: 'AB Literature' },
    { value: 'AB Philosophy', label: 'AB Philosophy' },
    { value: 'AB Political Science', label: 'AB Political Science' },
    { value: 'AB Psychology', label: 'AB Psychology' },
    { value: 'BS Accountancy', label: 'BS Accountancy' },
    { value: 'BS Accounting Information System', label: 'BS Accounting Information System' },
    { value: 'BS Accounting Technology', label: 'BS Accounting Technology' },
    { value: 'BS Applied Mathematics', label: 'BS Applied Mathematics' },
    { value: 'BS Architecture', label: 'BS Architecture' },
    { value: 'BS Biology', label: 'BS Biology' },
    { value: 'BS Chemistry', label: 'BS Chemistry' },
    { value: 'BS Civil Engineering', label: 'BS Civil Engineering' },
    { value: 'BS Computer Engineering', label: 'BS Computer Engineering' },
    { value: 'BS Computer Science', label: 'BS Computer Science' },
    { value: 'BS Electrical Engineering', label: 'BS Electrical Engineering' },
    { value: 'BS Electronics Engineering', label: 'BS Electronics Engineering' },
    { value: 'BS Entrepreneurship', label: 'BS Entrepreneurship' },
    { value: 'BS Industrial Engineering', label: 'BS Industrial Engineering' },
    { value: 'BS Information Technology', label: 'BS Information Technology' },
    { value: 'BS Management Accounting', label: 'BS Management Accounting' },
    { value: 'BS Mathematics', label: 'BS Mathematics' },
    { value: 'BS Mechanical Engineering', label: 'BS Mechanical Engineering' },
    { value: 'BS Medical Technology', label: 'BS Medical Technology' },
    { value: 'BS Nursing', label: 'BS Nursing' },
    { value: 'BS Pharmacy', label: 'BS Pharmacy' },
    { value: 'BS Physics', label: 'BS Physics' },
    { value: 'BS Psychology', label: 'BS Psychology' },
    { value: 'BS Secondary Education', label: 'BS Secondary Education' },
    { value: 'DVM (Doctor of Veterinary Medicine)', label: 'DVM (Doctor of Veterinary Medicine)' }
  ];

  const handleInputChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* School Information Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-heading font-semibold text-secondary-800 dark:text-white">
            School Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Select
            label="Program"
            required
            options={programs}
            value={formData.program || ''}
            onChange={(e) => handleInputChange('program', e.target.value)}
          />
          <Input
            label="Department"
            required
            placeholder="e.g., College of Engineering"
            value={formData.department || ''}
            onChange={(e) => handleInputChange('department', e.target.value)}
          />
          <Input
            label="Student Number"
            required
            placeholder="Enter student number"
            value={formData.studentNumber || ''}
            onChange={(e) => handleInputChange('studentNumber', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="School Year"
            required
            options={[
              { value: '1st Year', label: '1st Year' },
              { value: '2nd Year', label: '2nd Year' },
              { value: '3rd Year', label: '3rd Year' },
              { value: '4th Year', label: '4th Year' },
              { value: '5th Year', label: '5th Year' }
            ]}
            value={formData.schoolYear || ''}
            onChange={(e) => handleInputChange('schoolYear', e.target.value)}
          />
          <Select
            label="Semester"
            required
            options={[
              { value: '1st Semester', label: '1st Semester' },
              { value: '2nd Semester', label: '2nd Semester' },
              { value: 'Summer', label: 'Summer' }
            ]}
            value={formData.semester || ''}
            onChange={(e) => handleInputChange('semester', e.target.value)}
          />
          <Select
            label="Student Category"
            required
            options={[
              { value: 'Regular', label: 'Regular' },
              { value: 'Irregular', label: 'Irregular' },
              { value: 'Transferee', label: 'Transferee' },
              { value: 'Returning', label: 'Returning' }
            ]}
            value={formData.studentCategory || ''}
            onChange={(e) => handleInputChange('studentCategory', e.target.value)}
          />
        </div>
      </div>

      {/* Emergency Contact Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="w-10 h-10 rounded-lg bg-error-100 dark:bg-error-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-heading font-semibold text-secondary-800 dark:text-white">
            Emergency Contact
          </h3>
        </div>

        {/* Primary Emergency Contact */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 mb-4 bg-white dark:bg-neutral-800/50 hover:border-primary-400 dark:hover:border-primary-500 transition-colors duration-200">
          <h5 className="font-semibold text-secondary-700 dark:text-neutral-300 mb-4 text-sm uppercase tracking-wide">Primary Emergency Contact</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Name"
              required
              placeholder="Contact Name"
              value={formData.emergencyContact1Name || ''}
              onChange={(e) => handleInputChange('emergencyContact1Name', e.target.value)}
            />
            <Input
              label="Relationship"
              required
              placeholder="e.g., Mother, Father"
              value={formData.emergencyContact1Relationship || ''}
              onChange={(e) => handleInputChange('emergencyContact1Relationship', e.target.value)}
            />
            <Input
              label="Contact Number"
              required
              type="tel"
              placeholder="Contact Number"
              value={formData.emergencyContact1Number || ''}
              onChange={(e) => handleInputChange('emergencyContact1Number', e.target.value)}
            />
          </div>
        </div>

        {/* Secondary Emergency Contact */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 bg-white dark:bg-neutral-800/50 hover:border-primary-400 dark:hover:border-primary-500 transition-colors duration-200">
          <h5 className="font-semibold text-secondary-700 dark:text-neutral-300 mb-4 text-sm uppercase tracking-wide">Secondary Emergency Contact</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Name"
              required
              placeholder="Contact Name"
              value={formData.emergencyContact2Name || ''}
              onChange={(e) => handleInputChange('emergencyContact2Name', e.target.value)}
            />
            <Input
              label="Relationship"
              required
              placeholder="e.g., Sibling, Guardian"
              value={formData.emergencyContact2Relationship || ''}
              onChange={(e) => handleInputChange('emergencyContact2Relationship', e.target.value)}
            />
            <Input
              label="Contact Number"
              required
              type="tel"
              placeholder="Contact Number"
              value={formData.emergencyContact2Number || ''}
              onChange={(e) => handleInputChange('emergencyContact2Number', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
	);
};

export default PersonalInfoStep;
