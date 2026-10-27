'use strict';
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const registry = require('../custom-choices/account-registry');
const { redact } = require('../custom-choices/evidence');
const { loadCandidates, reserve, assertTicket, acquireExecutionLease } = require('./selection');
const api = require('./api');
const { compareSaved, assertFullRecord } = require('./assertions');
const { revise } = require('./revision');

async function openRecord(staff, manifest, kind, status = 'Pending') {
  await staff.page.goto(`${staff.url}/`);
  // The sidebar may be collapsed, in which case its title remains available.
  const link = staff.page.locator('nav a[href="/pending"]').first();
  await expect(link, 'Staff sidebar must expose Pending Requests').toBeVisible();
  await link.hover();
  await link.click();
  await expect(staff.page).toHaveURL(`${staff.url}/pending`);
  const type = staff.page.locator('select').filter({ has: staff.page.locator('option[value="Initial Record"]') });
  await type.selectOption(kind === 'initial' ? 'Initial Record' : 'Record Update');
  const filter = staff.page.locator('select').filter({ has: staff.page.locator('option[value="all"]') }).filter({ has: staff.page.locator('option[value="RevisionSubmitted"]') });
  await filter.first().selectOption(status);
  const branch = manifest.record.personalInfo.branch;
  if (branch) {
    const branches = staff.page.locator('select').filter({ has: staff.page.locator(`option[value=${JSON.stringify(branch)}]`) });
    if (await branches.count()) {
      const selector = branches.last();
      if (await selector.isDisabled()) await expect(selector, 'Fixed staff branch must match the selected patient').toHaveValue(branch);
      else await selector.selectOption(branch);
    }
  }
  await expect(staff.page.getByText(/Loading (?:submissions|requests)/)).toHaveCount(0);
  const row = staff.page.getByRole('row').filter({ has: staff.page.getByRole('cell', { name: `#${manifest.ticketId}`, exact: true }) });
  for (let pageNumber = 0; pageNumber < 100 && !await row.count(); pageNumber++) {
    const next = staff.page.getByRole('button', { name: 'Next page', exact: true });
    if (!await next.count() || !await next.isEnabled()) break;
    await next.click();
  }
  await expect(row, `Selected QA ticket #${manifest.ticketId} must be visible in staff queue`).toHaveCount(1);
  await row.hover();
  await row.click();
  await staff.page.getByRole('button', { name: 'Review Full Record', exact: true }).click();
}

async function decision(staff, manifest, status, state) {
  assertTicket(manifest, await api.ticket(staff, manifest.patientId), state.actionableStatuses);
  state.permitStaffWrites = true;
  const responsePromise = staff.page.waitForResponse(response => response.request().method() === 'POST'
    && /\bstaffUpdateTicket\b/.test(response.request().postData() || ''));
  if (status === 'Revision') {
    await staff.page.getByRole('button', { name: 'Request Revision', exact: true }).click();
    const textarea = staff.page.locator('textarea').filter({ visible: true });
    await expect(textarea).toHaveCount(1);
    const send = staff.page.getByRole('button', { name: 'Send Revision Request', exact: true });
    await expect(send).toBeDisabled();
    await textarea.fill(state.instruction);
    await send.click();
  } else if (status === 'Rejected') {
    await staff.page.getByRole('button', { name: 'Back', exact: true }).click();
    await staff.page.getByRole('button', { name: 'Reject', exact: true }).click();
    const reason = staff.page.locator('textarea').filter({ visible: true });
    if (await reason.count()) await reason.fill(`QA rejection ${state.runId}`);
    await staff.page.getByRole('button', { name: 'Confirm Rejection', exact: true }).click();
  } else await staff.page.getByRole('button', { name: 'Approve', exact: true }).click();
  const response = await responsePromise;
  const body = await response.json();
  state.network.push(redact({ action: status, status: response.status(), response: body }));
  expect(response.ok(), `Staff ${status} HTTP response`).toBe(true);
  expect(body.errors || [], `Staff ${status} GraphQL errors`).toEqual([]);
  expect(body.data.staffUpdateTicket).toBe(status);
  state.permitStaffWrites = false;
}

async function installGuard(staff, patient, manifest, state) {
  await staff.page.route(/\/(?:emr|profile)\/medical$/, async route => {
    const body = route.request().postDataJSON();
    if (!/\bmutation\b/.test(body?.query || '')) return route.continue();
    const permitted = state.permitStaffWrites && String(body.variables?.userId) === String(manifest.patientId)
      && /\b(?:staffUpdateTicket|setPersonalRecordLog)\b/.test(body.query);
    try {
      if (!permitted) throw new Error('Unrelated or premature staff mutation blocked');
      assertTicket(manifest, await api.ticket(staff, manifest.patientId), state.actionableStatuses);
      await route.continue();
    } catch (error) { state.guardErrors.push(error.message); await route.abort('blockedbyclient'); }
  });
  await patient.page.route(/\/(?:emr|profile)\/patient$/, async route => {
    const body = route.request().postDataJSON();
    if (!/\bmutation\b/.test(body?.query || '')) return route.continue();
    try {
      if (!state.permitPatientWrites || /\b(?:cancel\w*|createUpdateTicket)\b/.test(body.query)) throw new Error('Unrelated or premature patient mutation blocked');
      assertTicket(manifest, await api.ticket(patient), ['Revision']);
      await route.continue();
    } catch (error) { state.guardErrors.push(error.message); await route.abort('blockedbyclient'); }
  });
}

