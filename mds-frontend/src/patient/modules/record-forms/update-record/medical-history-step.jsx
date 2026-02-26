import React, { useState, useEffect } from 'react';
import { Input, Select, Checkbox, Textarea, AccordionSection, TabGroup } from './form-elements';
import { fetchAllMedicalCatalogs } from './medical-history-service';
import { useBanner } from '@core/context/banner-context.jsx';

const MedicalHistoryStep = ({ formData, onChange }) => {
  const { clearAllBanners } = useBanner();
  const [activeTab, setActiveTab] = useState('yourself');
  const [activeAccordion, setActiveAccordion] = useState('conditions');
  const [catalogs, setCatalogs] = useState({
    medicalConditions: [],
    hospitalizations: [],
    operations: [],
    immunizations: [],
    visualAcuity: [],
    medications: [],
    allergens: [],
    isLoading: true,
    error: null
  });

  // Fetch catalogs on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadCatalogs = async () => {
      try {
        console.log('📥 Loading catalogs...');
        const result = await fetchAllMedicalCatalogs();
        
        if (isMounted) {
          setCatalogs({
            ...result,
            isLoading: false,
            error: result.error
          });
          clearAllBanners();
          console.log('✅ Catalogs loaded');
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Failed to load catalogs:', err);
          setCatalogs(prev => ({
            ...prev,
            isLoading: false,
            error: err.message
          }));
        }
      }
    };

    loadCatalogs();
    
    return () => { isMounted = false; };
  }, []);

  // Use fetched catalogs or static fallback
  const medicalConditions = catalogs.medicalConditions.length > 0
    ? catalogs.medicalConditions.map(c => ({
        id: c.id,
        label: c.name || c.allergen
      }))
    : [
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
        { id: 'typhoidFever', label: 'Typhoid Fever' }
      ];

  const immunizations = catalogs.immunizations.length > 0
    ? catalogs.immunizations
    : [
        { id: 'covid19', name: 'COVID-19' },
        { id: 'influenza', name: 'Influenza (Flu)' },
        { id: 'hepatitisB', name: 'Hepatitis B' },
        { id: 'mmr', name: 'MMR (Measles, Mumps, Rubella)' },
        { id: 'tetanus', name: 'Tetanus/Diphtheria' },
        { id: 'varicella', name: 'Varicella (Chickenpox)' },
        { id: 'hpv', name: 'HPV' },
        { id: 'meningococcal', name: 'Meningococcal' },
        { id: 'pneumococcal', name: 'Pneumococcal' }
      ];

  const handleInputChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  const handleCheckboxChange = (field, value, checked) => {
    const currentValues = formData[field] || [];
    if (checked) {
      handleInputChange(field, [...currentValues, value]);
    } else {
      handleInputChange(field, currentValues.filter(v => v !== value));
    }
  };

  // Self conditions - simple checkbox toggle
  const handleSelfConditionChange = (conditionId, checked) => {
    const self = { ...(formData.selfConditions || {}), [conditionId]: checked };
    handleInputChange('selfConditions', self);
  };

  // Family conditions - checkbox with relationship input
  const handleFamilyConditionChange = (conditionId, checked) => {
    const family = { ...(formData.familyConditions || {}) };
    if (checked) {
      family[conditionId] = { checked: true, relationship: '' };
    } else {
      delete family[conditionId];
    }
    handleInputChange('familyConditions', family);
  };

  const handleFamilyRelationshipChange = (conditionId, relationship) => {
    const family = {
      ...(formData.familyConditions || {}),
      [conditionId]: { ...(formData.familyConditions?.[conditionId] || {}), relationship },
    };
    handleInputChange('familyConditions', family);
  };

  const toggleAccordion = (id) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const tabs = [
    { id: 'yourself', label: 'Yourself' },
    { id: 'family', label: 'Family' }
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-heading font-semibold text-secondary-800 dark:text-white" style={{ margin: 0 }}>
          Medical History
        </h3>
      </div>

      {/* Medical Conditions Section - Tabs for Yourself/Family */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-secondary-800 dark:text-white mb-4">Medical Conditions</h4>
        <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        {/* Yourself Tab Content */}
        {activeTab === 'yourself' && (
          <>
            <div className="space-y-4 mb-8">
              <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-4">Check any conditions that apply to you:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {medicalConditions.map((condition) => (
                  <Checkbox
                    key={condition.id}
                    label={condition.label}
                    checked={formData.selfConditions?.[condition.id] || false}
                    onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
                  />
                ))}
              </div>
            </div>
            {/* Additional Sections - Only visible in Yourself Tab */}
            <div className="space-y-4 mt-6">
              {/* Allergies Section */}
              <AccordionSection
                id="allergies"
                title="Allergies"
                icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                isOpen={activeAccordion === 'allergies'}
                onToggle={toggleAccordion}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasAllergies"
                        value="yes"
                        checked={formData.hasAllergies === 'yes'}
                        onChange={(e) => handleInputChange('hasAllergies', e.target.value)}
                        className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-secondary-700">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasAllergies"
                        value="no"
                        checked={formData.hasAllergies === 'no'}
                        onChange={(e) => handleInputChange('hasAllergies', e.target.value)}
                        className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-secondary-700">No</span>
                    </label>
                  </div>
                  {formData.hasAllergies === 'yes' && (
                    <div className="space-y-4">
                      {catalogs.allergens.length > 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {catalogs.allergens.map((allergen) => (
                              <Checkbox
                                key={allergen.id}
                                label={`${allergen.allergen} (${allergen.type})`}
                                checked={(formData.selectedAllergies || []).includes(allergen.id)}
                                onChange={(e) => handleCheckboxChange('selectedAllergies', allergen.id, e.target.checked)}
                              />
                            ))}
                          </div>
                          {(formData.selectedAllergies || []).length > 0 && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-secondary-700">Allergy Details:</h4>
                              {(formData.selectedAllergies || []).map((allergenId) => {
                                const allergen = catalogs.allergens.find(a => a.id === allergenId);
                                return allergen ? (
                                  <div key={allergenId} className="bg-neutral-50 p-3 rounded-lg">
                                    <p className="text-sm font-medium mb-2">{allergen.allergen}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <Select
                                        label="Status"
                                        required
                                        options={[
                                          { value: 'Active', label: 'Active' },
                                          { value: 'Resolved', label: 'Resolved' },
                                          { value: 'Suspected', label: 'Suspected' }
                                        ]}
                                        value={(formData.allergyDetails?.[allergenId]?.status) || ''}
                                        onChange={(e) => {
                                          const details = { ...(formData.allergyDetails || {}) };
                                          details[allergenId] = { ...details[allergenId], status: e.target.value };
                                          handleInputChange('allergyDetails', details);
                                        }}
                                      />
                                      <Select
                                        label="Severity"
                                        required
                                        options={[
                                          { value: 'Mild', label: 'Mild' },
                                          { value: 'Moderate', label: 'Moderate' },
                                          { value: 'Severe', label: 'Severe' }
                                        ]}
                                        value={(formData.allergyDetails?.[allergenId]?.severity) || ''}
                                        onChange={(e) => {
                                          const details = { ...(formData.allergyDetails || {}) };
                                          details[allergenId] = { ...details[allergenId], severity: e.target.value };
                                          handleInputChange('allergyDetails', details);
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Textarea
                          label="Please specify your allergies"
                          placeholder="Food, medication, environmental allergies..."
                          value={formData.allergiesDetail || ''}
                          onChange={(e) => handleInputChange('allergiesDetail', e.target.value)}
                        />
                      )}
                      <Textarea
                        label="Additional Notes (Optional)"
                        placeholder="Any additional information about your allergies, severity, reactions, etc."
                        value={formData.allergiesNotes || ''}
                        onChange={(e) => handleInputChange('allergiesNotes', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </AccordionSection>

        {/* Lifestyle Section */}
        <AccordionSection
          id="lifestyle"
          title="Lifestyle Habits"
          icon={<svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
          isOpen={activeAccordion === 'lifestyle'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Do you smoke?"
              required
              options={[
                { value: 'Never', label: 'Never' },
                { value: 'Former', label: 'Former' },
                { value: 'Current', label: 'Current' }
              ]}
              value={formData.smoking || ''}
              onChange={(e) => handleInputChange('smoking', e.target.value)}
            />
            <Select
              label="Do you drink alcohol?"
              required
              options={[
                { value: 'Never', label: 'Never' },
                { value: 'Occasionally', label: 'Occasionally' },
                { value: 'Regularly', label: 'Regularly' }
              ]}
              value={formData.alcohol || ''}
              onChange={(e) => handleInputChange('alcohol', e.target.value)}
            />
            <Select
              label="Do you vape?"
              required
              options={[
                { value: 'Never', label: 'Never' },
                { value: 'Former', label: 'Former' },
                { value: 'Current', label: 'Current' }
              ]}
              value={formData.vape || ''}
              onChange={(e) => handleInputChange('vape', e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Lifestyle Notes (Optional)"
              placeholder="Any additional information about your lifestyle, habits, or health behaviors."
              value={formData.lifestyleNotes || ''}
              onChange={(e) => handleInputChange('lifestyleNotes', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Visual Acuity Section */}
        <AccordionSection
          id="visual"
          title="Visual Acuity"
          icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          isOpen={activeAccordion === 'visual'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <p className="text-sm text-secondary-700 mr-4">Do you wear glasses or contact lenses?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visualAcuity"
                  value="yes"
                  checked={formData.visualAcuity === 'yes'}
                  onChange={(e) => handleInputChange('visualAcuity', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visualAcuity"
                  value="no"
                  checked={formData.visualAcuity === 'no'}
                  onChange={(e) => handleInputChange('visualAcuity', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">No</span>
              </label>
            </div>
            {formData.visualAcuity === 'yes' && (
              <div className="space-y-4">
                {catalogs.visualAcuity.length > 0 && (
                  <Select
                    label="Visual Acuity Type *"
                    required
                    options={catalogs.visualAcuity.map(va => ({
                      value: va.id,
                      label: va.name
                    }))}
                    value={formData.acuityId || ''}
                    onChange={(e) => handleInputChange('acuityId', e.target.value)}
                  />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Right Eye (OD) *"
                    required
                    placeholder="e.g., 20/20, -2.00"
                    value={formData.rightEye || ''}
                    onChange={(e) => handleInputChange('rightEye', e.target.value)}
                  />
                  <Input
                    label="Left Eye (OS) *"
                    required
                    placeholder="e.g., 20/20, -1.75"
                    value={formData.leftEye || ''}
                    onChange={(e) => handleInputChange('leftEye', e.target.value)}
                  />
                </div>
              </div>
            )}
            <Textarea
              label="Visual Acuity Notes (Optional)"
              placeholder="Any additional information about your vision, glasses, or eye health."
              value={formData.visualAcuityNotes || ''}
              onChange={(e) => handleInputChange('visualAcuityNotes', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* OB-GYN Section (Female Only) */}
        {formData.sex === 'Female' && (
          <AccordionSection
            id="obgyn"
            title="OB-GYN History"
            icon={<svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
            isOpen={activeAccordion === 'obgyn'}
            onToggle={toggleAccordion}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Last Menstrual Period"
                type="date"
                value={formData.lastMenstrualPeriod || ''}
                onChange={(e) => handleInputChange('lastMenstrualPeriod', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1.5">
                  Do you experience Dysmenorrhea?
                </label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dysmenorrhea"
                      value="yes"
                      checked={formData.dysmenorrhea === 'yes'}
                      onChange={(e) => handleInputChange('dysmenorrhea', e.target.value)}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-secondary-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dysmenorrhea"
                      value="no"
                      checked={formData.dysmenorrhea === 'no'}
                      onChange={(e) => handleInputChange('dysmenorrhea', e.target.value)}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-secondary-700">No</span>
                  </label>
                </div>
              </div>
            </div>
          </AccordionSection>
        )}

        {/* Immunizations Section */}
        <AccordionSection
          id="immunizations"
          title="Immunization History"
          icon={<svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          isOpen={activeAccordion === 'immunizations'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <p className="text-sm text-secondary-600 mb-4">Select vaccines you have received and provide details:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {immunizations.map((vaccine) => (
                <Checkbox
                  key={vaccine.id}
                  label={vaccine.name}
                  checked={(formData.immunizations || []).includes(vaccine.id)}
                  onChange={(e) => handleCheckboxChange('immunizations', vaccine.id, e.target.checked)}
                />
              ))}
            </div>
            {(formData.immunizations || []).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-secondary-700">Immunization Details:</h4>
                {(formData.immunizations || []).map((vaccineId) => {
                  const vaccine = immunizations.find(v => v.id === vaccineId);
                  return vaccine ? (
                    <div key={vaccineId} className="bg-neutral-50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">{vaccine.name}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Date Received *"
                          type="date"
                          required
                          value={(formData.immunizationDetails?.[vaccineId]?.date) || ''}
                          onChange={(e) => {
                            const details = { ...(formData.immunizationDetails || {}) };
                            details[vaccineId] = { ...details[vaccineId], date: e.target.value };
                            handleInputChange('immunizationDetails', details);
                          }}
                        />
                        <Input
                          label="Dose Number *"
                          type="number"
                          required
                          min="1"
                          placeholder="1, 2, 3..."
                          value={(formData.immunizationDetails?.[vaccineId]?.doseNumber) || ''}
                          onChange={(e) => {
                            const details = { ...(formData.immunizationDetails || {}) };
                            details[vaccineId] = { ...details[vaccineId], doseNumber: parseInt(e.target.value) || 1 };
                            handleInputChange('immunizationDetails', details);
                          }}
                        />
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <Textarea
              label="Immunization Notes (Optional)"
              placeholder="Any additional information about your immunizations, dates, or reactions."
              value={formData.immunizationNotes || ''}
              onChange={(e) => handleInputChange('immunizationNotes', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Hospitalizations Section */}
        <AccordionSection
          id="hospitalizations"
          title="Hospitalizations"
          icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5m4 0H9" /></svg>}
          isOpen={activeAccordion === 'hospitalizations'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <p className="text-sm text-secondary-700 mr-4">Have you been hospitalized in the past?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasHospitalizations"
                  value="yes"
                  checked={formData.hasHospitalizations === 'yes'}
                  onChange={(e) => handleInputChange('hasHospitalizations', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasHospitalizations"
                  value="no"
                  checked={formData.hasHospitalizations === 'no'}
                  onChange={(e) => handleInputChange('hasHospitalizations', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">No</span>
              </label>
            </div>
            {formData.hasHospitalizations === 'yes' && (
              <div className="space-y-4">
                {catalogs.hospitalizations.length > 0 && (
                  <Select
                    label="Condition requiring hospitalization *"
                    required
                    options={catalogs.hospitalizations.map(h => ({
                      value: h.id,
                      label: h.name
                    }))}
                    value={formData.hospitalizationCondition || ''}
                    onChange={(e) => handleInputChange('hospitalizationCondition', e.target.value)}
                  />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Admission Date *"
                    type="date"
                    required
                    value={formData.admissionDate || ''}
                    onChange={(e) => handleInputChange('admissionDate', e.target.value)}
                  />
                  <Input
                    label="Discharge Date"
                    type="date"
                    value={formData.dischargeDate || ''}
                    onChange={(e) => handleInputChange('dischargeDate', e.target.value)}
                  />
                </div>
                <Textarea
                  label="Hospitalization Notes (Optional)"
                  placeholder="Any additional information about your hospitalizations."
                  value={formData.hospitalizationNotes || ''}
                  onChange={(e) => handleInputChange('hospitalizationNotes', e.target.value)}
                />
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Surgeries Section */}
        <AccordionSection
          id="surgeries"
          title="Surgeries"
          icon={<svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
          isOpen={activeAccordion === 'surgeries'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <p className="text-sm text-secondary-700 mr-4">Have you had any surgeries?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasSurgeries"
                  value="yes"
                  checked={formData.hasSurgeries === 'yes'}
                  onChange={(e) => handleInputChange('hasSurgeries', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasSurgeries"
                  value="no"
                  checked={formData.hasSurgeries === 'no'}
                  onChange={(e) => handleInputChange('hasSurgeries', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">No</span>
              </label>
            </div>
            {formData.hasSurgeries === 'yes' && (
              <div className="space-y-4">
                {catalogs.operations.length > 0 && (
                  <Select
                    label="Type of surgery/operation *"
                    required
                    options={catalogs.operations.map(o => ({
                      value: o.id,
                      label: o.name
                    }))}
                    value={formData.surgeryType || ''}
                    onChange={(e) => handleInputChange('surgeryType', e.target.value)}
                  />
                )}
                <Input
                  label="Operation Date *"
                  type="date"
                  required
                  value={formData.operationDate || ''}
                  onChange={(e) => handleInputChange('operationDate', e.target.value)}
                />
                <Textarea
                  label="Surgery Notes (Optional)"
                  placeholder="Any additional information about your surgeries."
                  value={formData.surgeryNotes || ''}
                  onChange={(e) => handleInputChange('surgeryNotes', e.target.value)}
                />
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Medications Section */}
        <AccordionSection
          id="medications"
          title="Current Medications"
          icon={<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
          isOpen={activeAccordion === 'medications'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <p className="text-sm text-secondary-700 mr-4">Are you currently taking any medications?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasMedications"
                  value="yes"
                  checked={formData.hasMedications === 'yes'}
                  onChange={(e) => handleInputChange('hasMedications', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasMedications"
                  value="no"
                  checked={formData.hasMedications === 'no'}
                  onChange={(e) => handleInputChange('hasMedications', e.target.value)}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">No</span>
              </label>
            </div>
            {formData.hasMedications === 'yes' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-secondary-700">Current Medications:</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const currentMeds = formData.currentMedications || [];
                        handleInputChange('currentMedications', [...currentMeds, { medicineId: '', description: '' }]);
                      }}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Add Medication
                    </button>
                  </div>
                  {(formData.currentMedications || []).map((medication, index) => (
                    <div key={index} className="bg-neutral-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Medication #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const meds = [...(formData.currentMedications || [])];
                            meds.splice(index, 1);
                            handleInputChange('currentMedications', meds);
                          }}
                          className="text-error-600 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-3">
                        {catalogs.medications.length > 0 ? (
                          <Select
                            label="Medication *"
                            required
                            options={catalogs.medications.map(m => ({
                              value: m.id,
                              label: m.name
                            }))}
                            value={medication.medicineId || ''}
                            onChange={(e) => {
                              const meds = [...(formData.currentMedications || [])];
                              meds[index] = { ...meds[index], medicineId: e.target.value };
                              handleInputChange('currentMedications', meds);
                            }}
                          />
                        ) : (
                          <Input
                            label="Medication Name *"
                            required
                            placeholder="e.g., Aspirin, Metformin"
                            value={medication.medicineId || ''}
                            onChange={(e) => {
                              const meds = [...(formData.currentMedications || [])];
                              meds[index] = { ...meds[index], medicineId: e.target.value };
                              handleInputChange('currentMedications', meds);
                            }}
                          />
                        )}
                        <Textarea
                          label="Description/Dosage"
                          placeholder="e.g., 500mg twice daily for diabetes"
                          value={medication.description || ''}
                          onChange={(e) => {
                            const meds = [...(formData.currentMedications || [])];
                            meds[index] = { ...meds[index], description: e.target.value };
                            handleInputChange('currentMedications', meds);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {(!formData.currentMedications || formData.currentMedications.length === 0) && (
                    <p className="text-sm text-secondary-500 italic">No medications added yet. Click "Add Medication" to start.</p>
                  )}
                </div>
                <Textarea
                  label="Medication Notes (Optional)"
                  placeholder="Any additional information about your medications."
                  value={formData.medicationNotes || ''}
                  onChange={(e) => handleInputChange('medicationNotes', e.target.value)}
                />
              </div>
            )}
          </div>
        </AccordionSection>
      </div>
          </>
        )}

        {/* Family Tab Content - Matching Initial Record Format */}
        {activeTab === 'family' && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-4">
              Check any conditions that apply to your immediate family members and specify the relationship:
            </p>
            
            <div className="space-y-3">
              {medicalConditions.map((condition) => (
                <div 
                  key={condition.id} 
                  className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  <Checkbox
                    label={condition.label}
                    checked={formData.familyConditions?.[condition.id]?.checked || false}
                    onChange={(e) => handleFamilyConditionChange(condition.id, e.target.checked)}
                  />
                  {formData.familyConditions?.[condition.id]?.checked && (
                    <div className="mt-3 ml-6">
                      <Input
                        label="Relationship"
                        placeholder="e.g., Mother, Father, Brother, Sister"
                        value={formData.familyConditions[condition.id]?.relationship || ''}
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
    </div>
  );
};

export default MedicalHistoryStep;
