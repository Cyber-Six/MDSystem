export function unresolvedReviewChoices(record, catalogs) {
  const sources = [
    ['medicalHistory', 'conditions', 'conditionId', 'medicalConditionCatalog'],
    ['allergyProfile', 'allergies', 'allergenCatalogId', 'allergenCatalog'],
    ['immunizationProfile', 'immunizations', 'vaccineTypeId', 'immunizationCatalog'],
    ['hospitalizationProfile', 'hospitalizations', 'conditionId', 'hospitalizationCatalog'],
    ['operationProfile', 'operations', 'procedureId', 'operationCatalog'],
    ['medicationProfile', 'medications', 'medicineId', 'medicationCatalog'],
    ['dentalProcedureProfile', 'procedures', 'procedureTypeId', 'dentalProcedureCatalog'],
    ['oralApplianceProfile', 'appliances', 'tagId', 'oralApplianceCatalog'],
  ];
  return sources.flatMap(([section, list, key, catalog]) => (record?.[section]?.[list] || [])
    .filter(row => !/^[1-9]\d*$/.test(String(row[key])) || !(catalogs[catalog] || []).some(item => String(item.id) === String(row[key]) && (item.name || item.allergen)))
    .map(() => section));
}
