const { randomUUID } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { registerAndOpenRecord, fillAndSubmitRecord } = require('../registration/registration-helpers');
const { inspectBatchSubmission } = require('../registration/submission-result');
const { fillUpdateProfileFields } = require('./update-profile-workflow');
const { observe, query, compare, attach } = require('./evidence');
const accountRegistry = require('./account-registry');

const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=', 'base64');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const next = page => page.getByRole('button', { name: 'Next', exact: true }).click();
const back = page => page.getByRole('button', { name: 'Back', exact: true }).click();

function checkboxFor(scope, name, suffix = false) {
  const pattern = new RegExp('^' + escape(name) + (suffix ? '(?: \\(.*\\))?' : '') + '$');
  return scope.locator('label').filter({ hasText: pattern }).locator('xpath=ancestor-or-self::*[self::label or self::div][.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]');
}

function field(page, label, selector = 'input') {
  return page.locator('label').filter({ hasText: new RegExp(`^${escape(label)}[\\s:*]*$`) }).locator('..').locator(selector);
}
async function step(state, name, action) {
  state.currentStep = name;
  return test.step(name, action);
}
async function openSection(page, title, placeholder) {
  const button = page.getByRole('button', { name: title, exact: true });
  const scope = button.locator('..');
  const opened = await scope.locator(':scope > div.max-h-0').count() === 0;
  if (!opened) await button.click();
  return scope;
}
function dataFor(role, mode) {
  const prefix = `QA ${role} ${mode} ${Date.now()} ${randomUUID().slice(0, 8)}`;
  const label = suffix => `${prefix} ${suffix}`.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  return { prefix, self: label('self condition'), family: label('family condition'), vaccine: label('vaccine'),
    allergen: label('allergen'), hospitalization: label('hospitalization'), operation: label('operation'),
    medication: label('medication'), employment: label('employment'), appliance: label('appliance'),
    allergyNotes: label('allergy notes'), hospitalizationNotes: label('hospitalization notes'),
    operationNotes: label('operation notes'), medicationNotes: label('medication notes'), reason: label('reason'),
    immunizationNotes: label('immunization notes'), familyRelation: 'Mother', allergenType: 'Environmental',
    admission: '2025-02-03', discharge: '2025-02-08', operationDate: '2025-03-04', vaccineDate: '2025-01-02',
    dose: 2, arch: 'Upper', identifier: String(10_000_000 + Math.floor(Math.random() * 80_000_000)) };
}

