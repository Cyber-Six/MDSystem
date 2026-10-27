const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, staffRecord } = require('../fixtures');
let script;
test.beforeAll(async () => {
  const root = path.resolve(__dirname, '../../..');
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'patient-harness.jsx')], bundle: true, write: false, format: 'iife',
    define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'mock-patient-services', setup(build) {
      build.onResolve({ filter: /^(?:react|react-dom)(?:\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [root] }) }));
      build.onResolve({ filter: /^qa-(?:initial|update)-mapper$/ }, args => ({ path: args.path, namespace: 'actual-mapper' }));
      build.onLoad({ filter: /.*/, namespace: 'actual-mapper' }, args => {
        const file = args.path === 'qa-initial-mapper' ? 'mds-patient/src/services/emr-service.js' : 'mds-patient/src/modules/record-forms/update-record/update-record-service.jsx';
        return { contents: fs.readFileSync(path.join(root, file), 'utf8'), loader: 'jsx', resolveDir: path.dirname(path.join(root, file)) };
      });
      build.onResolve({ filter: /(?:emr-service|medical-history-service|dental-history-service|packages-core-adapter|graphql-client|use-banner\.js)$/ }, args => ({ path: args.path, namespace: 'qa-patient-service' }));
      build.onLoad({ filter: /.*/, namespace: 'qa-patient-service' }, args => {
        let contents;
        if (args.path.endsWith('use-banner.js')) contents = 'export const useBanner=()=>({clearAllBanners(){},addBanner(){},showBanner(){}});';
        else if (args.path.endsWith('packages-core-adapter')) contents = `export async function axiosRequest(){return {data:new Blob(['photo'])}}; axiosRequest.post=async()=>({data:{data:{searchStudentProgram:[{id:'109',label:'QA Computer Science'}]}}}); export const API_BASE_URL='';`;
        else if (args.path.endsWith('graphql-client')) contents = 'export const sendGraphQLRequest=async()=>({});';
        else contents = `export const searchStudentProgram=async()=>[{id:'109',label:'QA Computer Science'}];
          export const fetchAllMedicalCatalogs=async()=>window.patientFixture.medicalCatalogs;
          export const fetchAllDentalCatalogs=async()=>window.patientFixture.dentalCatalogs;
          export const searchDomainCatalog=async()=>[];export const createDomainCatalog=async()=>{throw Error('Unexpected persistent write')};
          export const searchImmunizationCatalog=async()=>[];export const createImmunizationCatalog=createDomainCatalog;
          export const searchAllergenCatalogByName=async()=>[];export const createAllergenCatalogEntry=createDomainCatalog;`;
        return { contents, loader: 'js' };
      });
    } }] }); script = result.outputFiles[0].text;
});

for (const role of ['Student', 'Employee']) for (const kind of ['initial', 'update']) test(`${role} ${kind}: patient revision prefills original values and retains edits through navigation`, async ({ page }) => {
  const manifest = fixture(role, kind), record = structuredClone(manifest.record), catalogs = staffRecord(manifest).catalogs;
  if (role === 'Student') record.profile.program = manifest.labels['109'];
  const names = { medicalConditions: 'medicalConditionCatalog', hospitalizations: 'hospitalizationCatalog', operations: 'operationCatalog', medications: 'medicationCatalog', immunizations: 'immunizationCatalog', allergens: 'allergenCatalog' };
  const medicalCatalogs = { ...Object.fromEntries(Object.entries(names).map(([key, value]) => [key, catalogs[value]])), visualAcuity: [{ id: '1', name: 'Glasses' }] };
  await page.setContent('<div id="root"></div>');
  await page.evaluate(value => { window.patientFixture = value; }, { role, kind, record, catalogs, medicalCatalogs, dentalCatalogs: { oralAppliances: catalogs.oralApplianceCatalog, dentalProcedures: catalogs.dentalProcedureCatalog }, instruction: 'QA unique revision instruction' });
  await page.addScriptTag({ content: script });
  await expect(page.getByText('QA unique revision instruction', { exact: true })).toBeVisible();
  const primary = page.getByPlaceholder('Contact Name', { exact: true }).first();
  await expect(primary).toHaveValue('QA Primary');
  await primary.fill('QA Primary Revised');
  const next = () => page.getByRole('button', { name: 'QA next section', exact: true }).click();
  const back = () => page.getByRole('button', { name: 'QA previous section', exact: true }).click();
  await next(); await back();
  await expect(primary).toHaveValue('QA Primary Revised');
  await next();
  if (kind === 'initial') await next();
  const notes = page.locator('textarea').filter({ visible: true });
  // Actual form accordions are opened before inspecting the original saved notes.
  const headings = page.getByRole('button').filter({ hasText: /Hospital|Allerg|Medicat|Operation|Lifestyle/ });
  for (const button of await headings.all()) if (await button.isVisible() && await button.locator('..').locator(':scope > div.max-h-0').count()) await button.click();
  const originalMedical = kind === 'initial' ? await page.evaluate(() => window.patientFormData.medicalBackground) : await page.evaluate(() => window.patientFormData);
  expect(kind === 'initial' ? originalMedical.smokerSticksPerDay : originalMedical.smokerSticksPerDay).toEqual(kind === 'initial' ? '0' : 0);
  expect(kind === 'initial' ? originalMedical.allergyOther : originalMedical.allergiesNotes).toBe('QA Allergy Profile Notes');
  const hospital = notes.filter({ hasText: 'QA Hospital Notes' });
  let selected = null;
  for (const input of await notes.all()) if (await input.inputValue() === 'QA Hospital Notes') { selected = input; break; }
  expect(selected, 'Original hospitalization notes must be prefilled in an editable form field').toBeTruthy();
  await selected.fill('QA Hospital Notes Revised');
  await next();
  const month = page.locator('input[type="month"]').first();
  await expect(month).toHaveValue('2024-02');
  await month.fill('2025-07');
  await next();
  await expect(page.locator('#root')).toContainText('QA Primary Revised');
  await expect(page.locator('#root')).toContainText('QA Hospital Notes Revised');
  await expect(page.locator('#root')).toContainText('QA Family Condition');
  await expect(page.locator('#root')).toContainText('QA Self Condition');
  await expect(page.locator('#root')).toContainText('Mother');
  await expect(page.locator('#root')).not.toContainText(/undefined|Unresolved choice/);
});

test('captured controls retain native select and accordion identity', async ({ page }) => {
  const { captureControls } = require('../manifest');
  const { control } = require('../revision');
  await page.setContent('<div><button>QA First</button><div class="max-h-[2000px]"><input placeholder="Repeated" value="first"><select><option value="saved" selected>Saved</option></select></div></div><div><button>QA Second</button><div class="max-h-[2000px]"><input placeholder="Repeated" value="second"></div></div>');
  const snapshot = await captureControls(page, 'background');
  expect(snapshot.fields).toHaveLength(3);
  for (const field of snapshot.fields) await expect(control(page, field)).toHaveValue(field.value);
});

for (const kind of ['initial', 'update']) test(`${kind} revision respects the workflow certification interface`, async ({ page }) => {
  const { certifyRevision } = require('../revision');
  await page.setContent(kind === 'initial' ? '<label><input type="checkbox">I certify the record</label>' : '<p>Review before submitting</p>');
  await certifyRevision(page, kind);
  if (kind === 'initial') await expect(page.getByRole('checkbox')).toBeChecked();
});
