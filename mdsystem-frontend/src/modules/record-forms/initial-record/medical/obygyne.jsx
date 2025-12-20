import React from 'react';
import { Input, Select } from './FormElements';

const OBGYNEForm = ({ data, onChange }) => {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="form-section">
      <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        OB-GYNE History
      </h3>

      <div className="bg-pink-50 border-l-4 border-pink-500 p-4 mb-6 rounded-lg">
        <p className="text-sm text-pink-900 font-medium">
          This section is for female-identifying individuals only.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Menarche (year/age)"
          placeholder="e.g., 2010 or Age 13"
          value={data.menarcheYearAge || ''}
          onChange={(e) => handleChange('menarcheYearAge', e.target.value)}
        />
        <Input
          label="Menstruation Duration"
          placeholder="e.g., 5-7 days"
          value={data.menstruationDuration || ''}
          onChange={(e) => handleChange('menstruationDuration', e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="form-label">Dysmenorrhea (painful menstruation)</label>
        <div className="flex gap-6 mt-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="dysmenorrhea"
              value="no"
              checked={data.dysmenorrhea === 'no'}
              onChange={(e) => handleChange('dysmenorrhea', e.target.value)}
              className="form-checkbox"
            />
            <span className="ml-2 text-secondary-700">No</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="dysmenorrhea"
              value="yes"
              checked={data.dysmenorrhea === 'yes'}
              onChange={(e) => handleChange('dysmenorrhea', e.target.value)}
              className="form-checkbox"
            />
            <span className="ml-2 text-gray-700">Yes</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default OBGYNEForm;