async function choice(page, state, { key, placeholder, domain, scope = page, allergen = false }) {
  return step(state, `Create, toggle, and reuse ${key}`, async () => {
    const input = scope.getByPlaceholder(placeholder, { exact: true });
    await input.fill('   ');
    await expect(scope.getByRole('button', { name: /\+ Add/ })).toHaveCount(0);
    await input.fill(state.data[key]);
    const add = scope.getByRole('button', { name: new RegExp(`^\\+ Add "${escape(state.data[key])}"`) });
    await expect(add).toBeVisible();
    if (allergen) await add.locator('..').locator('select').selectOption(state.data.allergenType);
    const responsePromise = page.waitForResponse(response => {
      const request = response.request();
      const text = request.postData() || '';
      return request.method() === 'POST' && text.includes(allergen ? 'createAllergenCatalogs' : 'createDomainCatalogs') && text.includes(state.data[key]);
    });
    await add.click();
    const response = await responsePromise;
    const body = await response.json();
    expect(response.ok(), `${key} creation HTTP status`).toBeTruthy();
    expect(body.errors || [], `${key} creation GraphQL errors`).toEqual([]);
    const rows = body.data?.[allergen ? 'createAllergenCatalogs' : 'createDomainCatalogs'];
    expect(Array.isArray(rows), `${key} creation must return catalog rows`).toBe(true);
    const created = rows.find(item => (allergen ? item.allergen : item.name) === state.data[key]);
    expect(created?.id, `${key} must have a saved catalog ID`).toBeTruthy();
    state.created[key] = { id: String(created.id), name: state.data[key], domain, type: created.type };
    const checkbox = checkboxFor(scope, state.data[key], true);
    // A broken creation UI can still expose the saved entry through search.
    // Keep the failure visible, then use that legitimate UI path to test later sections.
    await expect.soft(checkbox, `${key}: newly created label must appear`).toHaveCount(1, { timeout: 3_000 });
    if (await checkbox.count() === 1) {
      await expect.soft(checkbox, `${key}: creation must auto-select the entry`).toBeChecked();
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
    }
    const mutationsBefore = state.network.filter(item => /create(Domain|Allergen)Catalogs/.test(item.request?.query || '')).length;
    // Creation closes the dropdown without blurring the input. Move focus away
    // before searching again so React's onFocus opens it normally.
    await input.press('Tab');
    const searchResponse = page.waitForResponse(response => {
      const text = response.request().postData() || '';
      return response.request().method() === 'POST' && text.includes(allergen ? 'searchAllergenCatalogs' : 'searchDomainCatalogs') && text.includes(state.data[key]);
    });
    await input.fill(state.data[key]);
    const searched = await (await searchResponse).json();
    expect(searched.errors || [], `${key}: catalog search errors`).toEqual([]);
    const found = searched.data?.[allergen ? 'searchAllergenCatalogs' : 'searchDomainCatalogs'] || [];
    if (allergen && created.isValid === false) {
      // Patient-created allergens are pending approval and the API search
      // explicitly filters to valid entries. Verify that behavior without
      // treating the expected omission as a lookup failure.
      // The toggle exercise above intentionally leaves the checkbox unchecked;
      // restore the selected state before checking retention for pending rows.
      await checkbox.check();
      compare(state, `${key}: pending allergen is excluded from valid-only search`, false, found.some(item => String(item.id) === String(created.id)));
      await expect(checkbox, `${key}: pending choice remains visible in the form`).toHaveCount(1);
      await expect(checkbox, `${key}: pending choice remains selected`).toBeChecked();
      return checkbox;
    }
    compare(state, `${key}: search returns the existing ID`, true, found.some(item => String(item.id) === String(created.id)));
    const suggestion = scope.getByRole('button', { name: new RegExp(`^${escape(state.data[key])}(?:.*Already selected)?$`) });
    // The app intentionally filters already-rendered choices from suggestions.
    // Reuse that checkbox when present; otherwise select the search result.
    if (await checkbox.count() === 0) {
      await expect(suggestion, `${key}: search must render the existing saved choice`).toBeVisible();
      await suggestion.click();
    } else if (await suggestion.isVisible()) await suggestion.click();
    else { await input.press('Tab'); await checkbox.check(); }
    await expect(checkbox).toHaveCount(1);
    await expect(checkbox).toBeChecked();
    // Always exercise toggling, including when creation rendering failed.
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await Promise.allSettled([...state.pending]);
    const mutationsAfter = state.network.filter(item => /create(Domain|Allergen)Catalogs/.test(item.request?.query || '')).length;
    compare(state, `${key}: search reuse creates no extra catalog`, mutationsBefore, mutationsAfter);
    return checkbox;
  });
}

async function histories(page, state) {
  const update = state.mode === 'update';
  const selfTab = page.getByRole('button', { name: 'Yourself', exact: true });
  await selfTab.click();
  await choice(page, state, { key: 'self', placeholder: 'Type to search for a condition...', domain: 'MedicalCondition' });
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await expect(checkboxFor(page, state.data.self)).not.toBeChecked();
  const family = await choice(page, state, { key: 'family', placeholder: 'Type to search for a condition...', domain: 'MedicalCondition' });
  const relationPlaceholder = update ? 'e.g., Mother, Father, Brother, Sister' : 'Who has this condition? (e.g., Mother, Father, Sibling)';
  const relation = family.locator(`xpath=ancestor::div[.//input[@placeholder="${relationPlaceholder}"]][1]`).getByPlaceholder(relationPlaceholder);
  await relation.fill(state.data.familyRelation);
  await selfTab.click();
  await expect(checkboxFor(page, state.data.self)).toBeChecked();
  await expect(checkboxFor(page, state.data.family)).not.toBeChecked();
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await expect(family).toBeChecked();
  await expect(relation).toHaveValue(state.data.familyRelation);
}

