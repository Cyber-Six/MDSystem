const { test } = require('@playwright/test');
const { runWorkflow } = require('./workflow');

test('Student: update record retains patient-defined choices', async ({ page }) => {
  await runWorkflow(page, 'Student', 'update');
});
