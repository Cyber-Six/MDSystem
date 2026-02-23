import React, { useState, useEffect, useRef } from 'react';
import { Input, Select, Checkbox, Textarea, AccordionSection } from './form-elements';
import { fetchAllDentalCatalogs } from './dental-history-service';
import { useBanner } from '@core/context/banner-context.jsx';

const DentalHistoryStep = ({ formData, onChange }) => {
  const { clearAllBanners } = useBanner();
  const [activeAccordion, setActiveAccordion] = useState('visits');
  const [catalogs, setCatalogs] = useState({
    oralAppliances: [],
    dentalProcedures: [],
    isLoading: true,
    error: null
  });

  // Prevent duplicate fetch in React StrictMode (dev double-mount)
  const hasFetched = useRef(false);

  // Fetch catalogs on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let isMounted = true;
    
    const loadCatalogs = async () => {
      try {
        console.log('📥 Loading dental catalogs...');
        const result = await fetchAllDentalCatalogs();
        
        if (isMounted) {
          setCatalogs({
            ...result,
            isLoading: false,
            error: result.error
          });
          clearAllBanners();
          console.log('✅ Dental catalogs loaded');
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Failed to load dental catalogs:', err);
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

  const toggleAccordion = (id) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-heading font-semibold text-secondary-800 dark:text-white">
          Dental History
        </h3>
      </div>

      <div className="space-y-4">
        {/* Dentist Visits Section */}
        <AccordionSection
          id="visits"
          title="Dentist Visits"
          icon="🦷"
          isOpen={activeAccordion === 'visits'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-2">
                Have you visited a dentist? *
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="seenByDentist"
                    value="true"
                    checked={formData.seenByDentist === true}
                    onChange={(e) => handleInputChange('seenByDentist', true)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="seenByDentist"
                    value="false"
                    checked={formData.seenByDentist === false}
                    onChange={(e) => handleInputChange('seenByDentist', false)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">No</span>
                </label>
              </div>
            </div>
            
            <Select
              label="When was your last dental cleaning? *"
              required
              options={[
                { value: 'Within last 6 months', label: 'Within last 6 months' },
                { value: '6-12 months ago', label: '6-12 months ago' },
                { value: '1-2 years ago', label: '1-2 years ago' },
                { value: 'More than 2 years ago', label: 'More than 2 years ago' },
                { value: 'Never', label: 'Never' },
                { value: "I don't remember", label: "I don't remember" }
              ]}
              value={formData.lastDentalCleaning || ''}
              onChange={(e) => handleInputChange('lastDentalCleaning', e.target.value)}
            />

            {formData.seenByDentist === true && (
              <>
                <Input
                  label="Last Visit Date"
                  type="date"
                  value={formData.lastVisitDate || ''}
                  onChange={(e) => handleInputChange('lastVisitDate', e.target.value)}
                />
                <Input
                  label="Purpose of Last Visit"
                  placeholder="e.g., Regular checkup, Tooth extraction, Cleaning"
                  value={formData.purpose || ''}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                />
              </>
            )}
          </div>
        </AccordionSection>

        {/* Intraoral Appliances Section */}
        <AccordionSection
          id="appliances"
          title="Intraoral Appliances"
          icon="🔧"
          isOpen={activeAccordion === 'appliances'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-secondary-700">Do you use any intra-oral appliances?</p>
              <button
                type="button"
                onClick={() => {
                  const currentAppliances = formData.oralAppliances || [];
                  handleInputChange('oralAppliances', [...currentAppliances, { tagId: '', status: '', dateIssued: '', arch: 'None' }]);
                }}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Add Appliance
              </button>
            </div>

            {(formData.oralAppliances || []).map((appliance, index) => (
              <div key={index} className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Appliance #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const appliances = [...(formData.oralAppliances || [])];
                      appliances.splice(index, 1);
                      handleInputChange('oralAppliances', appliances);
                    }}
                    className="text-error-600 text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catalogs.oralAppliances.length > 0 ? (
                    <Select
                      label="Appliance Type *"
                      required
                      options={catalogs.oralAppliances.map(a => ({
                        value: a.id,
                        label: a.name
                      }))}
                      value={appliance.tagId || ''}
                      onChange={(e) => {
                        const appliances = [...(formData.oralAppliances || [])];
                        appliances[index] = { ...appliances[index], tagId: e.target.value };
                        handleInputChange('oralAppliances', appliances);
                      }}
                    />
                  ) : (
                    <Input
                      label="Appliance Type *"
                      required
                      placeholder="e.g., Braces, Retainer"
                      value={appliance.tagId || ''}
                      onChange={(e) => {
                        const appliances = [...(formData.oralAppliances || [])];
                        appliances[index] = { ...appliances[index], tagId: e.target.value };
                        handleInputChange('oralAppliances', appliances);
                      }}
                    />
                  )}
                  <Input
                    label="Status *"
                    required
                    placeholder="e.g., Active, Completed"
                    value={appliance.status || ''}
                    onChange={(e) => {
                      const appliances = [...(formData.oralAppliances || [])];
                      appliances[index] = { ...appliances[index], status: e.target.value };
                      handleInputChange('oralAppliances', appliances);
                    }}
                  />
                  <Input
                    label="Date Issued *"
                    type="date"
                    required
                    value={appliance.dateIssued || ''}
                    onChange={(e) => {
                      const appliances = [...(formData.oralAppliances || [])];
                      appliances[index] = { ...appliances[index], dateIssued: e.target.value };
                      handleInputChange('oralAppliances', appliances);
                    }}
                  />
                  <Select
                    label="Arch Location *"
                    required
                    options={[
                      { value: 'None', label: 'None' },
                      { value: 'Upper', label: 'Upper' },
                      { value: 'Lower', label: 'Lower' },
                      { value: 'Both', label: 'Both' }
                    ]}
                    value={appliance.arch || 'None'}
                    onChange={(e) => {
                      const appliances = [...(formData.oralAppliances || [])];
                      appliances[index] = { ...appliances[index], arch: e.target.value };
                      handleInputChange('oralAppliances', appliances);
                    }}
                  />
                </div>
              </div>
            ))}

            {(!formData.oralAppliances || formData.oralAppliances.length === 0) && (
              <p className="text-sm text-secondary-500 italic">No appliances added yet. Click "Add Appliance" to start.</p>
            )}

            <Textarea
              label="Appliance Notes (Optional)"
              placeholder="Any additional information about your intraoral appliances."
              value={formData.oralApplianceNotes || ''}
              onChange={(e) => handleInputChange('oralApplianceNotes', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Dental Procedures Section */}
        <AccordionSection
          id="procedures"
          title="Dental Procedures"
          icon="🔬"
          isOpen={activeAccordion === 'procedures'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-4">Select procedures you've had and provide dates:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalogs.dentalProcedures.map((procedure) => (
                <Checkbox
                  key={procedure.id}
                  label={procedure.name}
                  checked={(formData.dentalProcedures || []).some(p => p.procedureTypeId === procedure.id)}
                  onChange={(e) => {
                    const procedures = formData.dentalProcedures || [];
                    if (e.target.checked) {
                      handleInputChange('dentalProcedures', [...procedures, { procedureTypeId: procedure.id, procedureDate: '' }]);
                    } else {
                      handleInputChange('dentalProcedures', procedures.filter(p => p.procedureTypeId !== procedure.id));
                    }
                  }}
                />
              ))}
            </div>
            
            {(formData.dentalProcedures || []).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-secondary-700">Procedure Details:</h4>
                {(formData.dentalProcedures || []).map((procedure, index) => {
                  const procedureCatalog = catalogs.dentalProcedures.find(p => p.id === procedure.procedureTypeId);
                  return procedureCatalog ? (
                    <div key={index} className="bg-neutral-50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">{procedureCatalog.name}</p>
                      <Input
                        label="Date of Procedure *"
                        type="date"
                        required
                        value={procedure.procedureDate || ''}
                        onChange={(e) => {
                          const procedures = [...(formData.dentalProcedures || [])];
                          procedures[index] = { ...procedures[index], procedureDate: e.target.value };
                          handleInputChange('dentalProcedures', procedures);
                        }}
                      />
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <Textarea
              label="Procedure Notes (Optional)"
              placeholder="Any additional information about your dental procedures."
              value={formData.dentalProcedureNotes || ''}
              onChange={(e) => handleInputChange('dentalProcedureNotes', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Dental Concerns Section */}
        <AccordionSection
          id="concerns"
          title="Current Dental Concerns"
          icon="⚠️"
          isOpen={activeAccordion === 'concerns'}
          onToggle={toggleAccordion}
        >
          <Textarea
            label="Do you have any current dental concerns or issues?"
            placeholder="e.g., Toothache, Bleeding gums, Sensitivity, etc."
            value={formData.dentalConcerns || ''}
            onChange={(e) => handleInputChange('dentalConcerns', e.target.value)}
          />
        </AccordionSection>

        {/* Oral Hygiene Habits Section */}
        <AccordionSection
          id="hygiene"
          title="Oral Hygiene Habits"
          icon="🪥"
          isOpen={activeAccordion === 'hygiene'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="How often do you brush?"
              required
              options={[
                { value: 'Once a day', label: 'Once a day' },
                { value: 'Twice a day', label: 'Twice a day' },
                { value: 'Three or more times a day', label: 'Three+ times a day' },
                { value: 'Less than once a day', label: 'Less than once a day' }
              ]}
              value={formData.brushingFrequency || ''}
              onChange={(e) => handleInputChange('brushingFrequency', e.target.value)}
            />
            <Select
              label="Do you use dental floss?"
              required
              options={[
                { value: 'Daily', label: 'Daily' },
                { value: 'Several times a week', label: 'Several times a week' },
                { value: 'Occasionally', label: 'Occasionally' },
                { value: 'Never', label: 'Never' }
              ]}
              value={formData.flossingHabit || ''}
              onChange={(e) => handleInputChange('flossingHabit', e.target.value)}
            />
            <Select
              label="Do you use mouthwash?"
              required
              options={[
                { value: 'Daily', label: 'Daily' },
                { value: 'Several times a week', label: 'Several times a week' },
                { value: 'Occasionally', label: 'Occasionally' },
                { value: 'Never', label: 'Never' }
              ]}
              value={formData.mouthwashUse || ''}
              onChange={(e) => handleInputChange('mouthwashUse', e.target.value)}
            />
          </div>
        </AccordionSection>
      </div>
    </div>
  );
};

export default DentalHistoryStep;