async function validateBlockedNext(page, state, marker, message) {
  await next(page);
  const close = page.getByRole('button', { name: /I understand, let me fix it|OK, I will fix it/ });
  const blocked = await close.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true, () => false);
  compare(state, `Validation: ${message}`, true, blocked);
  if (blocked) {
    await expect.soft(page.getByText(new RegExp(message, 'i')).first()).toBeVisible();
    await close.click();
    await expect(marker).toBeVisible();
  } else await back(page);
}

async function background(page, state) {
  const update = state.mode === 'update';
  const configuration = [
    { key: 'vaccine', domain: 'Immunization', title: update ? 'Immunization History' : 'Immunization & Vaccines', placeholder: 'Type to search for a vaccine...' },
    { key: 'allergen', title: update ? 'Allergies' : 'History of Allergies', placeholder: 'Type to search for an allergen...', name: 'hasAllergies', allergen: true },
    { key: 'hospitalization', domain: 'Hospitalization', title: update ? 'Hospitalizations' : 'History of Hospitalizations', placeholder: 'Type to search for a condition...', name: update ? 'hasHospitalizations' : 'hasHospitalization' },
    { key: 'operation', domain: 'Operation', title: update ? 'Surgeries' : 'History of Operation', placeholder: 'Type to search for a procedure...', name: update ? 'hasSurgeries' : 'hasOperation' },
    { key: 'medication', domain: 'Medication', title: update ? 'Current Medications' : 'Medications', placeholder: 'Type to search for a medication...', name: 'hasMedications' },
  ];
  for (const config of configuration) {
    await step(state, `${config.key} form and companion details`, async () => {
      // Positive radio inputs are hidden inside closed accordion panels.
      const button = page.getByRole('button', { name: config.title, exact: true });
      let scope = button.locator('..');
      if (config.name) {
        const radio = scope.locator(`input[name="${config.name}"][value="${update ? 'yes' : 'Yes'}"]`);
        scope = await openSection(page, config.title);
        await radio.check();
      } else scope = await openSection(page, config.title, config.placeholder);
      const checkbox = await choice(page, state, { ...config, scope });
      // Input labels are rendered beside their controls, without label-for IDs.
      const entry = checkbox.locator('xpath=ancestor::div[.//input[@type="date"] or .//select][1]');
      if (config.key === 'vaccine') {
        await entry.locator('input[type="date"]').fill(state.data.vaccineDate);
        await entry.locator('input[type="number"]').fill(String(state.data.dose));
        if (update) await scope.getByPlaceholder('Any additional information about your immunizations, dates, or reactions.').fill(state.data.immunizationNotes);
      } else if (config.key === 'allergen') {
        await entry.locator('select').filter({ has: page.locator('option[value="Active"]') }).selectOption('Active');
        await entry.locator('select').filter({ has: page.locator('option[value="Mild"]') }).selectOption('Mild');
        await scope.getByPlaceholder(update ? 'Any additional information about your allergies, severity, reactions, etc.' : 'Specify additional allergies or details...').fill(state.data.allergyNotes);
      } else if (config.key === 'hospitalization') {
        await entry.locator('input[type="date"]').nth(0).fill(state.data.admission);
        await entry.locator('input[type="date"]').nth(1).fill(state.data.discharge);
        await scope.getByPlaceholder(update ? 'Any additional information about your hospitalizations.' : 'Any additional details about the hospitalization...').fill(state.data.hospitalizationNotes);
      } else if (config.key === 'operation') {
        await entry.locator('input[type="date"]').fill(state.data.operationDate);
        await scope.getByPlaceholder(update ? 'Any additional information about your surgeries.' : 'Any additional details about the operation...').fill(state.data.operationNotes);
      } else if (config.key === 'medication') {
        if (!update) await scope.getByPlaceholder('Why are you taking this medication?').fill(state.data.reason);
        await scope.getByPlaceholder(update ? 'Any additional information about your medications.' : 'Any other medications or details...').fill(state.data.medicationNotes);
      }
    });
  }
  const lifestyleTitle = update ? 'Lifestyle Habits' : 'Lifestyle';
  const lifestyle = await openSection(page, lifestyleTitle);
  for (const name of ['smoker', 'alcoholDrinker', 'vaper']) await lifestyle.locator(`input[name="${name}"][value="no"]`).check();
  if (update) {
    const vision = await openSection(page, 'Visual Acuity');
    await vision.locator('input[name="visualAcuity"][value="no"]').check();
  }
  // Deliberately omit a required admission date, verify blocking, then restore it.
  const hospitalTitle = update ? 'Hospitalizations' : 'History of Hospitalizations';
  const hospital = await openSection(page, hospitalTitle, 'Type to search for a condition...');
  const admission = hospital.locator('input[type="date"]').first();
  if (update) {
    await admission.fill('');
    await validateBlockedNext(page, state, hospital.getByPlaceholder('Type to search for a condition...'), 'admission date');
  }
  // Navigating back remounts accordion contents, so reopen before refilling.
  const restored = await openSection(page, hospitalTitle, 'Type to search for a condition...');
  await restored.locator('input[type="date"]').first().fill(state.data.admission);
}

