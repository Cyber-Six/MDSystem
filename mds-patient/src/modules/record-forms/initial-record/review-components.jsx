import React from 'react';

export const ReviewSectionHeader = ({ title, onEditClick }) => (
  <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-primary-400">
    <h4 className="text-lg font-heading font-semibold text-secondary-900">{title}</h4>
    <button type="button" onClick={onEditClick} className="text-sm text-primary-700 hover:text-primary-800 font-semibold flex items-center transition-colors">
      <span aria-hidden="true" className="mr-1">✎</span>Edit
    </button>
  </div>
);

export const ReviewDataRow = ({ label, value, className = '' }) => {
  const hasValue = value !== undefined && value !== null && value !== '' && value !== 'undefined';
  const normalized = typeof value === 'string' ? value.toLowerCase() : value;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : normalized === 'yes' ? 'Yes' : normalized === 'no' ? 'No' : value;
  return (
    <div className={`grid grid-cols-3 gap-3 py-2 border-b border-neutral-100 ${className}`}>
      <dt className="font-medium text-secondary-600">{label}</dt>
      <dd className="col-span-2 text-secondary-900 whitespace-pre-wrap break-words">{hasValue ? displayValue : <span className="text-secondary-400">Not provided</span>}</dd>
    </div>
  );
};

export const resolveCatalogLabel = (catalog, id, registry = {}) => {
  if (id === undefined || id === null || String(id) === 'undefined') return null;
  const item = (catalog || []).find((entry) => String(entry.id) === String(id));
  const registered = registry?.[String(id)];
  return item?.name || item?.allergen || item?.allergy || registered?.name || (typeof registered === 'string' ? registered : null);
};

export const isResolvableCatalogSelection = (catalog, id, registry = {}) =>
  /^[1-9]\d*$/.test(String(id ?? '')) && Boolean(resolveCatalogLabel(catalog, id, registry));

export const selectedCatalogEntries = (selection = {}, catalog, registry = {}) =>
  Object.entries(selection || {}).filter(([id, selected]) => Boolean(selected) && isResolvableCatalogSelection(catalog, id, registry));

export const collectUnresolvedCatalogSelections = (formData = {}, catalogs = {}) => {
  const selected = (selection, catalogKey, active = (value) => Boolean(value)) =>
    Object.entries(selection || {}).filter(([, value]) => active(value)).map(([id]) => [catalogKey, id]);
  const candidates = [
    ...selected(formData.medicalHistory?.self, 'medicalConditionCatalog'),
    ...selected(formData.medicalHistory?.family, 'medicalConditionCatalog'),
    ...selected(formData.medicalBackground?.immunizations, 'immunizationCatalog'),
    ...selected(formData.medicalBackground?.allergies, 'allergenCatalog', (value) => typeof value === 'object' ? Boolean(value?.checked) : Boolean(value)),
    ...selected(formData.medicalBackground?.hospitalizationConditions, 'hospitalizationCatalog'),
    ...selected(formData.medicalBackground?.operationConditions, 'operationCatalog'),
    ...selected(formData.medicalBackground?.selectedMedications, 'medicationCatalog'),
    ...selected(formData.dentalHistory?.intraOralAppliances, 'oralApplianceCatalog', (value) => typeof value === 'object' ? Boolean(value?.checked) : Boolean(value)),
    ...selected(formData.dentalHistory?.selectedDentalProcedures, 'dentalProcedureCatalog'),
  ];
  return candidates.filter(([key, id]) => !isResolvableCatalogSelection(catalogs[key], id, catalogs.registry));
};

export const formatReviewDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

export const formatReviewAnswer = (value) => {
  if (value === true || String(value).toLowerCase() === 'yes') return 'Yes';
  if (value === false || String(value).toLowerCase() === 'no') return 'No';
  if (value === 0) return '0';
  return value;
};
