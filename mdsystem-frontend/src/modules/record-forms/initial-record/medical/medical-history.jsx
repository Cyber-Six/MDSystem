import React, { useState } from 'react';
import { Checkbox, Input } from './FormElements';

const medicalConditions = [
  { id: 'heartCondition', label: 'Heart Condition' },
  { id: 'highBloodPressure', label: 'High Blood Pressure' },
  { id: 'epilepsySeizure', label: 'Epilepsy/Seizure' },
  { id: 'psychiatricIllness', label: 'Psychiatric Illness' },
  { id: 'bronchialAsthma', label: 'Bronchial Asthma' },
  { id: 'diabetesTypeI', label: 'Diabetes Type I' },
  { id: 'diabetesTypeII', label: 'Diabetes Type II' },
  { id: 'hepatitisA', label: 'Hepatitis A' },
  { id: 'hepatitisB', label: 'Hepatitis B' },
  { id: 'hepatitisC', label: 'Hepatitis C' },
  { id: 'hepatitisD', label: 'Hepatitis D' },
  { id: 'hepatitisE', label: 'Hepatitis E' },
  { id: 'amoebiasis', label: 'Amoebiasis' },
  { id: 'tuberculosis', label: 'Tuberculosis' },
  { id: 'typhoidFever', label: 'Typhoid Fever' },
  { id: 'malaria', label: 'Malaria' },
];

const MedicalHistoryForm = ({ data, onChange }) => {
  const [activeTab, setActiveTab] = useState('self');

  const handleSelfConditionChange = (conditionId, checked) => {
    const self = { ...data.self, [conditionId]: checked };
    onChange({ ...data, self });
  };

  const handleFamilyConditionChange = (conditionId, checked) => {
    const family = { ...data.family };
    if (checked) {
      family[conditionId] = { checked: true, relationship: '' };
    } else {
      delete family[conditionId];
    }
    onChange({ ...data, family });
  };

  const handleFamilyRelationshipChange = (conditionId, relationship) => {
    const family = {
      ...data.family,
      [conditionId]: { ...data.family[conditionId], relationship },
    };
    onChange({ ...data, family });
  };

  return (
    <div className="form-section">
      <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Medical History
      </h3>

      {/* Tabs */}
      <div className="flex border-b-2 border-neutral-200 mb-6">
        <button
          className={`py-3 px-6 font-medium transition-colors duration-200 border-b-2 ${
            activeTab === 'self'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-secondary-500 hover:text-secondary-700'
          }`}
          onClick={() => setActiveTab('self')}
        >
          Yourself
        </button>
        <button
          className={`py-3 px-6 font-medium transition-colors duration-200 border-b-2 ${
            activeTab === 'family'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-secondary-500 hover:text-secondary-700'
          }`}
          onClick={() => setActiveTab('family')}
        >
          Family
        </button>
      </div>

      {/* Self Medical History */}
      {activeTab === 'self' && (
        <div>
          <p className="text-sm text-secondary-600 mb-4">
            Check any conditions that apply to you:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {medicalConditions.map((condition) => (
              <Checkbox
                key={condition.id}
                label={condition.label}
                checked={data.self?.[condition.id] || false}
                onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Family Medical History */}
      {activeTab === 'family' && (
        <div>
          <p className="text-sm text-secondary-600 mb-4">
            Check any conditions that apply to your immediate family members and specify the relationship:
          </p>
          <div className="space-y-4">
            {medicalConditions.map((condition) => (
              <div key={condition.id} className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors">
                <Checkbox
                  label={condition.label}
                  checked={data.family?.[condition.id]?.checked || false}
                  onChange={(e) => handleFamilyConditionChange(condition.id, e.target.checked)}
                />
                {data.family?.[condition.id]?.checked && (
                  <div className="mt-3 ml-6">
                    <Input
                      label="Relationship"
                      placeholder="e.g., Mother, Father, Brother, Sister"
                      value={data.family[condition.id]?.relationship || ''}
                      onChange={(e) => handleFamilyRelationshipChange(condition.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalHistoryForm;
