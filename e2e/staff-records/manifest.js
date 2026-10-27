'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const registry = require('../custom-choices/account-registry');
const directory = path.resolve(__dirname, '../../.e2e-private/record-manifests');
const inputSections = {
  studentInput: 'profile', employeeInput: 'profile', empInput: 'profile', emergencyInput: 'emergencyContact',
  medHistInput: 'medicalHistory', allergyInput: 'allergyProfile', hospInput: 'hospitalizationProfile',
  opInput: 'operationProfile', medInput: 'medicationProfile', immuInput: 'immunizationProfile',
  lifeInput: 'lifestyle', vaInput: 'visualAcuityProfile', dentalHistInput: 'dentalHistory',
  dentalProcInput: 'dentalProcedureProfile', oralAppInput: 'oralApplianceProfile',
  dentalPhotoInput: 'dentalPhotoRecord', obgynInput: 'obgynHistory', obgyneInput: 'obgynHistory',
};
const operations = {
  StudentProfile: 'profile', EmployeeProfile: 'profile', EmergencyContact: 'emergencyContact',
  MedicalHistory: 'medicalHistory', AllergyProfile: 'allergyProfile', HospitalizationProfile: 'hospitalizationProfile',
  OperationProfile: 'operationProfile', MedicationProfile: 'medicationProfile', ImmunizationProfile: 'immunizationProfile',
  Lifestyle: 'lifestyle', VisualAcuityProfile: 'visualAcuityProfile', DentalHistory: 'dentalHistory',
  DentalProcedureProfile: 'dentalProcedureProfile', OralApplianceProfile: 'oralApplianceProfile',
  DentalPhotoRecord: 'dentalPhotoRecord', ObgynHistory: 'obgynHistory',
};
const required = ['profile', 'emergencyContact', 'medicalHistory', 'allergyProfile', 'hospitalizationProfile',
  'operationProfile', 'medicationProfile', 'immunizationProfile', 'lifestyle', 'visualAcuityProfile',
  'dentalHistory', 'dentalProcedureProfile', 'oralApplianceProfile', 'dentalPhotoRecord'];

function submittedRecord(network) {
  const record = {};
  const labels = {};
  const domains = { MedicalCondition: 'medicalHistory', Hospitalization: 'hospitalizationProfile', Operation: 'operationProfile', Medication: 'medicationProfile', Immunization: 'immunizationProfile', DentalProcedure: 'dentalProcedureProfile', OralAppliance: 'oralApplianceProfile' };
  const aliases = { medicalConditionCatalog: 'medicalHistory', hospitalizationCatalog: 'hospitalizationProfile', operationCatalog: 'operationProfile', medicationCatalog: 'medicationProfile', immunizationCatalog: 'immunizationProfile', allergenCatalog: 'allergyProfile', oralApplianceCatalog: 'oralApplianceProfile', dentalProcedureCatalog: 'dentalProcedureProfile' };
  const walk = (value, domain) => {
    if (!value || typeof value !== 'object') return;
    if (value.id != null && (value.name || value.allergen || value.label)) {
      labels[`${value.allergen ? 'allergen:' : ''}${value.id}`] = value.allergen || value.name || value.label;
      if (domain) labels[`${domain}:${value.id}`] = value.allergen || value.name || value.label;
    }
    Object.entries(value).forEach(([key, child]) => walk(child, aliases[key] || domain));
  };
  for (const event of network || []) {
    const domain = domains[event.request?.variables?.domain || event.request?.query?.match(/domain:\s*(\w+)/)?.[1]];
    walk(event.response?.data, domain);
    const query = event.request?.query || '';
    if (!/\bmutation\b/.test(query) || event.response?.errors?.length || event.response?.blockedCancellation || event.response?.abortedForInvalidInputProbe) continue;
    const variables = event.request.variables || {};
    if (/\b(?:createInitialPersonalRecord|createPersonalRecordLog|updatePatientPersonalRecordLog)\b/.test(query) && variables.input) record.personalInfo = structuredClone(variables.input);
    for (const [key, section] of Object.entries(inputSections)) if (variables[key]) record[section] = structuredClone(variables[key]);
    for (const [operation, section] of Object.entries(operations)) {
      if (new RegExp(`\\b(?:create|update)${operation}\\b`).test(query) && variables.input) record[section] = structuredClone(variables.input);
    }
  }
  return { record, labels };
}

