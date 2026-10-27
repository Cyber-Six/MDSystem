const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../custom-choices/account-registry');
const { recoverInputManifest } = require('./recovery');
const { persist } = require('./manifest');
const api = require('./api');

test('recover original input evidence only after read-only patient identity verification', async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(process.env.E2E_STAFF_RECORDS_ENABLED !== '1', 'Staff QA suite is not enabled');
  const reportFile = path.resolve('e2e-results/custom-choices/results.json');
  if (!fs.existsSync(reportFile)) return;
  const reports = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const url = (process.env.E2E_PATIENT_URL || '').replace(/\/+$/, '');
  const evidence = { network: [], recovered: [], stale: 0, unavailable: 0 };
  for (const account of registry.read()) {
    if (!account.ready || account.authInvalid || account.url !== url || account.recordManifests?.some(row => row.verified)) continue;
    const candidates = reports.filter(report => report.status === 'passed' && report.evidence?.role === account.role
      && String(report.evidence?.ticket?.id) === String(account.ticketId));
    if (!candidates.length) continue;
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const patient = await api.login(await context.newPage(), url, account.email, account.password, evidence);
      const ticket = await api.ticket(patient);
      const personal = await api.graphql(patient, '/profile/patient', 'query RecoverQAIdentity { pending: getPersonalRecordLog { identifier first_name last_name } approved: getPersonalRecord { identifier first_name last_name } }');
      let recovered = false;
      for (const report of candidates) {
        const manifest = recoverInputManifest(account, report, { ticket, personal: personal.pending || personal.approved });
        if (!manifest) continue;
        // Snapshot identity is checked before this manifest is ever used by a
        // scenario; its clinical values are compared there before decisions.
        persist(manifest, account);
        evidence.recovered.push({ role: manifest.role, ticketId: manifest.ticketId, patientId: manifest.patientId });
        recovered = true;
        break;
      }
      if (!recovered) evidence.unavailable++;
    } finally { await context.close(); }
  }
  await test.info().attach('staff-record-evidence.json', { body: JSON.stringify(require('../custom-choices/evidence').redact(evidence), null, 2), contentType: 'application/json' });
});
