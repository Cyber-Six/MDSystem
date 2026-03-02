import React, { useState } from 'react';
import { Checkbox, Input, Textarea, Select } from './form-elements';

// Immunization/Vaccine options (catalog - can grow over time)
const immunizationOptions = [
  { id: 'bcg', label: 'BCG' },
  { id: 'chickenPox', label: 'Chicken Pox' },
  { id: 'hepatitisA', label: 'Hepatitis A' },
  { id: 'hepatitisB', label: 'Hepatitis B' },
  { id: 'hpv', label: 'HPV' },
  { id: 'mmr', label: 'MMR' },
  { id: 'antiTetanus', label: 'Anti-Tetanus' },
  { id: 'covidVaccine', label: 'COVID Vaccine (1st and 2nd Dose)' },
  { id: 'covidBooster', label: 'COVID Vaccine Booster' },
];

// COVID Vaccine Types (catalog)
const covidVaccineTypes = [
  { id: 'astrazeneca', label: 'Astrazeneca' },
  { id: 'janssen', label: 'Janssen' },
  { id: 'moderna', label: 'Moderna' },
  { id: 'pfizer', label: 'Pfizer' },
  { id: 'sinovac', label: 'Sinovac' },
  { id: 'sinopharm', label: 'Sinopharm' },
  { id: 'sputnik', label: 'Sputnik' },
];

// Allergy categories (catalog)
const allergyCategories = [
  { id: 'beverages', label: 'Beverages' },
  { id: 'food', label: 'Food' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'dustSmoke', label: 'Dust, Smoke' },
  { id: 'soapsLotions', label: 'Soaps, Lotions, Fabric conditioner' },
  { id: 'colognePerfume', label: 'Cologne, Perfume' },
  { id: 'fur', label: 'Fur, Animal hair' },
];

// Hospitalization reasons (catalog)
const hospitalizationReasons = [
  { id: 'vehicleAccident', label: 'Vehicle Accident' },
  { id: 'sportsInjury', label: 'Sports Injury' },
  { id: 'fallInjury', label: 'Fall/Slip Injury' },
  { id: 'workAccident', label: 'Work/School Accident' },
  { id: 'medicalCondition', label: 'Medical Condition/Illness' },
  { id: 'surgery', label: 'Scheduled Surgery' },
  { id: 'other', label: 'Other' },
];

