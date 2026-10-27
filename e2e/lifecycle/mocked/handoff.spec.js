const { test, expect } = require('@playwright/test');
const { scenarios } = require('../store');
const { execute, stageNames } = require('../engine');
const { makeDriver } = require('../driver');
const { fixture } = require('../../staff-records/fixtures');

// Boundary mocks exercise the actual lifecycle driver and engine. The same
// project also runs actual patient/staff component mocks for each UI section.
for (const [index, definition] of scenarios.entries()) {
  test(`${definition.role} ${definition.kind} ${definition.action}: exact patient and ticket handoffs`, async ({ browser }) => {
    const run = { id: 'mock-chain', targets: { E2E_PATIENT_URL: 'https://patient.qa.invalid', E2E_STAFF_URL: 'https://staff.qa.invalid' } };
    const scenario = { ...definition, stages: {} }, calls = [];
    const account = { email: `${definition.id}@qa.invalid`, password: 'mock-account-password', role: definition.role, url: run.targets.E2E_PATIENT_URL };
    const initial = fixture(definition.role, 'initial');
    initial.patientId = `${index + 1}`;
    initial.ticketId = `${index + 100}`;
    initial.controls = [{ section: 'personal', fields: [{ name: 'contactNumber', value: '09180000001' }] }];
    initial.review = [{ label: 'Name', value: 'Synthetic QA' }];
    let current;
    const patientWorkflow = { async runWorkflow(page, role, mode, options) {
      calls.push(mode === 'initial' ? 'initialSubmission' : 'updateSubmission');
      expect(options.lifecycle).toBe(true);
      expect(role).toBe(definition.role);
      if (mode === 'initial') {
        expect(options.account).toBeUndefined();
        expect(options.accountIndex).toBe(index + 100);
        await options.onRegistered(account);
        current = { manifest: structuredClone(initial), status: 'Pending' };
      } else {
        expect(options.account).toEqual(account);
        expect(current.status).toBe('Approved');
        expect(options.initialManifest).toEqual(current.manifest);
        const manifest = fixture(role, 'update');
        manifest.patientId = initial.patientId;
        manifest.ticketId = `${index + 200}`;
        manifest.baseline = { ticketId: initial.ticketId, record: structuredClone(initial.record) };
        manifest.controls = initial.controls;
        manifest.review = initial.review;
        current = { manifest, status: 'Pending' };
      }
      // Browser contexts exist at each boundary and close between phases.
      await page.setContent('<p>Mock patient submission complete</p>');
      await expect(page.getByText('Mock patient submission complete')).toBeVisible();
      return { account, manifest: current.manifest };
    } };
    const staffWorkflow = { async runWorkflow(_browser, assigned, options) {
      const baseline = definition.kind === 'update' && assigned.kind === 'initial';
      calls.push(baseline ? 'baselineApproval' : 'decision');
      expect(options.account).toEqual(account);
      expect(options.manifest).toEqual(current.manifest);
      expect(current.status).toBe('Pending');
      expect(assigned.role).toBe(definition.role);
      expect(assigned.action).toBe(baseline ? 'approve' : definition.action);
      const unchanged = structuredClone(current.manifest.record.medicationProfile);
      if (assigned.action === 'revise') {
        current.status = 'Revision';
        current.manifest = structuredClone(current.manifest);
        current.manifest.record.medicalHistory.notes = 'Revised QA medical note';
        current.status = 'RevisionSubmitted';
        expect(current.manifest.record.medicationProfile).toEqual(unchanged);
      }
      current.status = assigned.action === 'reject' ? 'Rejected' : 'Approved';
      return structuredClone(current);
    } };
    const persisted = [];
    await execute(run, scenario, makeDriver(browser, run, index, { patientWorkflow, staffWorkflow }), value => persisted.push(JSON.stringify(value)));
    expect(calls).toEqual(stageNames(scenario));
    expect(scenario.stages.decision.status).toBe('passed');
    expect(scenario.stages.decision.result.manifest.patientId).toBe(initial.patientId);
    if (definition.kind === 'update') expect(scenario.stages.decision.result.manifest.baseline.record).toEqual(initial.record);
    expect(persisted.length).toBeGreaterThan(0);
  });
}