async function initialPersonal(page, state) {
  await step(state, 'Custom employment category and blank validation', async () => {
    if (state.role !== 'Employee') return;
    await field(page, 'Employment Category', 'select').selectOption('Other');
    const input = page.getByPlaceholder('Enter your employment category');
    await input.fill('');
    // Initial forms validate on Submit; the blank-value probe runs at review.
    await input.fill(state.data.employment);
  });
}

async function initialDental(page, state) {
  await step(state, 'Custom dental appliance description and location', async () => {
    await page.locator('input[name="hasIntraOralAppliance"][value="yes"]').check();
    await checkboxFor(page, 'Other:').check();
    const description = page.getByPlaceholder('Specify other appliance...');
    await description.fill('');
    // Initial forms validate on Submit; the blank-value probe runs at review.
    await description.fill(state.data.appliance);
    await page.locator(`input[name="applianceArch-other"][value="${state.data.arch}"]`).check();
    await next(page);
    await back(page);
    await expect(description).toHaveValue(state.data.appliance);
    await expect(page.locator(`input[name="applianceArch-other"][value="${state.data.arch}"]`)).toBeChecked();
  });
}

async function review(page, state) {
  await step(state, 'Review custom values and retain selections when navigating back', async () => {
    for (const key of ['self', 'family', 'vaccine', 'allergen', 'hospitalization', 'operation', 'medication']) {
      await expect.soft(page.getByText(state.data[key], { exact: false }).first(), `Review shows ${key}`).toBeVisible({ timeout: 2_000 });
    }
    for (const key of state.mode === 'initial' ? ['appliance', ...(state.role === 'Employee' ? ['employment'] : [])] : []) {
      await expect.soft(page.getByText(state.data[key], { exact: false }).first(), `Review shows ${key}`).toBeVisible();
    }
    // Return through dental to the background step; reopen the collapsed section.
    await back(page);
    await back(page);
    const title = state.mode === 'update' ? 'Current Medications' : 'Medications';
    const scope = await openSection(page, title, 'Type to search for a medication...');
    const medication = checkboxFor(scope, state.data.medication);
    await expect.soft(medication, 'Medication remains selected after navigating back').toBeChecked({ timeout: 2_000 });
    if (await medication.count() === 0) {
      // Restore the displayed catalog through search, retaining the recorded
      // navigation defect and avoiding a new catalog mutation.
      await scope.getByPlaceholder('Type to search for a medication...').fill(state.data.medication);
      await scope.getByRole('button', { name: new RegExp(`^${escape(state.data.medication)}`) }).click();
    }
    await expect(scope.getByPlaceholder(state.mode === 'update' ? 'Any additional information about your medications.' : 'Any other medications or details...')).toHaveValue(state.data.medicationNotes);
    await next(page);
    await next(page);
  });
  if (state.mode === 'initial') await initialValidation(page, state);
}

async function initialValidation(page, state) {
  const edit = async title => page.getByText(title, { exact: true }).locator('..').getByRole('button', { name: 'Edit', exact: true }).click();
  await step(state, 'Validate blank Other appliance description on Submit', async () => {
    await back(page);
    const description = page.getByPlaceholder('Specify other appliance...');
    await description.fill('');
    await next(page);
    await probeInvalidSubmit(page, state, 'other appliance description', /specify.*appliance|appliance.*required/i);
    await back(page);
    await description.fill(state.data.appliance);
    await page.locator(`input[name="applianceArch-other"][value="${state.data.arch}"]`).check();
    await next(page);
  });
  if (state.role === 'Employee') await step(state, 'Validate blank Other employment on Submit', async () => {
    await edit('Personal Information');
    await page.getByPlaceholder('Enter your employment category').fill('');
    for (let i = 0; i < 4; i++) await next(page);
    await probeInvalidSubmit(page, state, 'other employment description', /specify.*employment category/i);
    await edit('Personal Information');
    await page.getByPlaceholder('Enter your employment category').fill(state.data.employment);
    for (let i = 0; i < 4; i++) await next(page);
  });
}

