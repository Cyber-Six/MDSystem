import React, { useState } from 'react';
import { Checkbox, Input, Textarea, Select } from './form-elements';

const MedicalBackgroundForm = ({ data, onChange }) => {
  const [activeAccordion, setActiveAccordion] = useState('immunizations');

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const handleImmunizationChange = (vaccine, checked) => {
    onChange({
      ...data,
      immunizations: { ...data.immunizations, [vaccine]: checked },
    });
  };

  const toggleAccordion = (section) => {
    setActiveAccordion(activeAccordion === section ? '' : section);
  };

  const AccordionSection = ({ title, icon, id, children }) => (
    <div className="border-2 border-neutral-200 rounded-xl mb-4 overflow-hidden">
      <button
        className="w-full px-6 py-4 flex items-center justify-between bg-neutral-50 hover:bg-primary-50 transition-colors"
        onClick={() => toggleAccordion(id)}
      >
        <div className="flex items-center">
          {icon}
          <span className="font-semibold text-secondary-800">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-secondary-500 transition-transform ${
            activeAccordion === id ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {activeAccordion === id && <div className="p-6 bg-white">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Medical Background & Lifestyle
        </h3>

        {/* Immunizations */}
        <AccordionSection
          id="immunizations"
          title="Immunizations"
          icon={
            <svg className="w-5 h-5 mr-2 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <p className="text-sm text-secondary-600 mb-4">Have you had any vaccinations from these?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Checkbox
              label="BCG"
              checked={data.immunizations?.bcg || false}
              onChange={(e) => handleImmunizationChange('bcg', e.target.checked)}
            />
            <Checkbox
              label="Chicken Pox"
              checked={data.immunizations?.chickenPox || false}
              onChange={(e) => handleImmunizationChange('chickenPox', e.target.checked)}
            />
            <Checkbox
              label="Hepatitis A"
              checked={data.immunizations?.hepatitisA || false}
              onChange={(e) => handleImmunizationChange('hepatitisA', e.target.checked)}
            />
            <Checkbox
              label="Hepatitis B"
              checked={data.immunizations?.hepatitisB || false}
              onChange={(e) => handleImmunizationChange('hepatitisB', e.target.checked)}
            />
            <Checkbox
              label="HPV"
              checked={data.immunizations?.hpv || false}
              onChange={(e) => handleImmunizationChange('hpv', e.target.checked)}
            />
            <Checkbox
              label="MMR (Measles, Mumps, Rubella)"
              checked={data.immunizations?.mmr || false}
              onChange={(e) => handleImmunizationChange('mmr', e.target.checked)}
            />
            <Checkbox
              label="Anti-Tetanus"
              checked={data.immunizations?.antiTetanus || false}
              onChange={(e) => handleImmunizationChange('antiTetanus', e.target.checked)}
            />
            <Checkbox
              label="COVID Vaccine (1st and 2nd Dose)"
              checked={data.immunizations?.covidVaccine || false}
              onChange={(e) => handleImmunizationChange('covidVaccine', e.target.checked)}
            />
            <Checkbox
              label="COVID Vaccine Booster"
              checked={data.immunizations?.covidBooster || false}
              onChange={(e) => handleImmunizationChange('covidBooster', e.target.checked)}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Other:"
              placeholder="Specify other vaccines..."
              value={data.immunizationOther || ''}
              onChange={(e) => handleChange('immunizationOther', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Allergies */}
        <AccordionSection
          id="allergies"
          title="History of Allergies"
          icon={
            <svg className="w-5 h-5 mr-2 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">Do you have any Allergies?</label>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasAllergies"
                  value="Yes"
                  checked={data.hasAllergies === 'Yes'}
                  onChange={(e) => handleChange('hasAllergies', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasAllergies"
                  value="No"
                  checked={data.hasAllergies === 'No'}
                  onChange={(e) => handleChange('hasAllergies', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>
          
          {data.hasAllergies === 'Yes' && (
            <div className="mt-4">
              <p className="text-sm text-secondary-600 mb-3">If Yes, What are you allergic to?</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Checkbox
                  label="Beverages (Please Specify)"
                  checked={data.allergies?.beverages || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, beverages: e.target.checked } })}
                />
                <Checkbox
                  label="Food (Please Specify)"
                  checked={data.allergies?.food || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, food: e.target.checked } })}
                />
                <Checkbox
                  label="Medicine (Please Specify)"
                  checked={data.allergies?.medicine || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, medicine: e.target.checked } })}
                />
                <Checkbox
                  label="Others (Dust, Smoke)"
                  checked={data.allergies?.dustSmoke || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, dustSmoke: e.target.checked } })}
                />
                <Checkbox
                  label="Others (Soaps, Lotions, Fabric conditioner)"
                  checked={data.allergies?.soapsLotions || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, soapsLotions: e.target.checked } })}
                />
                <Checkbox
                  label="Others (Cologne, Perfume)"
                  checked={data.allergies?.colognePerfume || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, colognePerfume: e.target.checked } })}
                />
                <Checkbox
                  label="Others (Fur etc.)"
                  checked={data.allergies?.fur || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, fur: e.target.checked } })}
                />
                <Checkbox
                  label="Others (Please specify)"
                  checked={data.allergies?.othersSpecify || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, othersSpecify: e.target.checked } })}
                />
                <Checkbox
                  label="None"
                  checked={data.allergies?.none || false}
                  onChange={(e) => onChange({ ...data, allergies: { ...data.allergies, none: e.target.checked } })}
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Other:"
                  placeholder="Specify other allergies..."
                  value={data.allergyOther || ''}
                  onChange={(e) => handleChange('allergyOther', e.target.value)}
                />
              </div>
            </div>
          )}
        </AccordionSection>

        {/* Vaccine Section */}
        <AccordionSection
          id="vaccine"
          title="Vaccine"
          icon={
            <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          {/* COVID Vaccine Type */}
          <div className="mb-6">
            <label className="form-label mb-3">What type of COVID Vaccine?</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Checkbox
                label="Astrazeneca"
                checked={data.covidVaccineType?.astrazeneca || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, astrazeneca: e.target.checked } })}
              />
              <Checkbox
                label="Janssen"
                checked={data.covidVaccineType?.janssen || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, janssen: e.target.checked } })}
              />
              <Checkbox
                label="Moderna"
                checked={data.covidVaccineType?.moderna || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, moderna: e.target.checked } })}
              />
              <Checkbox
                label="Pfizer"
                checked={data.covidVaccineType?.pfizer || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, pfizer: e.target.checked } })}
              />
              <Checkbox
                label="Sinovac"
                checked={data.covidVaccineType?.sinovac || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, sinovac: e.target.checked } })}
              />
              <Checkbox
                label="Sinopharm"
                checked={data.covidVaccineType?.sinopharm || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, sinopharm: e.target.checked } })}
              />
              <Checkbox
                label="Sputnik"
                checked={data.covidVaccineType?.sputnik || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, sputnik: e.target.checked } })}
              />
              <Checkbox
                label="None"
                checked={data.covidVaccineType?.none || false}
                onChange={(e) => onChange({ ...data, covidVaccineType: { ...data.covidVaccineType, none: e.target.checked } })}
              />
            </div>
          </div>

          {/* COVID Vaccine Booster Type */}
          <div className="mb-6">
            <label className="form-label mb-3">What type of COVID Vaccine Booster?</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Checkbox
                label="Astrazeneca"
                checked={data.covidBoosterType?.astrazeneca || false}
                onChange={(e) => onChange({ ...data, covidBoosterType: { ...data.covidBoosterType, astrazeneca: e.target.checked } })}
              />
              <Checkbox
                label="Moderna"
                checked={data.covidBoosterType?.moderna || false}
                onChange={(e) => onChange({ ...data, covidBoosterType: { ...data.covidBoosterType, moderna: e.target.checked } })}
              />
              <Checkbox
                label="Pfizer"
                checked={data.covidBoosterType?.pfizer || false}
                onChange={(e) => onChange({ ...data, covidBoosterType: { ...data.covidBoosterType, pfizer: e.target.checked } })}
              />
              <Checkbox
                label="Sinovac"
                checked={data.covidBoosterType?.sinovac || false}
                onChange={(e) => onChange({ ...data, covidBoosterType: { ...data.covidBoosterType, sinovac: e.target.checked } })}
              />
              <Checkbox
                label="None"
                checked={data.covidBoosterType?.none || false}
                onChange={(e) => onChange({ ...data, covidBoosterType: { ...data.covidBoosterType, none: e.target.checked } })}
              />
            </div>
            <div className="mt-4">
              <Input
                label="Other:"
                placeholder="Specify other booster type..."
                value={data.covidBoosterOther || ''}
                onChange={(e) => handleChange('covidBoosterOther', e.target.value)}
              />
            </div>
          </div>

          {/* Other Vaccine */}
          <div>
            <Textarea
              label="Other Vaccine?"
              placeholder="Please specify any other vaccines..."
              value={data.otherVaccine || ''}
              onChange={(e) => handleChange('otherVaccine', e.target.value)}
              rows={3}
            />
          </div>
        </AccordionSection>

        {/* History of Hospitalizations */}
        <AccordionSection
          id="hospitalizations"
          title="History of Hospitalizations"
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">HAVE YOU BEEN HOSPITALIZED IN THE PAST YEARS? <span className="text-error-500">*</span></label>
            <p className="text-xs text-secondary-500 mb-2">(Ikaw ba ay na-ospital sa mga nakaraang taon?)</p>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasHospitalization"
                  value="Yes"
                  checked={data.hasHospitalization === 'Yes'}
                  onChange={(e) => handleChange('hasHospitalization', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasHospitalization"
                  value="No"
                  checked={data.hasHospitalization === 'No'}
                  onChange={(e) => handleChange('hasHospitalization', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>
          
          {data.hasHospitalization === 'Yes' && (
            <div className="mt-4">
              <Textarea
                label="If Yes, When did you've been hospitalized? What is the reason for the hospitalization?"
                placeholder="Your answer"
                value={data.hospitalizationDetails || ''}
                onChange={(e) => handleChange('hospitalizationDetails', e.target.value)}
                rows={3}
              />
            </div>
          )}
        </AccordionSection>

        {/* History of Operation */}
        <AccordionSection
          id="operations"
          title="History of Operation"
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">HAVE YOU UNDERGONE SURGERY IN THE PAST YEARS? <span className="text-error-500">*</span></label>
            <p className="text-xs text-secondary-500 mb-2">( Ikaw ba ay sumailalim sa operasyon sa mga nakaraang taon? )</p>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasOperation"
                  value="Yes"
                  checked={data.hasOperation === 'Yes'}
                  onChange={(e) => handleChange('hasOperation', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasOperation"
                  value="No"
                  checked={data.hasOperation === 'No'}
                  onChange={(e) => handleChange('hasOperation', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>
          
          {data.hasOperation === 'Yes' && (
            <div className="mt-4">
              <Textarea
                label="If Yes, What kind of Operations? and When?"
                placeholder="Your answer"
                value={data.operationDetails || ''}
                onChange={(e) => handleChange('operationDetails', e.target.value)}
                rows={3}
              />
            </div>
          )}
        </AccordionSection>

        {/* Medications */}
        <AccordionSection
          id="medications"
          title="Medications"
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">Are you taking any Medications?</label>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasMedications"
                  value="Yes"
                  checked={data.hasMedications === 'Yes'}
                  onChange={(e) => handleChange('hasMedications', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasMedications"
                  value="No"
                  checked={data.hasMedications === 'No'}
                  onChange={(e) => handleChange('hasMedications', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>
          
          {data.hasMedications === 'Yes' && (
            <div className="mt-4">
              <Textarea
                label="If Yes, What Medication/s are you taking ?"
                placeholder="Your answer"
                value={data.medicationDetails || ''}
                onChange={(e) => handleChange('medicationDetails', e.target.value)}
                rows={3}
              />
            </div>
          )}
        </AccordionSection>

        {/* Body Modifications */}
        <AccordionSection
          id="modifications"
          title="Body Modifications"
          icon={
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tattoo"
              placeholder="Location (if any)"
              value={data.tattooLocation || ''}
              onChange={(e) => handleChange('tattooLocation', e.target.value)}
            />
            <Input
              label="Piercing"
              placeholder="Location (if any)"
              value={data.piercingLocation || ''}
              onChange={(e) => handleChange('piercingLocation', e.target.value)}
            />
          </div>
        </AccordionSection>

        {/* Lifestyle */}
        <AccordionSection
          id="lifestyle"
          title="Lifestyle"
          icon={
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="space-y-6">
            {/* Smoker */}
            <div className="border-l-4 border-warning-500 pl-4">
              <h4 className="font-semibold text-secondary-700 mb-3">Smoker</h4>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="smoker"
                    value="no"
                    checked={data.smoker === 'no'}
                    onChange={(e) => handleChange('smoker', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">No</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="smoker"
                    value="yes"
                    checked={data.smoker === 'yes'}
                    onChange={(e) => handleChange('smoker', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">Yes</span>
                </label>
              </div>
              {data.smoker === 'yes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Sticks per day"
                    type="number"
                    placeholder="Number of sticks"
                    value={data.smokerSticksPerDay || ''}
                    onChange={(e) => handleChange('smokerSticksPerDay', e.target.value)}
                  />
                  <Input
                    label="Number of years"
                    type="number"
                    placeholder="Years"
                    value={data.smokerYears || ''}
                    onChange={(e) => handleChange('smokerYears', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Alcohol */}
            <div className="border-l-4 border-accent-500 pl-4">
              <h4 className="font-semibold text-secondary-700 mb-3">Alcohol Drinker</h4>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="alcoholDrinker"
                    value="no"
                    checked={data.alcoholDrinker === 'no'}
                    onChange={(e) => handleChange('alcoholDrinker', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">No</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="alcoholDrinker"
                    value="yes"
                    checked={data.alcoholDrinker === 'yes'}
                    onChange={(e) => handleChange('alcoholDrinker', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">Yes</span>
                </label>
              </div>
              {data.alcoholDrinker === 'yes' && (
                <Input
                  label="Number of bottles / frequency"
                  placeholder="e.g., 2 bottles per week"
                  value={data.alcoholFrequency || ''}
                  onChange={(e) => handleChange('alcoholFrequency', e.target.value)}
                />
              )}
            </div>
          </div>
        </AccordionSection>

        {/* Visual Acuity */}
        <AccordionSection
          id="visual"
          title="Visual Acuity"
          icon={
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Checkbox
                  label="Eyeglasses"
                  checked={data.eyeglasses || false}
                  onChange={(e) => handleChange('eyeglasses', e.target.checked)}
                />
              </div>
              <div>
                <Checkbox
                  label="Contact Lenses"
                  checked={data.contactLenses || false}
                  onChange={(e) => handleChange('contactLenses', e.target.checked)}
                />
              </div>
            </div>
            {(data.eyeglasses || data.contactLenses) && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Grade: OD (Right Eye)"
                    placeholder="e.g., -2.00"
                    value={data.gradeOD || ''}
                    onChange={(e) => handleChange('gradeOD', e.target.value)}
                  />
                  <Input
                    label="Grade: OS (Left Eye)"
                    placeholder="e.g., -1.75"
                    value={data.gradeOS || ''}
                    onChange={(e) => handleChange('gradeOS', e.target.value)}
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={data.visualAcuityDate || ''}
                    onChange={(e) => handleChange('visualAcuityDate', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </AccordionSection>

        {/* Physical Measurements */}
        <AccordionSection
          id="measurements"
          title="Physical Measurements"
          icon={
            <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Height (cm)"
              type="number"
              placeholder="Enter height"
              value={data.height || ''}
              onChange={(e) => handleChange('height', e.target.value)}
            />
            <Input
              label="Weight (kg)"
              type="number"
              placeholder="Enter weight"
              value={data.weight || ''}
              onChange={(e) => handleChange('weight', e.target.value)}
            />
          </div>
        </AccordionSection>
      </div>
    </div>
  );
};

export default MedicalBackgroundForm;
