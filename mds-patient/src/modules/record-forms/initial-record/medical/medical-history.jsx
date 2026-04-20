import React, { useState, useRef, useEffect } from 'react';
import { Checkbox, Input } from './form-elements';
import { searchDomainCatalog, createDomainCatalog } from '@core/services/emr-service';

function useCatalogSearch({ catalog = [], searchFn, createFn, nameKey = 'name' }) {
  const [dynamicItems, setDynamicItems] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = (value) => {
    setInput(value);
    if (!value.trim()) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchFn(value.trim());
        const allKnown = [...catalog, ...dynamicItems];
        setSuggestions((results || []).filter(r => !allKnown.find(k => k.id === r.id)));
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 300);
  };

  const selectItem = (item) => {
    setDynamicItems(prev => prev.find(i => i.id === item.id) ? prev : [...prev, item]);
    setInput('');
    setSuggestions([]);
    setFocused(false);
    return item;
  };

  const createItem = async (name, extra) => {
    if (!name) return null;
    setCreating(true);
    try {
      const item = await createFn(name, extra);
      if (item) {
        setDynamicItems(prev => prev.find(i => i.id === item.id) ? prev : [...prev, item]);
        setInput('');
        setSuggestions([]);
        setFocused(false);
      }
      return item;
    } catch { return null; }
    finally { setCreating(false); }
  };

  return { dynamicItems, input, suggestions, creating, searching, focused, wrapperRef, setFocused, handleInputChange, selectItem, createItem };
}

/**
 * MedicalHistoryForm
 *
 * Renders self and family medical history checkboxes from the backend
 * MedicalCondition domain catalog (fetched via fetchAllCatalogs in the parent).
 *
 * Form data shape (medicalHistory):
 *  {
 *    self:               { [conditionCatalogId]: boolean }
 *    family:             { [conditionCatalogId]: boolean }
 *    familyWhoHasIt:     { [conditionCatalogId]: string }  -- "Mother", "Father", etc.
 *    selfOtherChecked:   boolean
 *    selfOther:          string
 *    familyOtherChecked: boolean
 *    familyOther:        string
 *    familyOtherWhoHasIt: string
 *  }
 */
