import React, { useState } from 'react';
import { Checkbox, Input, Textarea } from './form-elements';

const medicalConditions = [
  { id: 'covid19', label: 'COVID 19' },
  { id: 'amoebiasis', label: 'Amoebiasis' },
  { id: 'bronchialAsthma', label: 'Bronchial Asthma' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'epilepsyConvulsion', label: 'Epilepsy, Convulsion' },
  { id: 'handicapCongenitalDeformities', label: 'Handicap, Congenital Deformities' },
  { id: 'heartDisease', label: 'Heart Disease' },
  { id: 'hepatitis', label: 'Hepatitis' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'malaria', label: 'Malaria' },
  { id: 'psychiatricIllness', label: 'Psychiatric Illness' },
  { id: 'syncope', label: 'Syncope' },
  { id: 'tuberculosis', label: 'Tuberculosis' },
  { id: 'typhoidFever', label: 'Typhoid Fever' },
  { id: 'thyroidProblems', label: 'Thyroid problems' },
  { id: 'others', label: 'Others (Fracture, Hernia etc.)' },
];

const familyMedicalConditions = [
  { id: 'covid19', label: 'COVID 19' },
  { id: 'amoebiasis', label: 'Amoebiasis' },
  { id: 'bronchialAsthma', label: 'Bronchial Asthma' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'epilepsyConvulsion', label: 'Epilepsy, Convulsion' },
  { id: 'handicapCongenitalDeformities', label: 'Handicap, Congenital Deformities' },
  { id: 'heartDisease', label: 'Heart Disease' },
  { id: 'hepatitis', label: 'Hepatitis' },
  { id: 'highBloodPressure', label: 'High Blood Pressure' },
  { id: 'malaria', label: 'Malaria' },
  { id: 'psychiatricIllness', label: 'Psychiatric Illness' },
  { id: 'tuberculosis', label: 'Tuberculosis' },
  { id: 'typhoidFever', label: 'Typhoid Fever' },
  { id: 'thyroidProblems', label: 'Thyroid problems' },
  { id: 'others', label: 'Others (Fracture, Hernia etc.)' },
];

const MedicalHistoryForm = ({ data, onChange }) => {
  const [activeTab, setActiveTab] = useState('self');

  const handleSelfConditionChange = (conditionId, checked) => {
    const self = { ...data.self, [conditionId]: checked };
    onChange({ ...data, self });
  };

  const handleSelfOtherChange = (value) => {
    onChange({ ...data, selfOther: value });
  };

  const handleFamilyConditionChange = (conditionId, checked) => {
    const family = { ...data.family, [conditionId]: checked };
    // Clear the "who has it" field if unchecked
    if (!checked) {
      const familyWhoHasIt = { ...data.familyWhoHasIt };
      delete familyWhoHasIt[conditionId];
      onChange({ ...data, family, familyWhoHasIt });
    } else {
      onChange({ ...data, family });
    }
  };

  const handleFamilyWhoHasItChange = (conditionId, value) => {
    const familyWhoHasIt = { ...data.familyWhoHasIt, [conditionId]: value };
    onChange({ ...data, familyWhoHasIt });
  };

  const handleFamilyOtherChange = (value) => {
    onChange({ ...data, familyOther: value });
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medicalConditions.map((condition) => (
              <div key={condition.id} className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors">
                <Checkbox
                  label={condition.label}
                  checked={data.self?.[condition.id] || false}
                  onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
                />
              </div>
            ))}
          </div>
          {/* Other Option - Separate at bottom */}
          <div className="mt-6 border-2 border-neutral-300 rounded-lg p-4">
            <Checkbox
              label="Other:"
              checked={data.selfOtherChecked || false}
              onChange={(e) => onChange({ ...data, selfOtherChecked: e.target.checked })}
            />
            {data.selfOtherChecked && (
              <div className="mt-3">
                <Textarea
                  placeholder="Please specify other medical conditions..."
                  value={data.selfOther || ''}
                  onChange={(e) => handleSelfOtherChange(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Family Medical History */}
      {activeTab === 'family' && (
        <div>
          <p className="text-sm text-secondary-600 mb-4">
            Check any conditions that apply to your immediate family members and specify who has it:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familyMedicalConditions.map((condition) => (
              <div key={condition.id} className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors">
                <Checkbox
                  label={condition.label}
                  checked={data.family?.[condition.id] || false}
                  onChange={(e) => handleFamilyConditionChange(condition.id, e.target.checked)}
                />
                {data.family?.[condition.id] && (
                  <div className="mt-2 ml-6">
                    <Input
                      placeholder="Who has this condition? (e.g., Mother, Father, Sibling)"
                      value={data.familyWhoHasIt?.[condition.id] || ''}
                      onChange={(e) => handleFamilyWhoHasItChange(condition.id, e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Other Option - Separate at bottom */}
          <div className="mt-6 border-2 border-neutral-300 rounded-lg p-4">
            <Checkbox
              label="Other:"
              checked={data.familyOtherChecked || false}
              onChange={(e) => onChange({ ...data, familyOtherChecked: e.target.checked })}
            />
            {data.familyOtherChecked && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Please specify other medical conditions..."
                  value={data.familyOther || ''}
                  onChange={(e) => handleFamilyOtherChange(e.target.value)}
                  rows={2}
                />
                <Input
                  placeholder="Who has this condition?"
                  value={data.familyOtherWhoHasIt || ''}
                  onChange={(e) => onChange({ ...data, familyOtherWhoHasIt: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalHistoryForm;
