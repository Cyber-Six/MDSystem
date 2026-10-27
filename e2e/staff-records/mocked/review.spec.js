const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const path = require('node:path');
const { fixture, staffRecord } = require('../fixtures');
const { assertFullRecord } = require('../assertions');
const { replaceValue } = require('../revision');
let script;
test.beforeAll(async () => {
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, 'harness.jsx')], bundle: true, write: false, format: 'iife',
    define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'mock-services', setup(build) {
      build.onResolve({ filter: /^(?:react|react-dom)(?:\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [path.resolve(__dirname, '../../..')] }) }));
      build.onResolve({ filter: /(?:patient-record-service|initial-record-service|packages-core-adapter)$/ }, args => ({ path: args.path, namespace: 'qa-services' }));
      build.onLoad({ filter: /.*/, namespace: 'qa-services' }, args => ({ contents: args.path.includes('patient-record-service')
        ? 'export async function fetchPatientRecordForReview(){if(window.staffFixture.readError)throw Error(window.staffFixture.readError);return window.staffFixture.record} export async function submitStaffEdits(){return {success:true}}'
        : args.path.includes('initial-record-service')
          ? `export const TICKET_STATUS={PENDING:'Pending',REVISION_SUBMITTED:'RevisionSubmitted',REVISION:'Revision',APPROVED:'Approved',REJECTED:'Rejected'};
            export async function staffUpdateTicket(userId,status,notes){const r=await fetch('https://staff.qa.invalid/mock/decision',{method:'POST',body:JSON.stringify({userId,status,notes})});const b=await r.json();if(!r.ok||b.errors?.length)throw Error(b.errors?.[0]?.message||'HTTP failure');return b.data.staffUpdateTicket}
            export const approveReviewedRecord=userId=>staffUpdateTicket(userId,'Approved');`
          : `export const axiosRequest={get:async path=>{const r=await fetch('https://staff.qa.invalid'+path);return {data:await r.blob()}}};`, loader: 'js' }));
    } }] });
  script = result.outputFiles[0].text;
});

async function mount(page, manifest, extra = {}) {
  await page.route('https://staff.qa.invalid/**', async route => {
    if (route.request().url().includes('/media/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="yellow"/></svg>' });
    const body = JSON.parse(route.request().postData());
    await page.evaluate(value => { window.decisionRequest = value; }, body);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(extra.apiError
      ? { errors: [{ message: extra.apiError }] } : { data: { staffUpdateTicket: body.status } }) });
  });
  await page.setContent('<div id="root"></div>');
  await page.evaluate(value => { window.staffFixture = value; }, { record: staffRecord(manifest), ticket: { id: manifest.ticketId, patientId: manifest.patientId, scope: manifest.scope, status: 'Pending', is_initial: manifest.kind === 'initial' }, ...extra });
  await page.addScriptTag({ content: script });
}

for (const role of ['Student', 'Employee']) for (const kind of ['initial', 'update']) {
  test(`${role} ${kind}: complete female custom-choice review and revision values`, async ({ page }) => {
    const original = fixture(role, kind);
    await mount(page, original);
    await assertFullRecord(page, original);
    await page.getByRole('button', { name: 'Request Revision', exact: true }).click();
    const send = page.getByRole('button', { name: 'Send Revision Request' });
    await expect(send).toBeDisabled();
    await page.locator('textarea').fill('QA change notes');
    await send.click();
    await expect.poll(() => page.evaluate(() => window.actions)).toEqual(['Revision']);
    const revised = structuredClone(original);
    revised.record = replaceValue(revised.record, 'QA Hospital Notes', 'QA Revised Hospital Notes');
    revised.record = replaceValue(revised.record, 'QA Primary', 'QA Revised Primary');
    revised.record = replaceValue(revised.record, '2024-02-10', '2025-07-01');
    await page.evaluate(record => {
      window.staffFixture.record = record;
      window.staffFixture.ticket.status = 'RevisionSubmitted';
      window.renderStaff();
    }, staffRecord(revised));
    await assertFullRecord(page, revised);
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.actions)).toEqual(['Revision', 'Approved']);
  });
}

for (const scope of ['Medical', 'Dental']) test(`${scope}-only hides non-applicable sections`, async ({ page }) => {
  const manifest = fixture('Student', 'update', scope);
  await mount(page, manifest);
  await assertFullRecord(page, manifest);
  await expect(page.getByRole('heading', { name: scope === 'Dental' ? 'Medical History' : 'Dental History', exact: true })).toHaveCount(0);
});

test('failed staff decision remains visible and does not report approval', async ({ page }) => {
  const manifest = fixture();
  await mount(page, manifest, { apiError: 'QA backend rejected approval' });
  await assertFullRecord(page, manifest);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('QA backend rejected approval', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.actions)).toEqual([]);
});

test('unresolved selected catalog blocks approval and fails visibility checks', async ({ page }) => {
  const manifest = fixture();
  const record = staffRecord(manifest); record.catalogs.medicalConditionCatalog = [];
  await mount(page, manifest, { record });
  await expect(page.getByRole('alert')).toContainText('could not be resolved');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.actions)).toEqual([]);
});

for (const role of ['Student', 'Employee']) for (const kind of ['initial', 'update']) test(role + ' ' + kind + ': rejection retains its reason after full review', async ({ page }) => {
  const manifest = fixture(role, kind);
  await mount(page, manifest, { view: 'detail' });
  await page.getByRole('button', { name: 'Review Full Record', exact: true }).click();
  await assertFullRecord(page, manifest);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Rejection', exact: true }).click();
  expect(await page.evaluate(() => window.actions)).toEqual([]);
  await page.locator('textarea').fill('QA incomplete evidence: rejection instruction');
  await page.getByRole('button', { name: 'Confirm Rejection', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.actions)).toEqual(['Rejected']);
  expect(await page.evaluate(() => window.decisionRequest.notes)).toBe('QA incomplete evidence: rejection instruction');
});

test('a failed complete-visibility assertion stops the workflow before any decision', async ({ page }) => {
  const manifest = fixture(); const record = staffRecord(manifest);
  record.basicInfo.nationality = 'Incorrect nationality';
  await mount(page, manifest, { record });
  let actionReached = false;
  try {
    await assertFullRecord(page, manifest);
    actionReached = true;
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
  } catch (error) { expect(error.message).toContain('Filipino'); }
  expect(actionReached).toBe(false);
  expect(await page.evaluate(() => window.actions)).toEqual([]);
});

test('abandoned lifestyle details stay hidden while explicit No answers remain visible', async ({ page }) => {
  const manifest = fixture();
  Object.assign(manifest.record.lifestyle, { smoker: false, numberOfCigarettesPerDay: 98765, yearsSmoked: 12345, vapeUser: false, vapeType: 'Abandoned vape value', alcoholConsumer: false, frequencyOfAlcoholConsumption: 'Abandoned alcohol value' });
  await mount(page, manifest);
  await assertFullRecord(page, manifest);
  await expect(page.getByRole('dialog', { name: 'Record Review' })).not.toContainText(/98765|12345|Abandoned/);
});