async function verifyState(staff, patient, manifest, status, state) {
  await expect.poll(async () => (await api.ticket(staff, manifest.patientId))?.status).toBe(status);
  assertTicket(manifest, await api.ticket(staff, manifest.patientId), [status]);
  assertTicket(manifest, await api.ticket(patient), [status]);
  state.transitions.push({ ticketId: manifest.ticketId, status });
  const saved = await api.snapshot(staff, manifest.patientId, manifest.ticketId, { includeApproved: manifest.kind === 'update' || status === 'Approved' });
  compareSaved(manifest, saved, state.comparisons);
  return saved;
}

async function runWorkflow(browser, scenario, options = {}) {
  if (!options.lifecycle) test.setTimeout(300_000);
  if (options.lifecycle) expect(process.env.E2E_LIFECYCLE_ENABLED, 'Enable the lifecycle before staff decisions').toBe('1');
  else test.skip(process.env.E2E_STAFF_RECORDS_ENABLED !== '1', 'Set E2E_STAFF_RECORDS_ENABLED=1 to authorize QA staff decisions');
  const patientUrl = (process.env.E2E_PATIENT_URL || '').replace(/\/+$/, '');
  const staffUrl = (process.env.E2E_STAFF_URL || '').replace(/\/+$/, '');
  expect(patientUrl && staffUrl, 'Configure both deployed portal URLs').toBeTruthy();
  if (options.lifecycle) {
    expect(Boolean(options.account?.email && options.account?.password && options.manifest?.verified), 'Pass the exact lifecycle credentials and verified manifest').toBe(true);
    expect(options.account.role).toBe(scenario.role);
    expect(options.account.url).toBe(patientUrl);
    expect(options.manifest.role).toBe(scenario.role);
    expect(options.manifest.kind).toBe(scenario.kind);
    expect(options.manifest.url).toBe(patientUrl);
  }
  const selected = options.account && options.manifest
    ? { candidates: [{ account: options.account, manifest: options.manifest }], reasons: [] }
    : loadCandidates(registry.read(), scenario, patientUrl);
  if (options.lifecycle) expect(selected.candidates.length, 'Lifecycle requires its exact account and manifest').toBe(1);
  test.skip(!selected.candidates.length, `No suitable saved ${scenario.role} ${scenario.kind} record: ${selected.reasons.join('; ') || 'a complete original input manifest is unavailable'}`);
  for (const key of ['E2E_REVIEW_STAFF_EMAIL', 'E2E_REVIEW_STAFF_PASSWORD']) expect(process.env[key], `Configure ${key}`).toBeTruthy();
  const state = { runId: randomUUID(), scenario: scenario.id, network: [], comparisons: [], transitions: [], guardErrors: [], revisionChanges: [],
    actionableStatuses: ['Pending'], permitStaffWrites: false, permitPatientWrites: false };
  const releaseLease = options.leaseOwned ? () => {} : acquireExecutionLease();
  let staffContext, patientContext, manifest;
  try {
    staffContext = await browser.newContext({ serviceWorkers: 'block' });
    patientContext = await browser.newContext({ serviceWorkers: 'block' });
    const staff = await api.login(await staffContext.newPage(), staffUrl, process.env.E2E_REVIEW_STAFF_EMAIL, process.env.E2E_REVIEW_STAFF_PASSWORD, state);
    let patient;
    const unavailable = [];
    for (const candidate of selected.candidates) {
      if (!options.lifecycle && !reserve(scenario, candidate.account, candidate.manifest)) { unavailable.push('QA patient reserved for another scenario'); continue; }
      manifest = candidate.manifest;
      patient = await api.login(await patientContext.newPage(), patientUrl, candidate.account.email, candidate.account.password, state);
      const latest = await api.ticket(patient);
      if (String(latest?.id) !== manifest.ticketId || latest?.status !== 'Pending') { unavailable.push('saved ticket is no longer the latest Pending submission'); await patient.page.close(); patient = null; continue; }
      assertTicket(manifest, latest);
      const personalState = await api.patientPersonal(patient, { includeApproved: scenario.kind === 'update' });
      const activeStatuses = scenario.kind === 'initial' ? ['Active', 'Unverified'] : ['Active'];
      if (!activeStatuses.includes(personalState.getCredentialStatus)) {
        unavailable.push('patient account is not active for this workflow'); await patient.page.close(); patient = null; continue;
      }
      const saved = await api.snapshot(staff, manifest.patientId, manifest.ticketId, { includeApproved: scenario.kind === 'update' });
      expect(saved.basicInfo.profile_type, 'QA role must match').toBe(scenario.role);
      compareSaved(manifest, saved, state.comparisons);
      break;
    }
    if (options.lifecycle) expect(Boolean(patient), `Lifecycle record is not eligible: ${unavailable.join('; ')}`).toBe(true);
    else test.skip(!patient, `No eligible saved QA record: ${unavailable.join('; ')}`);
    await installGuard(staff, patient, manifest, state);
    const baseline = scenario.kind === 'update' ? await api.snapshot(staff, manifest.patientId, manifest.baseline.ticketId) : null;
    const approvedPersonal = baseline ? await api.patientPersonal(patient) : null;
    if (baseline) {
      expect(approvedPersonal.approved, 'Update requires an existing approved personal baseline').toBeTruthy();
      compareSaved({ ...manifest, ticketId: manifest.baseline.ticketId, record: manifest.baseline.record },
        { ...baseline, personal: { logs: [], approved: approvedPersonal.approved } }, state.comparisons);
    }
    const assertBaseline = async () => {
      if (!baseline) return;
      const current = await api.snapshot(staff, manifest.patientId, baseline.ticketId);
      expect(current.record, 'Previous approved clinical record must remain unchanged').toEqual(baseline.record);
      expect((await api.patientPersonal(patient)).approved, 'Previous approved personal information must remain unchanged').toEqual(approvedPersonal.approved);
    };
    await test.step('Review every submitted value in the selected full record', async () => {
      await openRecord(staff, manifest, scenario.kind);
      await assertFullRecord(staff.page, manifest, state.comparisons);
      await staff.page.reload();
      await openRecord(staff, manifest, scenario.kind);
      await assertFullRecord(staff.page, manifest, state.comparisons);
    });
    if (scenario.action === 'revise') {
      state.instruction = `QA ${state.runId}: correct the emergency contact, medical notes, and dental visit month.`;
      await test.step('Request revision and verify patient instructions', async () => {
        await decision(staff, manifest, 'Revision', state);
        const revised = await verifyState(staff, patient, manifest, 'Revision', state);
        expect((await api.ticket(patient)).notes).toBe(state.instruction);
        await assertBaseline();
      });
      const nextManifest = await test.step('Verify revision prefilling, edit and review patient values', () => revise(patient.page, manifest, state.instruction, state));
      await test.step('Resubmit the revised record', async () => {
        assertTicket(manifest, await api.ticket(patient), ['Revision']);
        state.permitPatientWrites = true;
        const submitted = patient.page.waitForResponse(response => /\bsubmit(?:Update)?Ticket\b/.test(response.request().postData() || ''));
        await patient.page.getByRole('button', { name: 'Submit', exact: true }).click();
        const response = await submitted, body = await response.json();
        expect(response.ok()).toBe(true); expect(body.errors || []).toEqual([]);
        expect(Object.values(body.data)).toContain('RevisionSubmitted');
        state.permitPatientWrites = false;
        await verifyState(staff, patient, nextManifest, 'RevisionSubmitted', state);
        await assertBaseline();
      });
      manifest = nextManifest;
      state.actionableStatuses = ['RevisionSubmitted'];
      await test.step('Review revised and unchanged values before approval', async () => {
        await openRecord(staff, manifest, scenario.kind, 'RevisionSubmitted');
        await assertFullRecord(staff.page, manifest, state.comparisons);
      });
      await decision(staff, manifest, 'Approved', state);
    } else await decision(staff, manifest, scenario.action === 'approve' ? 'Approved' : 'Rejected', state);
    const finalStatus = scenario.action === 'reject' ? 'Rejected' : 'Approved';
    await verifyState(staff, patient, manifest, finalStatus, state);
    if (finalStatus === 'Rejected') await assertBaseline();
    if (baseline) expect((await api.snapshot(staff, manifest.patientId, baseline.ticketId)).record).toEqual(baseline.record);
    await test.step('Reopen the decided record and verify retained full record', async () => {
      await openRecord(staff, manifest, scenario.kind, finalStatus);
      await assertFullRecord(staff.page, manifest, state.comparisons);
    });
    expect(state.guardErrors).toEqual([]);
    return { manifest, status: finalStatus };
  } finally {
    await test.info().attach('staff-record-evidence.json', { contentType: 'application/json', body: JSON.stringify(redact({ ...state, ticketId: manifest?.ticketId, patientId: manifest?.patientId }), null, 2) });
    try { await staffContext?.close(); await patientContext?.close(); } finally { releaseLease(); }
  }
}

module.exports = { runWorkflow, openRecord, decision, installGuard };