async function probeInvalidSubmit(page, state, name, message) {
  // Abort only invalid-probe writes: if the app fails validation, record the
  // defect without persisting an intentionally incomplete initial record.
  const writes = [];
  const pattern = /\/(emr|profile)\/patient$/;
  const guard = async route => {
    const request = route.request();
    const body = request.postDataJSON();
    if (/\bmutation\b/.test(body?.query || '')) {
      writes.push(body.query.match(/mutation\s+(\w+)/)?.[1] || 'anonymous');
      state.network.push({ endpoint: new URL(request.url()).pathname, request: body, response: { abortedForInvalidInputProbe: true } });
      await route.abort('blockedbyclient');
    } else await route.continue();
  };
  await page.route(pattern, guard);
  try {
    const certification = page.getByText(/I certify that the above information is/)
      .locator('xpath=../preceding-sibling::input[@type="checkbox"]');
    await expect(certification, 'Certification checkbox must be enabled after all selected catalog labels resolve').toBeEnabled();
    await certification.check();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const close = page.getByRole('button', { name: /I understand, let me fix it|OK, I will fix it/ });
    await close.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    compare(state, `Validation: ${name} must prevent writes`, [], writes);
    await expect.soft(page.getByText(message).filter({ hasNot: page.locator('input') }).first(), `Validation message: ${name}`).toBeVisible({ timeout: 2_000 });
    if (await close.isVisible()) await close.click();
    await certification.uncheck();
  } finally { await page.unroute(pattern, guard); }
}

const sections = {
  history: 'getMedicalHistory(pending: true) { id conditions { conditionId relationship description } notes }',
  allergies: 'getAllergyProfile(pending: true) { id allergies { allergenCatalogId status severity notes } notes }',
  hospitalization: 'getHospitalizationProfile(pending: true) { id hospitalizations { conditionId admissionDate dischargeDate notes } notes }',
  operation: 'getOperationProfile(pending: true) { id operations { procedureId operationDate notes } notes }',
  medication: 'getMedicationProfile(pending: true) { id medications { medicineId description } notes }',
  vaccine: 'getImmunizationProfile(pending: true) { id immunizations { vaccineTypeId immunizationDate doseNumber } notes }',
  appliance: 'getOralApplianceProfile(pending: true) { id appliances { tagId arch } notes otherDescription otherArch }',
};

