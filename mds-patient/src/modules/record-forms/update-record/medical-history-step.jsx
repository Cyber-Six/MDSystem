import React, { useState, useEffect, useRef } from 'react';
import { Input, Select, Checkbox, Textarea, AccordionSection, TabGroup, RadioButton } from './form-elements';
import { fetchAllMedicalCatalogs } from './medical-history-service';
import { useBanner } from '../../../context/use-banner.js';
import {
  searchImmunizationCatalog,
  createImmunizationCatalog,
  searchDomainCatalog,
  createDomainCatalog,
  searchAllergenCatalogByName,
  createAllergenCatalogEntry,
} from '@core/services/emr-service';

const LIFESTYLE_FREQUENCY_OPTIONS = [
  { value: 'Daily',      label: 'Daily' },
  { value: 'Weekly',     label: 'Weekly' },
  { value: 'Monthly',    label: 'Monthly' },
  { value: 'Occasional', label: 'Occasionally' },
  { value: 'Rare',       label: 'Rare' },
];

const VAPE_TYPE_OPTIONS = [
  { value: 'Nicotine', label: 'Nicotine' },
  { value: 'CBD',      label: 'CBD' },
  { value: 'THC',      label: 'THC' },
  { value: 'Flavored', label: 'Flavored' },
];

const ALLERGEN_TYPE_OPTIONS = [
  { value: 'Food', label: 'Food' },
  { value: 'Drug', label: 'Drug' },
  { value: 'Environmental', label: 'Environmental' },
  { value: 'Insect', label: 'Insect' },
  { value: 'Chemical', label: 'Chemical' },
  { value: 'Other', label: 'Other' },
];

const ALLERGEN_TYPE_ORDER = ['Food', 'Drug', 'Environmental', 'Insect', 'Chemical', 'Other'];

