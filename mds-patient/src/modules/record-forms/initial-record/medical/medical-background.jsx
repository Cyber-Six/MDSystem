import React, { useState } from 'react';
import { Checkbox, Input, Textarea, AccordionSection, Select } from './form-elements';

const LIFESTYLE_FREQUENCY_OPTIONS = [
  { value: 'Daily',        label: 'Daily' },
  { value: 'Weekly',       label: 'Weekly' },
  { value: 'Monthly',      label: 'Monthly' },
  { value: 'Occasionally', label: 'Occasionally' },
  { value: 'Rare',         label: 'Rare' },
];

const VAPE_TYPE_OPTIONS = [
  { value: 'Nicotine', label: 'Nicotine' },
  { value: 'CBD',      label: 'CBD' },
  { value: 'THC',      label: 'THC' },
  { value: 'Flavored', label: 'Flavored' },
];

// Allergen type display order
const ALLERGEN_TYPE_ORDER = ['Food', 'Drug', 'Environmental', 'Insect', 'Chemical', 'Other'];

/**
 * MedicalBackgroundForm
 *
 * Renders immunizations, allergies, hospitalizations, operations, medications,
 * lifestyle, and visual acuity sections entirely from backend catalogs.
 *
 * Props:
 *  data                    - medicalBackground form state
 *  onChange                - update handler
 *  immunizationCatalog     - [{ id, code, name }]
 *  allergenCatalog         - [{ id, allergen, type }]
 *  hospitalizationCatalog  - [{ id, code, name }]
 *  operationCatalog        - [{ id, code, name }]
 *  medicationCatalog       - [{ id, code, name }]
 *  catalogsLoading         - boolean
 */