function incompleteReason(manifest, needsRevisionControls = false) {
  if (!manifest || manifest.version !== 1 || !manifest.verified) return 'missing verified original input manifest';
  if (!manifest.patientId || !manifest.ticketId || !manifest.url || !manifest.role) return 'manifest identity is incomplete';
  const missing = required.filter(key => !manifest.record?.[key]);
  if (!manifest.record?.personalInfo) missing.push('personalInfo');
  if (manifest.record?.personalInfo?.sex === 'Female' && !manifest.record.obgynHistory) missing.push('obgynHistory');
  if (missing.length) return `input manifest is missing sections: ${missing.join(', ')}`;
  if (needsRevisionControls && (!manifest.controls?.length || manifest.controls.some(section => !section.fields?.length) || !manifest.review?.length)) return 'missing original form controls or final-review evidence for revision';
  return null;
}

function save(state, account, fileDirectory = directory) {
  const { record, labels } = submittedRecord(state.network);
  // Update forms do not resubmit immutable personal details.
  if (!record.personalInfo && state.initialManifest?.record?.personalInfo) record.personalInfo = state.initialManifest.record.personalInfo;
  const manifest = {
    version: 1, verified: true, kind: state.mode, role: state.role, url: state.url,
    patientId: String(state.ticket.patientId), ticketId: String(state.ticket.id), scope: state.ticket.scope,
    createdAt: new Date().toISOString(), record, labels: { ...(state.initialManifest?.labels || {}), ...labels }, controls: state.inputControls || [],
    review: state.inputReview || [], baseline: state.baselineSnapshot || null,
  };
  const reason = incompleteReason(manifest);
  manifest.verified = !reason;
  manifest.incompleteReason = reason;
  persist(manifest, account, fileDirectory);
  return manifest;
}

function persist(manifest, account, fileDirectory = directory) {
  fs.mkdirSync(fileDirectory, { recursive: true, mode: 0o700 });
  const filename = path.join(fileDirectory, `${randomUUID()}.json`);
  const temporary = `${filename}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, filename);
  const previous = registry.read().find(row => row.email === account.email && row.url === manifest.url);
  registry.save({ email: account.email, url: manifest.url,
    recordManifests: [...(previous?.recordManifests || []), { ticketId: manifest.ticketId, kind: manifest.kind, path: filename, verified: manifest.verified }],
  });
  return manifest;
}

async function captureControls(page, section) {
  return { section, fields: await page.locator('input,select,textarea').evaluateAll(elements => elements
    .filter(el => el.getClientRects().length && !el.disabled && !['hidden', 'password', 'submit', 'button'].includes(el.type))
    .filter(el => !/search/i.test(el.placeholder || '') && el.type !== 'search')
    .map((el, ordinal, visible) => ({
      tag: el.tagName.toLowerCase(), type: el.type, name: el.name || '', placeholder: el.placeholder || '',
      accordion: (() => { const panel = el.closest('div.max-h-0,div[class*="max-h-["]'); return panel?.parentElement.querySelector(':scope > button')?.textContent.trim().replace(/\s+/g, ' ') || null; })(),
      label: (el.labels?.[0]?.textContent || el.closest('label')?.textContent || '').trim().replace(/\s+/g, ' '),
      value: el.type === 'file' ? '' : el.value, checked: ['checkbox', 'radio'].includes(el.type) ? el.checked : undefined,
      files: el.type === 'file' ? [...el.files].map(file => file.name) : undefined,
      index: visible.slice(0, ordinal).filter(other => {
        const panel = item => item.closest('div.max-h-0,div[class*="max-h-["]');
        if (panel(other) !== panel(el) || other.tagName !== el.tagName) return false;
        if (['checkbox', 'radio'].includes(el.type) && el.name && other.value !== el.value) return false;
        return el.placeholder ? other.placeholder === el.placeholder : el.name ? other.name === el.name : el.tagName === 'INPUT' ? other.type === el.type : true;
      }).length,
    }))) };
}

async function captureReview(page) {
  return page.locator('dt').evaluateAll(elements => elements.map(el => ({ label: el.textContent.trim(),
    value: el.parentElement.querySelector('dd')?.textContent.trim() || '' })));
}

module.exports = { submittedRecord, incompleteReason, save, persist, captureControls, captureReview, required };
