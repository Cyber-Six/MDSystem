const { test } = require('@playwright/test');
const store = require('./store');
const { execute } = require('./engine');
const { makeDriver } = require('./driver');
for (const [index, definition] of store.scenarios.entries()) {
  test(`${definition.role} ${definition.kind}: connected ${definition.action} lifecycle`, async ({ browser }) => {
    test.setTimeout(definition.kind === 'update' ? 1_200_000 : 750_000);
    const run = store.read(process.env.E2E_LIFECYCLE_RUN_ID);
    if (process.env.E2E_LIFECYCLE_ENABLED !== '1' || !process.env.E2E_LIFECYCLE_LEASE || run.preflight?.status !== 'passed') {
      throw new Error('Run the lifecycle command with its opt-in and successful preflight');
    }
    const scenario = run.scenarios.find(item => item.id === definition.id);
    await execute(run, scenario, makeDriver(browser, run, index), store.write, (name, action) => test.step(name, action));
  });
}