// Reusable search+create "Others" hook
function useCatalogSearch({ catalog, searchFn, createFn, nameKey = 'name' }) {
  const [dynamicItems, setDynamicItems] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value) => {
    setInput(value);
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setSuggestions([]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    const allLoaded = [...catalog, ...dynamicItems];
    const seen = new Set();
    const localMatches = allLoaded.filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return (v[nameKey] || '').toLowerCase().includes(trimmed);
    });
    setSuggestions(localMatches);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const dbResults = await searchFn(value.trim());
        const mergedMap = new Map();
        dbResults.forEach((v) => mergedMap.set(v.id, v));
        localMatches.forEach((v) => { if (!mergedMap.has(v.id)) mergedMap.set(v.id, v); });
        setSuggestions(Array.from(mergedMap.values()));
      } catch {
        // Keep local matches on error
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectItem = (item) => {
    const alreadyInMain = catalog.some((v) => v.id === item.id);
    const alreadyInDynamic = dynamicItems.some((v) => v.id === item.id);
    if (!alreadyInMain && !alreadyInDynamic) {
      setDynamicItems((prev) => [...prev, item]);
    }
    setInput('');
    setSuggestions([]);
    setFocused(false);
    return item;
  };

  const createItem = async (...args) => {
    setCreating(true);
    try {
      const created = await createFn(...args);
      if (created.length > 0) {
        const newItem = created[0];
        setDynamicItems((prev) => [...prev, newItem]);
        setInput('');
        setSuggestions([]);
        setFocused(false);
        return newItem;
      }
    } catch (err) {
      console.error('[CatalogSearch] Failed to create catalog entry:', err.message);
    } finally {
      setCreating(false);
    }
    return null;
  };

  return {
    dynamicItems, input, suggestions, creating, searching, focused,
    wrapperRef, setFocused, handleInputChange, selectItem, createItem,
  };
}

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

  // ── Catalog search hooks ──
  const immunizationOthers = useCatalogSearch({
    catalog: catalogs.immunizations,
    searchFn: searchImmunizationCatalog,
    createFn: (name) => createImmunizationCatalog(name),
  });

  const allergenOthers = useCatalogSearch({
    catalog: catalogs.allergens,
    searchFn: searchAllergenCatalogByName,
    createFn: (name, type) => createAllergenCatalogEntry(name, type),
    nameKey: 'allergen',
  });
  const [allergenTypeForCreate, setAllergenTypeForCreate] = useState('Other');

  const hospitalizationOthers = useCatalogSearch({
    catalog: catalogs.hospitalizations,
    searchFn: (q) => searchDomainCatalog('Hospitalization', q),
    createFn: (name) => createDomainCatalog('Hospitalization', name),
  });

  const operationOthers = useCatalogSearch({
    catalog: catalogs.operations,
    searchFn: (q) => searchDomainCatalog('Operation', q),
    createFn: (name) => createDomainCatalog('Operation', name),
  });

  const medicationOthers = useCatalogSearch({
    catalog: catalogs.medications,
    searchFn: (q) => searchDomainCatalog('Medication', q),
    createFn: (name) => createDomainCatalog('Medication', name),
  });

  const medicalConditionOthers = useCatalogSearch({
    catalog: [],
    searchFn: (q) => searchDomainCatalog('MedicalCondition', q),
    createFn: (name) => createDomainCatalog('MedicalCondition', name),
  });

  // Merge dynamic items with catalogs for lookups
  const allAllergens = [...catalogs.allergens, ...allergenOthers.dynamicItems];

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
              {/* Dynamically added medical conditions from search */}
              {medicalConditionOthers.dynamicItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                  {medicalConditionOthers.dynamicItems.map((condition) => (
                    <Checkbox
                      key={condition.id}
                      label={condition.name}
                      checked={formData.selfConditions?.[condition.id] || false}
                      onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
                    />
                  ))}
                </div>
              )}
              {/* Search or add medical conditions */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Conditions (search or add):</label>
                <div ref={medicalConditionOthers.wrapperRef}>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="Type to search for a condition..."
                    value={medicalConditionOthers.input}
                    autoComplete="off"
                    onFocus={() => medicalConditionOthers.setFocused(true)}
                    onChange={(e) => medicalConditionOthers.handleInputChange(e.target.value)}
                  />
                  {medicalConditionOthers.focused && medicalConditionOthers.input.trim() && (
                    <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                      {medicalConditionOthers.searching && (
                        <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                      )}
                      {medicalConditionOthers.suggestions.length > 0 ? (
                        <>
                          {medicalConditionOthers.suggestions.map(result => (
                            <button
                              key={result.id}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                              onMouseDown={(e) => { e.preventDefault(); const item = medicalConditionOthers.selectItem(result); handleSelfConditionChange(item.id, true); }}
                            >
                              {result.name}
                              {formData.selfConditions?.[result.id] && (
                                <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                              )}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                            disabled={medicalConditionOthers.creating}
                            onMouseDown={async (e) => { e.preventDefault(); const item = await medicalConditionOthers.createItem(medicalConditionOthers.input.trim()); if (item) handleSelfConditionChange(item.id, true); }}
                          >
                            {medicalConditionOthers.creating ? 'Adding...' : `+ Add "${medicalConditionOthers.input.trim()}" as a new condition`}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                          disabled={medicalConditionOthers.creating}
                          onMouseDown={async (e) => { e.preventDefault(); const item = await medicalConditionOthers.createItem(medicalConditionOthers.input.trim()); if (item) handleSelfConditionChange(item.id, true); }}
                        >
                          {medicalConditionOthers.creating ? 'Adding...' : `+ Add "${medicalConditionOthers.input.trim()}" as a new condition`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                    <RadioButton label="Yes" name="hasAllergies" value="yes" checked={formData.hasAllergies === 'yes'} onChange={(e) => handleInputChange('hasAllergies', e.target.value)} />
                    <RadioButton label="No" name="hasAllergies" value="no" checked={formData.hasAllergies === 'no'} onChange={(e) => handleInputChange('hasAllergies', e.target.value)} />
                  </div>
                  {formData.hasAllergies === 'yes' && (
                    <div className="space-y-4">
                      {catalogs.allergens.length > 0 ? (
                        <div className="space-y-5">
                          {ALLERGEN_TYPE_ORDER.filter(type =>
                            catalogs.allergens.some(a => a.type === type)
                          ).map((type) => (
                            <div key={type}>
                              <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide mb-2">{type}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                                {catalogs.allergens
                                  .filter(a => a.type === type)
                                  .map((allergen) => {
                                    const isChecked = (formData.selectedAllergies || []).includes(allergen.id);
                                    return (
                                      <div key={allergen.id}>
                                        <Checkbox
                                          label={allergen.allergen}
                                          checked={isChecked}
                                          onChange={(e) => handleCheckboxChange('selectedAllergies', allergen.id, e.target.checked)}
                                        />
                                        {isChecked && (
                                          <div className="ml-6 mt-1 mb-1 flex gap-2">
                                            <select className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 bg-white dark:bg-neutral-800 dark:text-white" value={formData.allergyDetails?.[allergen.id]?.severity || 'Unknown'} onChange={(e) => { const details = { ...(formData.allergyDetails || {}) }; details[allergen.id] = { ...details[allergen.id], severity: e.target.value }; handleInputChange('allergyDetails', details); }}>
                                              <option value="Unknown">Severity: Unknown</option>
                                              <option value="Mild">Severity: Mild</option>
                                              <option value="Moderate">Severity: Moderate</option>
                                              <option value="Severe">Severity: Severe</option>
                                            </select>
                                            <select className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 bg-white dark:bg-neutral-800 dark:text-white" value={formData.allergyDetails?.[allergen.id]?.status || 'Active'} onChange={(e) => { const details = { ...(formData.allergyDetails || {}) }; details[allergen.id] = { ...details[allergen.id], status: e.target.value }; handleInputChange('allergyDetails', details); }}>
                                              <option value="Active">Status: Active</option>
                                              <option value="Resolved">Status: Resolved</option>
                                              <option value="Suspected">Status: Suspected</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                          {/* Dynamically added allergens from search */}
                          {allergenOthers.dynamicItems.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Added by you</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                                {allergenOthers.dynamicItems.map((allergen) => {
                                  const isChecked = (formData.selectedAllergies || []).includes(allergen.id);
                                  return (
                                    <div key={allergen.id}>
                                      <Checkbox
                                        label={`${allergen.allergen} (${allergen.type})`}
                                        checked={isChecked}
                                        onChange={(e) => handleCheckboxChange('selectedAllergies', allergen.id, e.target.checked)}
                                      />
                                      {isChecked && (
                                        <div className="ml-6 mt-1 mb-1 flex gap-2">
                                          <select className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 bg-white dark:bg-neutral-800 dark:text-white" value={formData.allergyDetails?.[allergen.id]?.severity || 'Unknown'} onChange={(e) => { const details = { ...(formData.allergyDetails || {}) }; details[allergen.id] = { ...details[allergen.id], severity: e.target.value }; handleInputChange('allergyDetails', details); }}>
                                            <option value="Unknown">Severity: Unknown</option>
                                            <option value="Mild">Severity: Mild</option>
                                            <option value="Moderate">Severity: Moderate</option>
                                            <option value="Severe">Severity: Severe</option>
                                          </select>
                                          <select className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 bg-white dark:bg-neutral-800 dark:text-white" value={formData.allergyDetails?.[allergen.id]?.status || 'Active'} onChange={(e) => { const details = { ...(formData.allergyDetails || {}) }; details[allergen.id] = { ...details[allergen.id], status: e.target.value }; handleInputChange('allergyDetails', details); }}>
                                            <option value="Active">Status: Active</option>
                                            <option value="Resolved">Status: Resolved</option>
                                            <option value="Suspected">Status: Suspected</option>
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Search or add allergens */}
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Allergens (search or add):</label>
                            <div ref={allergenOthers.wrapperRef}>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                                placeholder="Type to search for an allergen..."
                                value={allergenOthers.input}
                                autoComplete="off"
                                onFocus={() => allergenOthers.setFocused(true)}
                                onChange={(e) => allergenOthers.handleInputChange(e.target.value)}
                              />
                              {allergenOthers.focused && allergenOthers.input.trim() && (
                                <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                                  {allergenOthers.searching && (
                                    <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                                  )}
                                  {allergenOthers.suggestions.length > 0 ? (
                                    <>
                                      {allergenOthers.suggestions.map(result => (
                                        <button
                                          key={result.id}
                                          type="button"
                                          className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                                          onMouseDown={(e) => { e.preventDefault(); const item = allergenOthers.selectItem(result); handleCheckboxChange('selectedAllergies', item.id, true); }}
                                        >
                                          {result.allergen} <span className="text-xs text-secondary-400">({result.type})</span>
                                          {(formData.selectedAllergies || []).includes(result.id) && (
                                            <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                                          )}
                                        </button>
                                      ))}
                                      <div className="border-t border-neutral-200 dark:border-neutral-700 px-4 py-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <label className="text-xs text-secondary-500 dark:text-neutral-400">Type:</label>
                                          <select
                                            className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-1 py-0.5 bg-white dark:bg-neutral-800 dark:text-white"
                                            value={allergenTypeForCreate}
                                            onChange={(e) => setAllergenTypeForCreate(e.target.value)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            {ALLERGEN_TYPE_OPTIONS.map(opt => (
                                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <button
                                          type="button"
                                          className="w-full text-left text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none disabled:opacity-50"
                                          disabled={allergenOthers.creating}
                                          onMouseDown={async (e) => { e.preventDefault(); const item = await allergenOthers.createItem(allergenOthers.input.trim(), allergenTypeForCreate); if (item) handleCheckboxChange('selectedAllergies', item.id, true); }}
                                        >
                                          {allergenOthers.creating ? 'Adding...' : `+ Add "${allergenOthers.input.trim()}" as a new allergen`}
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="px-4 py-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <label className="text-xs text-secondary-500 dark:text-neutral-400">Type:</label>
                                        <select
                                          className="text-xs border border-neutral-300 dark:border-neutral-600 rounded px-1 py-0.5 bg-white dark:bg-neutral-800 dark:text-white"
                                          value={allergenTypeForCreate}
                                          onChange={(e) => setAllergenTypeForCreate(e.target.value)}
                                          onMouseDown={(e) => e.stopPropagation()}
                                        >
                                          {ALLERGEN_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <button
                                        type="button"
                                        className="w-full text-left text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none disabled:opacity-50"
                                        disabled={allergenOthers.creating}
                                        onMouseDown={async (e) => { e.preventDefault(); const item = await allergenOthers.createItem(allergenOthers.input.trim(), allergenTypeForCreate); if (item) handleCheckboxChange('selectedAllergies', item.id, true); }}
                                      >
                                        {allergenOthers.creating ? 'Adding...' : `+ Add "${allergenOthers.input.trim()}" as a new allergen`}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

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
          <div className="space-y-6">
            {/* Smoker Section */}
            <div className="border-l-4 border-warning-500 pl-4">
              <h4 className="font-semibold text-secondary-700 dark:text-neutral-200 mb-3">Smoker</h4>
              <div className="flex gap-4 mb-4">
                <RadioButton label="No" name="smoker" value="no" checked={formData.smoker === 'no'} onChange={(e) => handleInputChange('smoker', e.target.value)} />
                <RadioButton label="Yes" name="smoker" value="yes" checked={formData.smoker === 'yes'} onChange={(e) => handleInputChange('smoker', e.target.value)} />
              </div>
              {formData.smoker === 'yes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Sticks per day"
                    type="number"
                    placeholder="Number of sticks"
                    value={formData.smokerSticksPerDay || ''}
                    onChange={(e) => handleInputChange('smokerSticksPerDay', e.target.value)}
                  />
                  <Input
                    label="Number of years"
                    type="number"
                    placeholder="Years"
                    value={formData.smokerYears || ''}
                    onChange={(e) => handleInputChange('smokerYears', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Alcohol Section */}
            <div className="border-l-4 border-accent-500 pl-4">
              <h4 className="font-semibold text-secondary-700 dark:text-neutral-200 mb-3">Alcohol Drinker</h4>
              <div className="flex gap-4 mb-4">
                <RadioButton label="No" name="alcoholDrinker" value="no" checked={formData.alcoholDrinker === 'no'} onChange={(e) => handleInputChange('alcoholDrinker', e.target.value)} />
                <RadioButton label="Yes" name="alcoholDrinker" value="yes" checked={formData.alcoholDrinker === 'yes'} onChange={(e) => handleInputChange('alcoholDrinker', e.target.value)} />
              </div>
              {formData.alcoholDrinker === 'yes' && (
                <Select
                  label="Frequency"
                  options={LIFESTYLE_FREQUENCY_OPTIONS}
                  value={formData.alcoholFrequency || ''}
                  onChange={(e) => handleInputChange('alcoholFrequency', e.target.value)}
                />
              )}
            </div>

            {/* Vaper Section */}
            <div className="border-l-4 border-primary-500 pl-4">
              <h4 className="font-semibold text-secondary-700 dark:text-neutral-200 mb-3">Vaper</h4>
              <div className="flex gap-4 mb-4">
                <RadioButton label="No" name="vaper" value="no" checked={formData.vaper === 'no'} onChange={(e) => handleInputChange('vaper', e.target.value)} />
                <RadioButton label="Yes" name="vaper" value="yes" checked={formData.vaper === 'yes'} onChange={(e) => handleInputChange('vaper', e.target.value)} />
              </div>
              {formData.vaper === 'yes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Vape Type"
                    options={VAPE_TYPE_OPTIONS}
                    value={formData.vapeType || ''}
                    onChange={(e) => handleInputChange('vapeType', e.target.value)}
                  />
                  <Select
                    label="Frequency"
                    options={LIFESTYLE_FREQUENCY_OPTIONS}
                    value={formData.vapeFrequency || ''}
                    onChange={(e) => handleInputChange('vapeFrequency', e.target.value)}
                  />
                </div>
              )}
            </div>
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
              <p className="text-sm text-secondary-700 dark:text-neutral-400 mr-4">Do you wear glasses or contact lenses?</p>
              <RadioButton label="Yes" name="visualAcuity" value="yes" checked={formData.visualAcuity === 'yes'} onChange={(e) => handleInputChange('visualAcuity', e.target.value)} />
              <RadioButton label="No" name="visualAcuity" value="no" checked={formData.visualAcuity === 'no'} onChange={(e) => handleInputChange('visualAcuity', e.target.value)} />
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
                  <RadioButton label="Yes" name="dysmenorrhea" value="yes" checked={formData.dysmenorrhea === 'yes'} onChange={(e) => handleInputChange('dysmenorrhea', e.target.value)} />
                  <RadioButton label="No" name="dysmenorrhea" value="no" checked={formData.dysmenorrhea === 'no'} onChange={(e) => handleInputChange('dysmenorrhea', e.target.value)} />
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
            <div className="space-y-2">
              {immunizations.map((vaccine) => {
                const isChecked = (formData.immunizations || []).includes(vaccine.id);
                return (
                  <div key={vaccine.id}>
                    <Checkbox
                      label={vaccine.name}
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange('immunizations', vaccine.id, e.target.checked)}
                    />
                    {isChecked && (
                      <div className="ml-6 mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          label="Date Received"
                          type="date"
                          value={formData.immunizationDetails?.[vaccine.id]?.date || ''}
                          onChange={(e) => {
                            const details = { ...(formData.immunizationDetails || {}) };
                            details[vaccine.id] = { ...details[vaccine.id], date: e.target.value };
                            handleInputChange('immunizationDetails', details);
                          }}
                        />
                        <Input
                          label="Dose Number"
                          type="number"
                          min="1"
                          placeholder="1, 2, 3..."
                          value={formData.immunizationDetails?.[vaccine.id]?.doseNumber || ''}
                          onChange={(e) => {
                            const details = { ...(formData.immunizationDetails || {}) };
                            details[vaccine.id] = { ...details[vaccine.id], doseNumber: parseInt(e.target.value) || 1 };
                            handleInputChange('immunizationDetails', details);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Dynamically added vaccines from search */}
            {immunizationOthers.dynamicItems.length > 0 && (
              <div className="space-y-2 mt-3">
                {immunizationOthers.dynamicItems.map((vaccine) => {
                  const isChecked = (formData.immunizations || []).includes(vaccine.id);
                  return (
                    <div key={vaccine.id}>
                      <Checkbox
                        label={vaccine.name}
                        checked={isChecked}
                        onChange={(e) => handleCheckboxChange('immunizations', vaccine.id, e.target.checked)}
                      />
                      {isChecked && (
                        <div className="ml-6 mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input
                            label="Date Received"
                            type="date"
                            value={formData.immunizationDetails?.[vaccine.id]?.date || ''}
                            onChange={(e) => {
                              const details = { ...(formData.immunizationDetails || {}) };
                              details[vaccine.id] = { ...details[vaccine.id], date: e.target.value };
                              handleInputChange('immunizationDetails', details);
                            }}
                          />
                          <Input
                            label="Dose Number"
                            type="number"
                            min="1"
                            placeholder="1, 2, 3..."
                            value={formData.immunizationDetails?.[vaccine.id]?.doseNumber || ''}
                            onChange={(e) => {
                              const details = { ...(formData.immunizationDetails || {}) };
                              details[vaccine.id] = { ...details[vaccine.id], doseNumber: parseInt(e.target.value) || 1 };
                              handleInputChange('immunizationDetails', details);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Search or add vaccines */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Vaccines (search or add):</label>
              <div ref={immunizationOthers.wrapperRef}>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Type to search for a vaccine..."
                  value={immunizationOthers.input}
                  autoComplete="off"
                  onFocus={() => immunizationOthers.setFocused(true)}
                  onChange={(e) => immunizationOthers.handleInputChange(e.target.value)}
                />
                {immunizationOthers.focused && immunizationOthers.input.trim() && (
                  <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                    {immunizationOthers.searching && (
                      <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                    )}
                    {immunizationOthers.suggestions.length > 0 ? (
                      <>
                        {immunizationOthers.suggestions.map(result => (
                          <button
                            key={result.id}
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                            onMouseDown={(e) => { e.preventDefault(); const item = immunizationOthers.selectItem(result); handleCheckboxChange('immunizations', item.id, true); }}
                          >
                            {result.name}
                            {(formData.immunizations || []).includes(result.id) && (
                              <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                          disabled={immunizationOthers.creating}
                          onMouseDown={async (e) => { e.preventDefault(); const item = await immunizationOthers.createItem(immunizationOthers.input.trim()); if (item) handleCheckboxChange('immunizations', item.id, true); }}
                        >
                          {immunizationOthers.creating ? 'Adding...' : `+ Add "${immunizationOthers.input.trim()}" as a new vaccine`}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                        disabled={immunizationOthers.creating}
                        onMouseDown={async (e) => { e.preventDefault(); const item = await immunizationOthers.createItem(immunizationOthers.input.trim()); if (item) handleCheckboxChange('immunizations', item.id, true); }}
                      >
                        {immunizationOthers.creating ? 'Adding...' : `+ Add "${immunizationOthers.input.trim()}" as a new vaccine`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
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
              <p className="text-sm text-secondary-700 dark:text-neutral-400 mr-4">Have you been hospitalized in the past?</p>
              <RadioButton label="Yes" name="hasHospitalizations" value="yes" checked={formData.hasHospitalizations === 'yes'} onChange={(e) => handleInputChange('hasHospitalizations', e.target.value)} />
              <RadioButton label="No" name="hasHospitalizations" value="no" checked={formData.hasHospitalizations === 'no'} onChange={(e) => handleInputChange('hasHospitalizations', e.target.value)} />
            </div>
            {formData.hasHospitalizations === 'yes' && (
              <div className="space-y-4">
                {catalogs.isLoading ? (
                  <p className="text-sm text-secondary-500 italic">Loading...</p>
                ) : catalogs.hospitalizations.length > 0 ? (
                  <div className="space-y-2">
                    {catalogs.hospitalizations.map((condition) => {
                      const isChecked = formData.hospitalizationConditions?.[condition.id] || false;
                      return (
                        <div key={condition.id}>
                          <Checkbox
                            label={condition.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('hospitalizationConditions', { ...(formData.hospitalizationConditions || {}), [condition.id]: e.target.checked })}
                          />
                          {isChecked && (
                            <div className="ml-6 mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                label="Admission Date"
                                type="date"
                                value={formData.hospitalizationDates?.[condition.id]?.admissionDate || ''}
                                onChange={(e) => handleInputChange('hospitalizationDates', { ...(formData.hospitalizationDates || {}), [condition.id]: { ...(formData.hospitalizationDates?.[condition.id] || {}), admissionDate: e.target.value } })}
                              />
                              <Input
                                label="Discharge Date"
                                type="date"
                                value={formData.hospitalizationDates?.[condition.id]?.dischargeDate || ''}
                                onChange={(e) => handleInputChange('hospitalizationDates', { ...(formData.hospitalizationDates || {}), [condition.id]: { ...(formData.hospitalizationDates?.[condition.id] || {}), dischargeDate: e.target.value } })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {hospitalizationOthers.dynamicItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Added by you</p>
                    {hospitalizationOthers.dynamicItems.map((condition) => {
                      const isChecked = formData.hospitalizationConditions?.[condition.id] || false;
                      return (
                        <div key={condition.id}>
                          <Checkbox
                            label={condition.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('hospitalizationConditions', { ...(formData.hospitalizationConditions || {}), [condition.id]: e.target.checked })}
                          />
                          {isChecked && (
                            <div className="ml-6 mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                label="Admission Date"
                                type="date"
                                value={formData.hospitalizationDates?.[condition.id]?.admissionDate || ''}
                                onChange={(e) => handleInputChange('hospitalizationDates', { ...(formData.hospitalizationDates || {}), [condition.id]: { ...(formData.hospitalizationDates?.[condition.id] || {}), admissionDate: e.target.value } })}
                              />
                              <Input
                                label="Discharge Date"
                                type="date"
                                value={formData.hospitalizationDates?.[condition.id]?.dischargeDate || ''}
                                onChange={(e) => handleInputChange('hospitalizationDates', { ...(formData.hospitalizationDates || {}), [condition.id]: { ...(formData.hospitalizationDates?.[condition.id] || {}), dischargeDate: e.target.value } })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Search or add hospitalization conditions */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Conditions (search or add):</label>
                  <div ref={hospitalizationOthers.wrapperRef}>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Type to search for a condition..."
                      value={hospitalizationOthers.input}
                      autoComplete="off"
                      onFocus={() => hospitalizationOthers.setFocused(true)}
                      onChange={(e) => hospitalizationOthers.handleInputChange(e.target.value)}
                    />
                    {hospitalizationOthers.focused && hospitalizationOthers.input.trim() && (
                      <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                        {hospitalizationOthers.searching && (
                          <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                        )}
                        {hospitalizationOthers.suggestions.length > 0 ? (
                          <>
                            {hospitalizationOthers.suggestions.map(result => (
                              <button
                                key={result.id}
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                                onMouseDown={(e) => { e.preventDefault(); const item = hospitalizationOthers.selectItem(result); handleInputChange('hospitalizationConditions', { ...(formData.hospitalizationConditions || {}), [item.id]: true }); }}
                              >
                                {result.name}
                                {formData.hospitalizationConditions?.[result.id] && (
                                  <span className="ml-2 text-xs text-primary-500 font-medium">✓ Selected</span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                              disabled={hospitalizationOthers.creating}
                              onMouseDown={async (e) => { e.preventDefault(); const item = await hospitalizationOthers.createItem(hospitalizationOthers.input.trim()); if (item) handleInputChange('hospitalizationConditions', { ...(formData.hospitalizationConditions || {}), [item.id]: true }); }}
                            >
                              {hospitalizationOthers.creating ? 'Adding...' : `+ Add "${hospitalizationOthers.input.trim()}" as a new condition`}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                            disabled={hospitalizationOthers.creating}
                            onMouseDown={async (e) => { e.preventDefault(); const item = await hospitalizationOthers.createItem(hospitalizationOthers.input.trim()); if (item) handleInputChange('hospitalizationConditions', { ...(formData.hospitalizationConditions || {}), [item.id]: true }); }}
                          >
                            {hospitalizationOthers.creating ? 'Adding...' : `+ Add "${hospitalizationOthers.input.trim()}" as a new condition`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
              <p className="text-sm text-secondary-700 dark:text-neutral-400 mr-4">Have you had any surgeries?</p>
              <RadioButton label="Yes" name="hasSurgeries" value="yes" checked={formData.hasSurgeries === 'yes'} onChange={(e) => handleInputChange('hasSurgeries', e.target.value)} />
              <RadioButton label="No" name="hasSurgeries" value="no" checked={formData.hasSurgeries === 'no'} onChange={(e) => handleInputChange('hasSurgeries', e.target.value)} />
            </div>
            {formData.hasSurgeries === 'yes' && (
              <div className="space-y-4">
                {catalogs.isLoading ? (
                  <p className="text-sm text-secondary-500 italic">Loading...</p>
                ) : catalogs.operations.length > 0 ? (
                  <div className="space-y-2">
                    {catalogs.operations.map((procedure) => {
                      const isChecked = formData.operationConditions?.[procedure.id] || false;
                      return (
                        <div key={procedure.id}>
                          <Checkbox
                            label={procedure.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('operationConditions', { ...(formData.operationConditions || {}), [procedure.id]: e.target.checked })}
                          />
                          {isChecked && (
                            <div className="ml-6 mt-1">
                              <Input
                                label="Date of Operation"
                                type="date"
                                value={formData.operationDates?.[procedure.id] || ''}
                                onChange={(e) => handleInputChange('operationDates', { ...(formData.operationDates || {}), [procedure.id]: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {operationOthers.dynamicItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Added by you</p>
                    {operationOthers.dynamicItems.map((procedure) => {
                      const isChecked = formData.operationConditions?.[procedure.id] || false;
                      return (
                        <div key={procedure.id}>
                          <Checkbox
                            label={procedure.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('operationConditions', { ...(formData.operationConditions || {}), [procedure.id]: e.target.checked })}
                          />
                          {isChecked && (
                            <div className="ml-6 mt-1">
                              <Input
                                label="Date of Operation"
                                type="date"
                                value={formData.operationDates?.[procedure.id] || ''}
                                onChange={(e) => handleInputChange('operationDates', { ...(formData.operationDates || {}), [procedure.id]: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Search or add operations */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Operations (search or add):</label>
                  <div ref={operationOthers.wrapperRef}>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Type to search for a procedure..."
                      value={operationOthers.input}
                      autoComplete="off"
                      onFocus={() => operationOthers.setFocused(true)}
                      onChange={(e) => operationOthers.handleInputChange(e.target.value)}
                    />
                    {operationOthers.focused && operationOthers.input.trim() && (
                      <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                        {operationOthers.searching && (
                          <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                        )}
                        {operationOthers.suggestions.length > 0 ? (
                          <>
                            {operationOthers.suggestions.map(result => (
                              <button
                                key={result.id}
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                                onMouseDown={(e) => { e.preventDefault(); const item = operationOthers.selectItem(result); handleInputChange('operationConditions', { ...(formData.operationConditions || {}), [item.id]: true }); }}
                              >
                                {result.name}
                                {formData.operationConditions?.[result.id] && (
                                  <span className="ml-2 text-xs text-primary-500 font-medium">✓ Selected</span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                              disabled={operationOthers.creating}
                              onMouseDown={async (e) => { e.preventDefault(); const item = await operationOthers.createItem(operationOthers.input.trim()); if (item) handleInputChange('operationConditions', { ...(formData.operationConditions || {}), [item.id]: true }); }}
                            >
                              {operationOthers.creating ? 'Adding...' : `+ Add "${operationOthers.input.trim()}" as a new procedure`}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                            disabled={operationOthers.creating}
                            onMouseDown={async (e) => { e.preventDefault(); const item = await operationOthers.createItem(operationOthers.input.trim()); if (item) handleInputChange('operationConditions', { ...(formData.operationConditions || {}), [item.id]: true }); }}
                          >
                            {operationOthers.creating ? 'Adding...' : `+ Add "${operationOthers.input.trim()}" as a new procedure`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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
              <p className="text-sm text-secondary-700 dark:text-neutral-400 mr-4">Are you currently taking any medications?</p>
              <RadioButton label="Yes" name="hasMedications" value="yes" checked={formData.hasMedications === 'yes'} onChange={() => onChange({ ...formData, hasMedications: 'yes', selectedMedications: formData.selectedMedications || {} })} />
              <RadioButton label="No" name="hasMedications" value="no" checked={formData.hasMedications === 'no'} onChange={() => onChange({ ...formData, hasMedications: 'no', selectedMedications: {} })} />
            </div>
            {formData.hasMedications === 'yes' && (
              <div className="space-y-4">
                {catalogs.medications.length > 0 ? (
                  <div className="space-y-2">
                    {catalogs.medications.map((medicine) => {
                      const isChecked = formData.selectedMedications?.[medicine.id] || false;
                      return (
                        <div key={medicine.id}>
                          <Checkbox
                            label={medicine.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('selectedMedications', { ...(formData.selectedMedications || {}), [medicine.id]: e.target.checked })}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {medicationOthers.dynamicItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Added by you</p>
                    {medicationOthers.dynamicItems.map((medicine) => {
                      const isChecked = formData.selectedMedications?.[medicine.id] || false;
                      return (
                        <div key={medicine.id}>
                          <Checkbox
                            label={medicine.name}
                            checked={isChecked}
                            onChange={(e) => handleInputChange('selectedMedications', { ...(formData.selectedMedications || {}), [medicine.id]: e.target.checked })}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Search or add medications */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Medications (search or add):</label>
                  <div ref={medicationOthers.wrapperRef}>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Type to search for a medication..."
                      value={medicationOthers.input}
                      autoComplete="off"
                      onFocus={() => medicationOthers.setFocused(true)}
                      onChange={(e) => medicationOthers.handleInputChange(e.target.value)}
                    />
                    {medicationOthers.focused && medicationOthers.input.trim() && (
                      <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                        {medicationOthers.searching && (
                          <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                        )}
                        {medicationOthers.suggestions.length > 0 ? (
                          <>
                            {medicationOthers.suggestions.map(result => (
                              <button
                                key={result.id}
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                                onMouseDown={(e) => { e.preventDefault(); const item = medicationOthers.selectItem(result); handleInputChange('selectedMedications', { ...(formData.selectedMedications || {}), [item.id]: true }); }}
                              >
                                {result.name}
                                {formData.selectedMedications?.[result.id] && (
                                  <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                              disabled={medicationOthers.creating}
                              onMouseDown={async (e) => { e.preventDefault(); const item = await medicationOthers.createItem(medicationOthers.input.trim()); if (item) handleInputChange('selectedMedications', { ...(formData.selectedMedications || {}), [item.id]: true }); }}
                            >
                              {medicationOthers.creating ? 'Adding...' : `+ Add "${medicationOthers.input.trim()}" as a new medication`}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                            disabled={medicationOthers.creating}
                            onMouseDown={async (e) => { e.preventDefault(); const item = await medicationOthers.createItem(medicationOthers.input.trim()); if (item) handleInputChange('selectedMedications', { ...(formData.selectedMedications || {}), [item.id]: true }); }}
                          >
                            {medicationOthers.creating ? 'Adding...' : `+ Add "${medicationOthers.input.trim()}" as a new medication`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
              {/* Dynamically added family medical conditions from search */}
              {medicalConditionOthers.dynamicItems.map((condition) => (
                <div
                  key={condition.id}
                  className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  <Checkbox
                    label={condition.name}
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
            {/* Search or add family medical conditions */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1">Other Conditions (search or add):</label>
              <div ref={medicalConditionOthers.wrapperRef}>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Type to search for a condition..."
                  value={medicalConditionOthers.input}
                  autoComplete="off"
                  onFocus={() => medicalConditionOthers.setFocused(true)}
                  onChange={(e) => medicalConditionOthers.handleInputChange(e.target.value)}
                />
                {medicalConditionOthers.focused && medicalConditionOthers.input.trim() && (
                  <div className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-sm max-h-60 overflow-y-auto">
                    {medicalConditionOthers.searching && (
                      <div className="px-4 py-2 text-xs text-secondary-400 dark:text-neutral-500 italic">Searching...</div>
                    )}
                    {medicalConditionOthers.suggestions.length > 0 ? (
                      <>
                        {medicalConditionOthers.suggestions.map(result => (
                          <button
                            key={result.id}
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-secondary-800 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                            onMouseDown={(e) => { e.preventDefault(); const item = medicalConditionOthers.selectItem(result); handleFamilyConditionChange(item.id, true); }}
                          >
                            {result.name}
                            {formData.familyConditions?.[result.id]?.checked && (
                              <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-b-lg border-t border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
                          disabled={medicalConditionOthers.creating}
                          onMouseDown={async (e) => { e.preventDefault(); const item = await medicalConditionOthers.createItem(medicalConditionOthers.input.trim()); if (item) handleFamilyConditionChange(item.id, true); }}
                        >
                          {medicalConditionOthers.creating ? 'Adding...' : `+ Add "${medicalConditionOthers.input.trim()}" as a new condition`}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 focus:outline-none rounded-lg disabled:opacity-50"
                        disabled={medicalConditionOthers.creating}
                        onMouseDown={async (e) => { e.preventDefault(); const item = await medicalConditionOthers.createItem(medicalConditionOthers.input.trim()); if (item) handleFamilyConditionChange(item.id, true); }}
                      >
                        {medicalConditionOthers.creating ? 'Adding...' : `+ Add "${medicalConditionOthers.input.trim()}" as a new condition`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalHistoryStep;
