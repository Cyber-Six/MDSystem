const { test } = require('@playwright/test');
const { runWorkflow } = require('./workflow');

test('Employee: update record retains patient-defined choices', async ({ page }) => {
  await runWorkflow(page, 'Employee', 'update');
});
