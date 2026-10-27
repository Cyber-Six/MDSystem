'use strict';
const { expect, test } = require('@playwright/test');
const api = require('../staff-records/api');
const patientWorkflow = require('../custom-choices/workflow');
const staffWorkflow = require('../staff-records/workflow');
const { compareSaved, assertFullRecord } = require('../staff-records/assertions');
const { assertTicket } = require('../staff-records/selection');
const { incompleteReason } = require('../staff-records/manifest');
const { stageNames } = require('./engine');

async function withContexts(browser, action) {
  const contexts = [];
  const page = async () => {
    const context = await browser.newContext({ serviceWorkers: 'block', recordVideo: undefined });
    contexts.push(context);
    return context.newPage();
  };
  try { return await action(page); }
  finally { await Promise.all(contexts.map(context => context.close())); }
}
async function staffSession(page, run, evidence) {
  return api.login(page, run.targets.E2E_STAFF_URL, process.env.E2E_REVIEW_STAFF_EMAIL, process.env.E2E_REVIEW_STAFF_PASSWORD, evidence);
}
function validatePermissions(body) {
  if (!['Both', 'Manila'].includes(body.branch)) throw new Error('QA staff designation must cover Manila, where lifecycle accounts are registered');
  if (body.isAdmin) return;
  const modules = new Map((body.modules || []).map(item => [item.moduleId, item.enabled]));
  for (const name of ['pendingRequests', 'medicalRecords', 'dentalRecords']) {
    if (!modules.get(name)) throw new Error(`Enable the ${name} module for the dedicated QA staff account before lifecycle testing`);
  }
  if (!body.searchPatientPermissions?.emr_allow_view || !body.searchPatientPermissions?.profile_allow_view) {
    throw new Error('QA staff needs both patient profile and medical-record view permissions');
  }
}
async function preflight(browser, run) {
  for (const key of ['E2E_REVIEW_STAFF_EMAIL', 'E2E_REVIEW_STAFF_PASSWORD']) {
    if (!process.env[key] || /^(?:your-|actual-|\.\.\.)/.test(process.env[key])) throw new Error(`Configure ${key} in .env.e2e`);
  }
  if (!/^\d{6}$/.test(process.env.E2E_TEST_OTP || '')) throw new Error('Configure a six-digit E2E_TEST_OTP');
  const evidence = { network: [] };
  return withContexts(browser, async page => {
    const staff = await staffSession(await page(), run, evidence);
    const headers = { authorization: `Bearer ${staff.token}` };
    const profileResponse = await staff.page.request.get(`${staff.url}/staff/me/profile`, { headers });
    expect(profileResponse.ok(), 'Staff profile preflight HTTP status').toBe(true);
    expect((await profileResponse.json()).isActive, 'QA staff must be active').toBe(true);
    const response = await staff.page.request.get(`${staff.url}/staff/me/permissions`, { headers });
    expect(response.ok(), 'Staff permission preflight HTTP status').toBe(true);
    validatePermissions(await response.json());
    // This authenticated search executes the profile SQL even on an empty DB.
    // A random unmatched name probes the schema without retaining patient data.
    try {
      await api.graphql(staff, '/emr/medical', `query LifecycleSchemaPreflight($name: String!) {
        searchPatients(searchTerm: $name, branch: Manila, limit: 1) { id }
      }`, { name: `QA_LIFECYCLE_SCHEMA_${run.id}` });
    } catch (error) {
      if (/employmentCategoryOther[\s\S]*does not exist/.test(error.message)) {
        throw new Error('Deployment is missing employee_profile.employmentCategoryOther. Apply the employee-category ALTER TABLE statement from schemas/post_build_setup.sql to the deployed database, then retry. No lifecycle accounts were created.');
      }
      throw error;
    }
    const patient = await page();
    const portal = await patient.goto(`${run.targets.E2E_PATIENT_URL}/auth/login`);
    expect(portal?.ok(), 'Patient portal must be reachable before registration').toBe(true);
    await expect(patient.getByRole('button', { name: 'Open login panel' })).toBeVisible();
    return { verifiedAt: new Date().toISOString(), permissions: 'verified', schema: 'verified' };
  });
}

function makeDriver(browser, run, scenarioIndex, services = {}) {
  const patientRunner = services.patientWorkflow || patientWorkflow;
  const staffRunner = services.staffWorkflow || staffWorkflow;
  const latestResult = scenario => [...stageNames(scenario)].reverse().map(name => scenario.stages[name])
    .find(stage => stage?.status === 'passed')?.result;
  const patientStage = async (scenario, mode, onRegistered) => withContexts(browser, async page => {
    const result = await patientRunner.runWorkflow(await page(), scenario.role, mode, {
      lifecycle: true, account: mode === 'update' ? scenario.account : undefined,
      initialManifest: mode === 'update' ? scenario.stages.baselineApproval.result.manifest : undefined,
      accountIndex: scenarioIndex + 100, onRegistered,
    });
    const reason = incompleteReason(result.manifest, scenario.action === 'revise');
    if (reason) throw new Error(`Cannot advance to staff review: ${reason}`);
    return { ...result, status: 'Pending' };
  });
  const staffStage = async (scenario, action, kind, source) => {
    const result = await staffRunner.runWorkflow(browser, { ...scenario, action, kind }, {
      lifecycle: true, leaseOwned: true, account: scenario.account, manifest: source.manifest,
    });
    expect(test.info().errors, 'All saved-value and visibility checks must pass').toEqual([]);
    return { ...result, account: scenario.account };
  };
  return {
    async reconcile(scenario) {
      const evidence = { network: [], comparisons: [] };
      await withContexts(browser, async page => {
        const patient = await api.login(await page(), run.targets.E2E_PATIENT_URL, scenario.account.email, scenario.account.password, evidence);
        const current = await api.ticket(patient);
        await test.info().attach('lifecycle-reconciliation.json', { contentType: 'application/json',
          body: JSON.stringify({ scenario: scenario.id, ticket: current }) });
        const previous = latestResult(scenario);
        if (!previous) return; // The engine blocks failed/interrupted registration; it never repeats it.
        assertTicket(previous.manifest, current, [previous.status]);
        const staff = await staffSession(await page(), run, evidence);
        const saved = await api.snapshot(staff, previous.manifest.patientId, previous.manifest.ticketId);
        compareSaved(previous.manifest, saved, evidence.comparisons);
        await staffWorkflow.openRecord(staff, previous.manifest, previous.manifest.kind, previous.status);
        await assertFullRecord(staff.page, previous.manifest, evidence.comparisons);
        expect(test.info().errors, 'Resume readback must match the original run manifest').toEqual([]);
      });
    },
    initialSubmission: (scenario, onRegistered) => patientStage(scenario, 'initial', onRegistered),
    baselineApproval: scenario => staffStage(scenario, 'approve', 'initial', scenario.stages.initialSubmission.result),
    updateSubmission: scenario => patientStage(scenario, 'update'),
    decision: scenario => staffStage(scenario, scenario.action, scenario.kind,
      scenario.stages[scenario.kind === 'update' ? 'updateSubmission' : 'initialSubmission'].result),
  };
}
module.exports = { preflight, validatePermissions, makeDriver, withContexts };