const MedicalHistoryForm = ({
  data,
  onChange,
  medicalConditionCatalog = [],
  catalogsLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState('self');

  const conditionOthers = useCatalogSearch({
    catalog: medicalConditionCatalog,
    searchFn: (q) => searchDomainCatalog('MedicalCondition', q),
    createFn: (name) => createDomainCatalog('MedicalCondition', name),
  });

  const handleSelfConditionChange = (id, checked) => {
    const self = { ...data.self, [id]: checked };
    onChange({ ...data, self });
  };

  const handleFamilyConditionChange = (id, checked) => {
    const family = { ...data.family, [id]: checked };
    if (!checked) {
      const familyWhoHasIt = { ...data.familyWhoHasIt };
      delete familyWhoHasIt[id];
      onChange({ ...data, family, familyWhoHasIt });
    } else {
      onChange({ ...data, family });
    }
  };

  const handleFamilyWhoHasItChange = (id, value) => {
    const familyWhoHasIt = { ...data.familyWhoHasIt, [id]: value };
    onChange({ ...data, familyWhoHasIt });
  };

  const CatalogLoader = () => (
    <div className="flex items-center gap-2 text-sm text-secondary-500 py-4">
      <svg className="animate-spin w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading conditions...
    </div>
  );

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
          type="button"
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
          type="button"
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

          {catalogsLoading ? (
            <CatalogLoader />
          ) : medicalConditionCatalog.length === 0 ? (
            <p className="text-sm text-secondary-400 italic">No conditions available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {medicalConditionCatalog.map((condition) => (
                <div
                  key={condition.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors"
                >
                  <Checkbox
                    label={condition.name}
                    checked={data.self?.[condition.id] || false}
                    onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Dynamically added conditions from search */}
          {conditionOthers.dynamicItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {conditionOthers.dynamicItems.map((condition) => (
                <div
                  key={condition.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors"
                >
                  <Checkbox
                    label={condition.name}
                    checked={data.self?.[condition.id] || false}
                    onChange={(e) => handleSelfConditionChange(condition.id, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          )}
          {/* Search or add conditions */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary-700 mb-1">Other Conditions (search or add):</label>
            <div ref={conditionOthers.wrapperRef}>
              <input
                type="text"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="Type to search for a condition..."
                value={conditionOthers.input}
                autoComplete="off"
                onFocus={() => conditionOthers.setFocused(true)}
                onChange={(e) => conditionOthers.handleInputChange(e.target.value)}
              />
              {conditionOthers.focused && conditionOthers.input.trim() && (
                <div className="mt-1 border border-neutral-200 rounded-lg bg-white shadow-sm max-h-60 overflow-y-auto">
                  {conditionOthers.searching && (
                    <div className="px-4 py-2 text-xs text-secondary-400 italic">Searching...</div>
                  )}
                  {conditionOthers.suggestions.length > 0 ? (
                    <>
                      {conditionOthers.suggestions.map(result => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-secondary-800 hover:bg-primary-50 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); const item = conditionOthers.selectItem(result); handleSelfConditionChange(item.id, true); }}
                        >
                          {result.name}
                          {data.self?.[result.id] && (
                            <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 focus:outline-none rounded-b-lg border-t border-neutral-200 disabled:opacity-50"
                        disabled={conditionOthers.creating}
                        onMouseDown={async (e) => { e.preventDefault(); const item = await conditionOthers.createItem(conditionOthers.input.trim()); if (item) handleSelfConditionChange(item.id, true); }}
                      >
                        {conditionOthers.creating ? 'Adding...' : `+ Add "${conditionOthers.input.trim()}" as a new condition`}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 focus:outline-none rounded-lg disabled:opacity-50"
                      disabled={conditionOthers.creating}
                      onMouseDown={async (e) => { e.preventDefault(); const item = await conditionOthers.createItem(conditionOthers.input.trim()); if (item) handleSelfConditionChange(item.id, true); }}
                    >
                      {conditionOthers.creating ? 'Adding...' : `+ Add "${conditionOthers.input.trim()}" as a new condition`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Family Medical History */}
      {activeTab === 'family' && (
        <div>
          <p className="text-sm text-secondary-600 mb-4">
            Check any conditions that apply to your immediate family members and specify who has it:
          </p>

          {catalogsLoading ? (
            <CatalogLoader />
          ) : medicalConditionCatalog.length === 0 ? (
            <p className="text-sm text-secondary-400 italic">No conditions available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {medicalConditionCatalog.map((condition) => (
                <div
                  key={condition.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors"
                >
                  <Checkbox
                    label={condition.name}
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
          )}

          {/* Dynamically added conditions from search */}
          {conditionOthers.dynamicItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {conditionOthers.dynamicItems.map((condition) => (
                <div
                  key={condition.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-primary-400 transition-colors"
                >
                  <Checkbox
                    label={condition.name}
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
          )}
          {/* Search or add conditions */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary-700 mb-1">Other Conditions (search or add):</label>
            <div ref={conditionOthers.wrapperRef}>
              <input
                type="text"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="Type to search for a condition..."
                value={conditionOthers.input}
                autoComplete="off"
                onFocus={() => conditionOthers.setFocused(true)}
                onChange={(e) => conditionOthers.handleInputChange(e.target.value)}
              />
              {conditionOthers.focused && conditionOthers.input.trim() && (
                <div className="mt-1 border border-neutral-200 rounded-lg bg-white shadow-sm max-h-60 overflow-y-auto">
                  {conditionOthers.searching && (
                    <div className="px-4 py-2 text-xs text-secondary-400 italic">Searching...</div>
                  )}
                  {conditionOthers.suggestions.length > 0 ? (
                    <>
                      {conditionOthers.suggestions.map(result => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-secondary-800 hover:bg-primary-50 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); const item = conditionOthers.selectItem(result); handleFamilyConditionChange(item.id, true); }}
                        >
                          {result.name}
                          {data.family?.[result.id] && (
                            <span className="ml-2 text-xs text-primary-500 font-medium">✓ Already selected</span>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 focus:outline-none rounded-b-lg border-t border-neutral-200 disabled:opacity-50"
                        disabled={conditionOthers.creating}
                        onMouseDown={async (e) => { e.preventDefault(); const item = await conditionOthers.createItem(conditionOthers.input.trim()); if (item) handleFamilyConditionChange(item.id, true); }}
                      >
                        {conditionOthers.creating ? 'Adding...' : `+ Add "${conditionOthers.input.trim()}" as a new condition`}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 focus:outline-none rounded-lg disabled:opacity-50"
                      disabled={conditionOthers.creating}
                      onMouseDown={async (e) => { e.preventDefault(); const item = await conditionOthers.createItem(conditionOthers.input.trim()); if (item) handleFamilyConditionChange(item.id, true); }}
                    >
                      {conditionOthers.creating ? 'Adding...' : `+ Add "${conditionOthers.input.trim()}" as a new condition`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default MedicalHistoryForm;