const MedicalBackgroundForm = ({
  data,
  onChange,
  immunizationCatalog = [],
  allergenCatalog = [],
  hospitalizationCatalog = [],
  operationCatalog = [],
  medicationCatalog = [],
  catalogsLoading = false,
  fieldErrors = {},
  onClearFieldError = () => {},
}) => {
  const [activeAccordion, setActiveAccordion] = useState('immunizations');

  const handleChange = (field, value) => {
    onClearFieldError(field);
    onChange({ ...data, [field]: value });
  };

  const handleCatalogToggle = (field, id, checked) => {
    onChange({ ...data, [field]: { ...data[field], [id]: checked } });
  };

  const handleAllergyToggle = (allergenId, checked) => {
    const current = data.allergies?.[allergenId];
    const severity = (typeof current === 'object' && current?.severity) ? current.severity : 'Unknown';
    onChange({ ...data, allergies: { ...data.allergies, [allergenId]: { checked, severity } } });
  };

  const handleAllergySeverity = (allergenId, severity) => {
    const current = data.allergies?.[allergenId];
    const prevChecked = typeof current === 'object' ? !!current?.checked : !!current;
    onChange({ ...data, allergies: { ...data.allergies, [allergenId]: { checked: prevChecked, severity } } });
  };

  const toggleAccordion = (section) => {
    setActiveAccordion(activeAccordion === section ? null : section);
  };

  const CatalogLoader = () => (
    <div className="flex items-center gap-2 text-sm text-secondary-500 py-4">
      <svg className="animate-spin w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading options...
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg">
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
          isOpen={activeAccordion === 'immunizations'}
          onToggle={toggleAccordion}
          icon={
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <p className="text-sm text-secondary-600 mb-4">Select all immunizations/vaccines you have received:</p>
          {catalogsLoading ? (
            <CatalogLoader />
          ) : immunizationCatalog.length === 0 ? (
            <p className="text-sm text-secondary-400 italic">No vaccines available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {immunizationCatalog.map((vaccine) => (
                <Checkbox
                  key={vaccine.id}
                  label={vaccine.name}
                  checked={data.immunizations?.[vaccine.id] || false}
                  onChange={(e) => handleCatalogToggle('immunizations', vaccine.id, e.target.checked)}
                />
              ))}
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
          isOpen={activeAccordion === 'allergies'}
          onToggle={toggleAccordion}
          icon={
            <svg className="w-5 h-5 mr-2 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">Do you have any Allergies?</label>
            <div className="flex gap-4 mt-2">
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
              {catalogsLoading ? (
                <CatalogLoader />
              ) : allergenCatalog.length === 0 ? (
                <p className="text-sm text-secondary-400 italic">No allergens available.</p>
              ) : (
                <div className="space-y-4">
                  {ALLERGEN_TYPE_ORDER.filter(type =>
                    allergenCatalog.some(a => a.type === type)
                  ).map((type) => (
                    <div key={type}>
                      <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">{type}</p>
                      <div className="space-y-2 ml-2">
                        {allergenCatalog
                          .filter(a => a.type === type)
                          .map((allergen) => {
                            const allergyVal = data.allergies?.[allergen.id];
                            const isChecked = typeof allergyVal === 'object' ? !!allergyVal?.checked : !!allergyVal;
                            const severity = typeof allergyVal === 'object' ? (allergyVal?.severity || 'Unknown') : 'Unknown';
                            return (
                              <div key={allergen.id}>
                                <Checkbox
                                  label={allergen.allergen}
                                  checked={isChecked}
                                  onChange={(e) => handleAllergyToggle(allergen.id, e.target.checked)}
                                />
                                {isChecked && (
                                  <div className="ml-6 mt-1 mb-1">
                                    <select
                                      className="form-input text-xs py-1 px-2"
                                      value={severity}
                                      onChange={(e) => handleAllergySeverity(allergen.id, e.target.value)}
                                    >
                                      <option value="Unknown">Severity: Unknown</option>
                                      <option value="Mild">Severity: Mild</option>
                                      <option value="Moderate">Severity: Moderate</option>
                                      <option value="Severe">Severity: Severe</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          isOpen={activeAccordion === 'hospitalizations'}
          onToggle={toggleAccordion}
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        >
          <div className={`mb-4 ${fieldErrors.hasHospitalization ? 'border-2 border-error-500 rounded-lg p-4 bg-error-50' : ''}`}>
            <label className="form-label">HAVE YOU BEEN HOSPITALIZED IN THE PAST YEARS? <span className="text-error-500">*</span></label>
            <p className="text-xs text-secondary-500 mb-2">(Ikaw ba ay na-ospital sa mga nakaraang taon?)</p>
            <div className="flex gap-4 mt-2">
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
            {fieldErrors.hasHospitalization && (
              <p className="text-sm text-error-600 mt-2">{fieldErrors.hasHospitalization}</p>
            )}
          </div>
          
          {data.hasHospitalization === 'Yes' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label mb-2">Reason(s) for Hospitalization: <span className="text-xs text-secondary-500">(Select all that apply)</span></label>
                {catalogsLoading ? (
                  <CatalogLoader />
                ) : hospitalizationCatalog.length === 0 ? (
                  <p className="text-sm text-secondary-400 italic">No conditions available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {hospitalizationCatalog.map((condition) => (
                      <Checkbox
                        key={condition.id}
                        label={condition.name}
                        checked={data.hospitalizationConditions?.[condition.id] || false}
                        onChange={(e) => handleCatalogToggle('hospitalizationConditions', condition.id, e.target.checked)}
                      />
                    ))}
                  </div>
                )}
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
          isOpen={activeAccordion === 'operations'}
          onToggle={toggleAccordion}
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        >
          <div className={`mb-4 ${fieldErrors.hasOperation ? 'border-2 border-error-500 rounded-lg p-4 bg-error-50' : ''}`}>
            <label className="form-label">HAVE YOU UNDERGONE SURGERY IN THE PAST YEARS? <span className="text-error-500">*</span></label>
            <p className="text-xs text-secondary-500 mb-2">(Ikaw ba ay sumailalim sa operasyon sa mga nakaraang taon?)</p>
            <div className="flex gap-4 mt-2">
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
            {fieldErrors.hasOperation && (
              <p className="text-sm text-error-600 mt-2">{fieldErrors.hasOperation}</p>
            )}
          </div>
          
          {data.hasOperation === 'Yes' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label mb-2">Type of Operation(s): <span className="text-xs text-secondary-500">(Select all that apply)</span></label>
                {catalogsLoading ? (
                  <CatalogLoader />
                ) : operationCatalog.length === 0 ? (
                  <p className="text-sm text-secondary-400 italic">No procedures available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {operationCatalog.map((procedure) => (
                      <Checkbox
                        key={procedure.id}
                        label={procedure.name}
                        checked={data.operationConditions?.[procedure.id] || false}
                        onChange={(e) => handleCatalogToggle('operationConditions', procedure.id, e.target.checked)}
                      />
                    ))}
                  </div>
                )}
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
          isOpen={activeAccordion === 'medications'}
          onToggle={toggleAccordion}
          icon={
            <svg className="w-5 h-5 mr-2 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        >
          <div className="mb-4">
            <label className="form-label">Are you taking any Medications?</label>
            <div className="flex gap-4 mt-2">
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
                <label className="form-label mb-2">Select Medication(s): <span className="text-xs text-secondary-500">(Select all that apply)</span></label>
                {catalogsLoading ? (
                  <CatalogLoader />
                ) : medicationCatalog.length === 0 ? (
                  <p className="text-sm text-secondary-400 italic">No medications available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {medicationCatalog.map((medicine) => (
                      <Checkbox
                        key={medicine.id}
                        label={medicine.name}
                        checked={data.selectedMedications?.[medicine.id] || false}
                        onChange={(e) => handleCatalogToggle('selectedMedications', medicine.id, e.target.checked)}
                      />
                    ))}
                  </div>
                )}
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
                <Textarea
                  label="Additional notes (optional):"
                  placeholder="Any other medications or details..."
                  value={data.medicationNotes || ''}
                  onChange={(e) => handleChange('medicationNotes', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </AccordionSection>

        {/* Lifestyle */}
        <AccordionSection
          id="lifestyle"
          title="Lifestyle"
          isOpen={activeAccordion === 'lifestyle'}
          onToggle={toggleAccordion}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <Select
                  label="Frequency"
                  options={LIFESTYLE_FREQUENCY_OPTIONS}
                  value={data.alcoholFrequency || ''}
                  onChange={(e) => handleChange('alcoholFrequency', e.target.value)}
                />
              )}
            </div>

            {/* Vaper */}
            <div className="border-l-4 border-primary-500 pl-4">
              <h4 className="font-semibold text-secondary-700 mb-3">Vaper</h4>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="vaper"
                    value="no"
                    checked={data.vaper === 'no'}
                    onChange={(e) => handleChange('vaper', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">No</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="vaper"
                    value="yes"
                    checked={data.vaper === 'yes'}
                    onChange={(e) => handleChange('vaper', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2">Yes</span>
                </label>
              </div>
              {data.vaper === 'yes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Vape Type"
                    options={VAPE_TYPE_OPTIONS}
                    value={data.vapeType || ''}
                    onChange={(e) => handleChange('vapeType', e.target.value)}
                  />
                  <Select
                    label="Frequency"
                    options={LIFESTYLE_FREQUENCY_OPTIONS}
                    value={data.vapeFrequency || ''}
                    onChange={(e) => handleChange('vapeFrequency', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </AccordionSection>

        {/* Visual Acuity */}
        <AccordionSection
          id="visual"
          title="Visual Acuity"
          isOpen={activeAccordion === 'visual'}
          onToggle={toggleAccordion}
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
