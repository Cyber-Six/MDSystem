import React from 'react';
import { Input } from '../medical/form-elements';

const EmployeeOBGYNEForm = ({ data, onChange, fieldErrors = {}, onClearFieldError = () => {} }) => {
  const handleChange = (field, value) => {
    onClearFieldError(field);
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="form-section">
      {/* Error Banner */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg mb-4">
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

      <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        OB-GYN HISTORY
      </h3>

      <div className="bg-white border border-secondary-200 p-6 mb-6 rounded-lg">
        <p className="text-sm text-secondary-900 font-semibold mb-4">
          OB-GYN HISTORY (FOR FEMALE STUDENT AND EMPLOYEE ONLY)
        </p>

        {/* Last Menstrual Period */}
        <div className="mb-6">
          <label className="form-label">
            WHEN WAS YOUR LAST MENSTRUAL PERIOD?
          </label>
          <p className="text-xs text-secondary-500 mb-2">(Kailan ang unang araw ng huling regla?)</p>
          <Input
            type="date"
            placeholder="mm/dd/yyyy"
            value={data.lastMenstrualPeriod || ''}
            onChange={(e) => handleChange('lastMenstrualPeriod', e.target.value)}
            error={fieldErrors.lastMenstrualPeriod}
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

        {/* Pads Per Day */}
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

export default EmployeeOBGYNEForm;