async function verify(page, state) {
  await step(state, 'Read saved pending record and compare exact values', async () => {
    const result = await query(page, state, '/emr/patient', 'query CustomChoiceTicket { getUpdateTicket { id patientId status scope } }');
    state.ticket = result.getUpdateTicket;
    compare(state, 'Ticket status', 'Pending', state.ticket?.status);
    compare(state, 'Ticket scope', 'Both', state.ticket?.scope);
    expect(state.ticket?.id).toBeTruthy();
    if (state.baseline) expect(String(state.ticket.id), 'Update must create a new ticket').not.toBe(String(state.baseline.ticket.id));
    const saved = {};
    const failedReads = new Set();
    // Separate queries prevent one defective section from hiding all other reads.
    for (const [key, document] of Object.entries(sections)) {
      try {
        const data = await query(page, state, '/emr/patient', `query ReadCustom${key} { ${document} }`);
        saved[key] = Object.values(data)[0];
      } catch (error) {
        failedReads.add(key);
        expect.soft(false, `${key} readback failed: ${error.message}`).toBe(true);
      }
      if (!saved[key]) {
        if (!failedReads.has(key)) expect.soft(Boolean(saved[key]), `${key} pending readback returned no record`).toBe(true);
        continue;
      }
      compare(state, `${key} belongs to submitted ticket`, String(state.ticket.id), String(saved[key].id));
    }
    if (saved.history) {
      for (const key of ['self', 'family']) {
        const row = saved.history.conditions.find(item => String(item.conditionId) === state.created[key].id);
        compare(state, `${key} saved ID`, state.created[key].id, row && String(row.conditionId));
        compare(state, `${key} relationship`, key === 'self' ? null : state.data.familyRelation, row?.relationship);
      }
    }
    if (saved.allergies) {
      const allergy = saved.allergies.allergies.find(item => String(item.allergenCatalogId) === state.created.allergen.id);
      compare(state, 'Allergen ID', state.created.allergen.id, allergy && String(allergy.allergenCatalogId));
      compare(state, 'Allergy status', 'Active', allergy?.status);
      compare(state, 'Allergy severity', 'Mild', allergy?.severity);
      compare(state, 'Allergy record notes', `Other: ${state.data.allergyNotes}`, allergy?.notes);
    }
    if (saved.hospitalization) {
      const hospital = saved.hospitalization.hospitalizations.find(item => String(item.conditionId) === state.created.hospitalization.id);
      compare(state, 'Hospitalization ID', state.created.hospitalization.id, hospital && String(hospital.conditionId));
      compare(state, 'Admission date', state.data.admission, hospital?.admissionDate?.slice(0, 10));
      compare(state, 'Discharge date', state.data.discharge, hospital?.dischargeDate?.slice(0, 10));
      compare(state, 'hospitalization record notes', state.data.hospitalizationNotes, hospital?.notes);
    }
    if (saved.operation) {
      const operation = saved.operation.operations.find(item => String(item.procedureId) === state.created.operation.id);
      compare(state, 'Operation ID', state.created.operation.id, operation && String(operation.procedureId));
      compare(state, 'Operation date', state.data.operationDate, operation?.operationDate?.slice(0, 10));
      compare(state, 'operation record notes', state.data.operationNotes, operation?.notes);
    }
    if (saved.medication) {
      const medication = saved.medication.medications.find(item => String(item.medicineId) === state.created.medication.id);
      compare(state, 'Medication ID', state.created.medication.id, medication && String(medication.medicineId));
      if (state.mode === 'initial') compare(state, 'Medication reason', state.data.reason, medication?.description);
      compare(state, 'medication notes', state.data.medicationNotes, saved.medication.notes);
    }
    if (saved.vaccine) {
      const vaccine = saved.vaccine.immunizations.find(item => String(item.vaccineTypeId) === state.created.vaccine.id);
      compare(state, 'Vaccine ID', state.created.vaccine.id, vaccine && String(vaccine.vaccineTypeId));
      compare(state, 'Vaccine date', state.data.vaccineDate, vaccine?.immunizationDate?.slice(0, 10));
      compare(state, 'Vaccine dose', state.data.dose, vaccine?.doseNumber);
    }
    if (state.mode === 'initial' && saved.appliance) {
      compare(state, 'Other appliance text', state.data.appliance, saved.appliance.otherDescription);
      compare(state, 'Other appliance location', state.data.arch, saved.appliance.otherArch);
      if (state.role === 'Employee') {
        const info = await query(page, state, '/emr/patient', 'query ReadEmployeeCustomText { getPatientBasicInfo(userId: "self") { role department position employmentCategoryOther } }');
        compare(state, 'Custom employment description', state.data.employment, info.getPatientBasicInfo?.employmentCategoryOther);
      }
    }
    for (const [key, created] of Object.entries(state.created)) {
      const catalog = await query(page, state, '/emr/patient', created.type !== undefined
        ? 'query VerifyCustomAllergen($names: [String!]!) { searchAllergenCatalogs(allergens: $names) { id allergen type } }'
        : 'query VerifyCustomCatalog($names: [String!]!, $domain: String!) { searchDomainCatalogs(domain: $domain, names: $names) { id name } }',
      { names: [created.name], domain: created.domain });
      const rows = Object.values(catalog)[0];
      const matches = rows.filter(item => String(item.id) === created.id);
      compare(state, `${key} catalog ID remains searchable`, 1, matches.length);
      compare(state, `${key} catalog label`, created.name, matches[0]?.name || matches[0]?.allergen);
      if (key === 'allergen') compare(state, 'Allergen type', state.data.allergenType, matches[0]?.type);
    }
    if (state.baseline) {
      const profile = await query(page, state, '/emr/patient', 'query VerifyUpdateProfileType { getMyProfile { __typename id } }');
      compare(state, 'Update retains patient profile type', `${state.role}Profile`, profile.getMyProfile?.__typename);
      const current = await query(page, state, '/profile/patient', 'query VerifyApprovedPersonalRecord { getPersonalRecord { id first_name last_name } }');
      compare(state, 'Existing approved personal record preserved', state.baseline.personal, current.getPersonalRecord);
      const approved = await query(page, state, '/emr/patient', 'query VerifyApprovedContacts { getEmergencyContact(approved: true) { id firstContact { id contactName } secondContact { id contactName } } }');
      compare(state, 'Existing approved contact record preserved', state.baseline.contacts, approved.getEmergencyContact);
      compare(state, 'Approved contact record belongs to original approved ticket', String(state.baseline.ticket.id), String(approved.getEmergencyContact?.id));
    }
  });
}

