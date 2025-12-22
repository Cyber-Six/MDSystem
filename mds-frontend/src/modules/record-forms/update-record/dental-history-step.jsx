import React, { useState } from 'react';
import { Input, Select, Checkbox, Textarea, AccordionSection } from './form-elements';

const DentalHistoryStep = ({ formData, onChange }) => {
  const [activeAccordion, setActiveAccordion] = useState('visits');

  const dentalProcedures = [
    'Tooth Extraction',
    'Filling/Restoration',
    'Root Canal',
    'Crown/Bridge',
    'Dentures',
    'Orthodontic Treatment (Braces)',
    'Dental Implant',
    'Teeth Whitening',
    'Gum Treatment',
    'Other'
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
                Have you visited a dentist?
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visitedDentist"
                    value="yes"
                    checked={formData.visitedDentist === 'yes'}
                    onChange={(e) => handleInputChange('visitedDentist', e.target.value)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visitedDentist"
                    value="no"
                    checked={formData.visitedDentist === 'no'}
                    onChange={(e) => handleInputChange('visitedDentist', e.target.value)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visitedDentist"
                    value="idk"
                    checked={formData.visitedDentist === 'idk'}
                    onChange={(e) => handleInputChange('visitedDentist', e.target.value)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">I don't know</span>
                </label>
              </div>
            </div>
            
            {formData.visitedDentist === 'yes' && (
              <Input
                label="When was your last dental consultation?"
                type="date"
                value={formData.lastDentalConsultation || ''}
                onChange={(e) => handleInputChange('lastDentalConsultation', e.target.value)}
              />
            )}

            <Select
              label="When was your last dental cleaning?"
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
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-2">
                Do you use any intra-oral appliances? (e.g., braces, retainers, dentures)
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasIntraoralAppliances"
                    value="yes"
                    checked={formData.hasIntraoralAppliances === 'yes'}
                    onChange={(e) => handleInputChange('hasIntraoralAppliances', e.target.value)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasIntraoralAppliances"
                    value="no"
                    checked={formData.hasIntraoralAppliances === 'no'}
                    onChange={(e) => handleInputChange('hasIntraoralAppliances', e.target.value)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">No</span>
                </label>
              </div>
            </div>
            
            {formData.hasIntraoralAppliances === 'yes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-neutral-50 dark:bg-secondary-700 rounded-lg border border-neutral-200 dark:border-secondary-600">
                <Input
                  label="Type of appliance"
                  placeholder="e.g., Braces, Retainer, Dentures"
                  value={formData.intraoralApplianceType || ''}
                  onChange={(e) => handleInputChange('intraoralApplianceType', e.target.value)}
                />
                <Input
                  label="Location (which teeth/area)"
                  placeholder="e.g., Upper teeth, Lower teeth, Both"
                  value={formData.intraoralApplianceLocation || ''}
                  onChange={(e) => handleInputChange('intraoralApplianceLocation', e.target.value)}
                />
              </div>
            )}
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
            <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-4">Check all procedures you've had:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dentalProcedures.map((procedure) => (
                <Checkbox
                  key={procedure}
                  label={procedure}
                  checked={(formData.dentalProcedures || []).includes(procedure)}
                  onChange={(e) => handleCheckboxChange('dentalProcedures', procedure, e.target.checked)}
                />
              ))}
            </div>
            
            {(formData.dentalProcedures || []).includes('Other') && (
              <Textarea
                label="Please specify other procedure"
                placeholder="Describe the procedure..."
                value={formData.dentalProceduresOther || ''}
                onChange={(e) => handleInputChange('dentalProceduresOther', e.target.value)}
              />
            )}
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
