import React from 'react';
import { Input, Select } from './form-elements';

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
        OB-GYN HISTORY
      </h3>

      <div className="bg-white border border-secondary-200 p-6 mb-6 rounded-lg">
        <p className="text-sm text-secondary-900 font-semibold mb-4">
          OB-GYN HISTORY (FOR FEMALE STUDENT ONLY)
        </p>

        {/* Last Menstrual Period */}
        <div className="mb-6">
          <label className="form-label">
            WHEN WAS YOUR LAST MENSTRUAL PERIOD?
          </label>
          <p className="text-xs text-secondary-500 mb-2">(Kailan ang unang araw ng huling regla?)</p>
          <p className="text-xs text-secondary-600 mb-2">Date</p>
          <Input
            type="date"
            placeholder="mm/dd/yyyy"
            value={data.lastMenstrualPeriod || ''}
            onChange={(e) => handleChange('lastMenstrualPeriod', e.target.value)}
          />
        </div>

        {/* Menarche Year/Age */}
        <div className="mb-6">
          <label className="form-label">Menarche Year / Age</label>
          <p className="text-xs text-secondary-500 mb-2">(Pinaka-unang regla)</p>
          <Input
            placeholder="Your answer"
            value={data.menarcheYearAge || ''}
            onChange={(e) => handleChange('menarcheYearAge', e.target.value)}
          />
        </div>

        {/* Menstruation Duration */}
        <div className="mb-6">
          <label className="form-label">Menstruation Duration ?</label>
          <p className="text-xs text-secondary-500 mb-2">(Days of Menstruation)</p>
          <Input
            placeholder="Your answer"
            value={data.menstruationDuration || ''}
            onChange={(e) => handleChange('menstruationDuration', e.target.value)}
          />
        </div>

        {/* Pads per day */}
        <div className="mb-6">
          <label className="form-label">How many pad/s per day</label>
          <Input
            placeholder="Your answer"
            value={data.padsPerDay || ''}
            onChange={(e) => handleChange('padsPerDay', e.target.value)}
          />
        </div>

        {/* Dysmenorrhea */}
        <div className="mb-4">
          <label className="form-label">Do you experience Dysmenorrhea ?</label>
          <div className="flex gap-6 mt-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="dysmenorrhea"
                value="Yes"
                checked={data.dysmenorrhea === 'Yes'}
                onChange={(e) => handleChange('dysmenorrhea', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="dysmenorrhea"
                value="No"
                checked={data.dysmenorrhea === 'No'}
                onChange={(e) => handleChange('dysmenorrhea', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OBGYNEForm;