// Medication categories (catalog)
const medicationCategories = [
  { id: 'antibiotics', label: 'Antibiotics' },
  { id: 'painRelievers', label: 'Pain Relievers' },
  { id: 'vitamins', label: 'Vitamins/Supplements' },
  { id: 'maintenance', label: 'Maintenance Medication' },
  { id: 'contraceptives', label: 'Contraceptives' },
  { id: 'antiHistamines', label: 'Anti-Histamines' },
  { id: 'other', label: 'Other' },
];

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

  const handleCovidVaccineTypeChange = (type, checked) => {
    onChange({
      ...data,
      covidVaccineType: { ...data.covidVaccineType, [type]: checked },
    });
  };

  const handleAllergyChange = (allergyId, checked) => {
    onChange({
      ...data,
      allergies: { ...data.allergies, [allergyId]: checked },
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Medical Background
        </h3>

        {/* Immunization & Vaccines (Combined) */}
        <AccordionSection
          id="immunizations"
          title="Immunization & Vaccines"
          icon={
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <p className="text-sm text-secondary-600 mb-4">Select all immunizations/vaccines you have received:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {immunizationOptions.map((option) => (
              <Checkbox
                key={option.id}
                label={option.label}
                checked={data.immunizations?.[option.id] || false}
                onChange={(e) => handleImmunizationChange(option.id, e.target.checked)}
              />
            ))}
          </div>

          {/* COVID Vaccine Type Selection */}
          {(data.immunizations?.covidVaccine || data.immunizations?.covidBooster) && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <label className="form-label mb-3">Specify COVID Vaccine Type(s):</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {covidVaccineTypes.map((type) => (
                  <Checkbox
                    key={type.id}
                    label={type.label}
                    checked={data.covidVaccineType?.[type.id] || false}
                    onChange={(e) => handleCovidVaccineTypeChange(type.id, e.target.checked)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <Input
              label="Other Vaccines (specify):"
              placeholder="Enter any other vaccines received..."
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
              <p className="text-sm text-secondary-600 mb-3">What are you allergic to? (Select all that apply)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allergyCategories.map((allergy) => (
                  <div key={allergy.id} className="flex items-start gap-2">
                    <Checkbox
                      label={allergy.label}
                      checked={data.allergies?.[allergy.id] || false}
                      onChange={(e) => handleAllergyChange(allergy.id, e.target.checked)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Input
                  label="Other allergies or specify details:"
                  placeholder="Specify additional allergies or details..."
                  value={data.allergyOther || ''}
                  onChange={(e) => handleChange('allergyOther', e.target.value)}
                />
              </div>
            </div>
          )}
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
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label mb-2">Reason for Hospitalization:</label>
                <div className="space-y-2">
                  {hospitalizationReasons.map((reason) => (
                    <label key={reason.id} className="flex items-center">
                      <input
                        type="radio"
                        name="hospitalizationReason"
                        value={reason.id}
                        checked={data.hospitalizationReason === reason.id}
                        onChange={(e) => handleChange('hospitalizationReason', e.target.value)}
                        className="form-checkbox"
                      />
                      <span className="ml-2 text-secondary-700">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <Input
                  label="Date of Admission:"
                  type="date"
                  value={data.hospitalizationDate || ''}
                  onChange={(e) => handleChange('hospitalizationDate', e.target.value)}
                />
              </div>
              
              <div>
                <Textarea
                  label="Additional Notes (optional):"
                  placeholder="Any additional details about the hospitalization..."
                  value={data.hospitalizationNotes || ''}
                  onChange={(e) => handleChange('hospitalizationNotes', e.target.value)}
                  rows={2}
                />
              </div>
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
            <p className="text-xs text-secondary-500 mb-2">(Ikaw ba ay sumailalim sa operasyon sa mga nakaraang taon?)</p>
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
            <div className="mt-4 space-y-4">
              <div>
                <Input
                  label="What procedure was performed?"
                  placeholder="e.g., Appendectomy, Cesarean Section..."
                  value={data.operationProcedure || ''}
                  onChange={(e) => handleChange('operationProcedure', e.target.value)}
                />
              </div>
              
              <div>
                <Input
                  label="Date of Operation:"
                  type="date"
                  value={data.operationDate || ''}
                  onChange={(e) => handleChange('operationDate', e.target.value)}
                />
              </div>
              
              <div>
                <Textarea
                  label="Additional Notes (optional):"
                  placeholder="Any additional details about the operation..."
                  value={data.operationNotes || ''}
                  onChange={(e) => handleChange('operationNotes', e.target.value)}
                  rows={2}
                />
              </div>
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
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label mb-2">Medication Category:</label>
                <div className="flex flex-wrap gap-2">
                  {medicationCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        data.medicationCategory === category.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-100 text-secondary-700 hover:bg-neutral-200'
                      }`}
                      onClick={() => handleChange('medicationCategory', category.id)}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <Textarea
                  label="Reason for taking medication:"
                  placeholder="Why are you taking this medication?"
                  value={data.medicationReason || ''}
                  onChange={(e) => handleChange('medicationReason', e.target.value)}
                  rows={2}
                />
              </div>
              
              <div>
                <Input
                  label="Medication Name(s):"
                  placeholder="List the medication names..."
                  value={data.medicationDetails || ''}
                  onChange={(e) => handleChange('medicationDetails', e.target.value)}
                />
              </div>
            </div>
          )}
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
                  label="Frequency"
                  placeholder="e.g., 2 bottles per week"
                  value={data.alcoholFrequency || ''}
                  onChange={(e) => handleChange('alcoholFrequency', e.target.value.slice(0, 30))}
                  maxLength={30}
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
      </div>
    </div>
  );
};

export default MedicalBackgroundForm;