async function loginForUpdate(page, state) {
  const accounts = accountRegistry.candidates(state.role, state.url);
  expect(accounts.length, 'No reusable QA accounts: run the matching initial workflow and approve its record through staff, or configure a complete E2E_CUSTOM credential pair.').toBeGreaterThan(0);
  const blockers = [];
  for (const account of accounts) {
  const { email, password } = account;
  await page.context().clearCookies();
  await page.goto(state.url);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  state.headers = {};
  try {
  await page.goto(`${state.url}/auth/login`);
  await page.getByRole('button', { name: 'Open login panel' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const inputs = page.locator('input[inputmode="numeric"][maxlength="1"]');
  await expect(inputs).toHaveCount(6);
  const otp = process.env.E2E_TEST_OTP || '111111';
  expect(otp).toMatch(/^\d{6}$/);
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(otp[i]);
  const completion = page.waitForResponse(response => response.url().endsWith('/auth/login/complete') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  const auth = await (await completion).json();
  expect(auth.ok, 'Patient authentication must succeed').toBe(true);
  expect(auth.accessToken).toBeTruthy();
  state.headers = { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' };
  const personal = await query(page, state, '/profile/patient', 'query CheckCustomChoiceEligibility { getCredentialStatus getPersonalRecordLogStatus getPersonalRecord { id first_name last_name } }');
  const emr = await query(page, state, '/emr/patient', 'query CheckCustomChoiceTicket { getUpdateTicket { id status scope } getPatientBasicInfo(userId: "self") { profile_type } getEmergencyContact(approved: true) { id firstContact { id contactName } secondContact { id contactName } } }');
  const reasons = accountRegistry.eligibility(state.role, personal, emr);
  if (reasons.length) {
    blockers.push(`${email}: ${reasons.join('; ')}`);
    continue;
  }
  state.baseline = { ticket: emr.getUpdateTicket, personal: personal.getPersonalRecord, contacts: emr.getEmergencyContact };
  return;
  } catch {
    blockers.push(`${email}: authentication or read-only eligibility request failed; check credentials, OTP, and deployment availability`);
  }
  }
  throw new Error(`No eligible ${state.role} QA account. ${blockers.join(' | ')}`);
}

async function updateWorkflow(page, state) {
  await step(state, 'Read-only eligibility check for dedicated approved patient', () => loginForUpdate(page, state));
  await page.goto(`${state.url}/record-update`);
  await page.getByRole('button', { name: /Both Update/ }).click();
  await step(state, 'Fill update personal information', async () => {
    if (state.role === 'Employee') {
      await expect(page.getByText('Employment Information', { exact: true })).toBeVisible();
    }
    await fillUpdateProfileFields(page, state.role, {
      programSearch: process.env.E2E_PROGRAM_SEARCH || 'Computer',
      department: process.env.E2E_CUSTOM_EMPLOYEE_DEPARTMENT || 'Facilities',
    });
    const labels = ['Name', 'Relationship', 'Contact Number'];
    for (const [label, values] of labels.map((label, i) => [label, i === 0 ? ['QA Primary', 'QA Secondary'] : i === 1 ? ['Parent', 'Sibling'] : ['09180000001', '09180000002']])) {
      const inputs = field(page, label);
      await expect(inputs).toHaveCount(2);
      for (let i = 0; i < 2; i++) await inputs.nth(i).fill(values[i]);
    }
    await next(page);
  });
  await histories(page, state);
  await background(page, state);
  await next(page);
  await step(state, 'Fill update dental form', async () => {
    let scope = await openSection(page, 'Dentist Visits');
    await scope.locator('input[name="seenByDentist"][value="yes"]').check();
    await field(scope, 'When was your last dental cleaning?', 'select').selectOption({ index: 1 });
    await scope.locator('input[type="month"]').fill('2025-06');
    scope = await openSection(page, 'Intraoral Appliances');
    await scope.locator('input[name="hasOralAppliances"][value="no"]').check();
    scope = await openSection(page, 'Dental Procedures');
    await scope.locator('input[name="hasDentalProcedures"][value="no"]').check();
    await openSection(page, 'Dental Photos');
    for (let i = 0; i < 2; i++) await page.locator('input[type="file"]').nth(i).setInputFiles({ name: `qa-update-dental-${i}.png`, mimeType: 'image/png', buffer: PHOTO });
    await next(page);
  });
  await review(page, state);
  await step(state, 'Submit pending update without approving existing records', async () => {
    // Recheck immediately before submission: the app can otherwise replace pending tickets.
    const eligibility = await query(page, state, '/emr/patient', 'query RecheckBeforeCustomUpdate { getUpdateTicket { id status } }');
    expect(eligibility.getUpdateTicket).toMatchObject({ id: state.baseline.ticket.id, status: 'Approved' });
    const submitted = page.waitForResponse(response => response.request().method() === 'POST' && /\/(emr)\/patient$/.test(response.url()) && /\bsubmitTicket\b/.test(response.request().postData() || ''));
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const response = await submitted;
    const body = await response.json();
    const outcome = inspectBatchSubmission(response.status(), body);
    expect(outcome.ok, `Update submission failed: ${outcome.details}`).toBe(true);
  });
  await verify(page, state);
}

async function runWorkflow(page, role, mode) {
    test.setTimeout(300_000);
    page.setDefaultTimeout(15_000);
    const state = { role, mode, url: (process.env.E2E_PATIENT_URL || '').replace(/\/+$/, ''), data: dataFor(role, mode) };
    observe(page, state);
    await page.route(/\/(emr|profile)\/patient$/, async route => {
      const request = route.request();
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      if (/\b(cancelUpdateTicket|cancelPersonalRecordLog)\b/.test(body?.query || '')) {
        state.network.push({ endpoint: new URL(request.url()).pathname, request: body, response: { blockedCancellation: true } });
        compare(state, 'Workflow must not cancel a patient record', false, true);
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    try {
      await step(state, 'Explicit opt-in and target preflight', async () => {
        expect(process.env.E2E_CUSTOM_CHOICES_ENABLED, 'Set E2E_CUSTOM_CHOICES_ENABLED=1 to create persistent QA choices and records').toBe('1');
        expect(state.url, 'Configure E2E_PATIENT_URL').toBeTruthy();
      });
      if (mode === 'update') await updateWorkflow(page, state);
      else {
        const profile = { role, gender: 'Male', branch: 'm', name: 'Custom', surname: role === 'Student' ? 'Student QA' : 'Employee QA' };
        const account = await step(state, 'Register a synthetic patient with eight-second pacing', () => registerAndOpenRecord(page, profile, role === 'Student' ? 20 : 21, {
          onRegistered: credentials => accountRegistry.save({ ...credentials, role, url: state.url }),
        }));
        await fillAndSubmitRecord(page, profile, role === 'Student' ? 20 : 24, account, {
          personal: () => initialPersonal(page, state),
          history: () => histories(page, state),
          background: () => background(page, state),
          dental: () => initialDental(page, state),
          review: () => review(page, state),
          afterBatch: async ({ result }) => {
            await step(state, 'Validate medical-record batch submission', async () => {
              expect(result.ok, `Submission response: ${result.details}`).toBe(true);
            });
            await Promise.allSettled([...state.pending]);
            await verify(page, state);
            if (test.info().errors.length === 0 && state.ticket?.status === 'Pending') {
              accountRegistry.save({ email: account.email, role, url: state.url, ready: true, ticketId: String(state.ticket.id) });
            }
          },
        });
      }
    } finally { await attach(state); }
}

module.exports = { runWorkflow, sections };
