const { test } = require('@playwright/test');
const store = require('./store');
const { preflight } = require('./driver');
test('Validate lifecycle deployment, schema, and QA staff before registration', async ({ browser }) => {
  test.setTimeout(120_000);
  if (process.env.E2E_LIFECYCLE_ENABLED !== '1') throw new Error('Set E2E_LIFECYCLE_ENABLED=1 to authorize account creation and staff decisions');
  if (!process.env.E2E_LIFECYCLE_LEASE) throw new Error('Use npm run test:e2e:lifecycle to acquire the exclusive QA lease');
  const run = store.open(process.env.E2E_LIFECYCLE_RUN_ID, store.targets(), process.env.E2E_LIFECYCLE_RESUME === '1');
  try {
    run.preflight = { status: 'passed', ...await preflight(browser, run) };
  } catch (error) {
    run.preflight = { status: 'failed', reason: require('../custom-choices/evidence').redact(error.message) };
    throw error;
  } finally { store.write(run); }
});
