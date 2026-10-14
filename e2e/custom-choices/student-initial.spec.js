const { test } = require('@playwright/test');
const { runWorkflow } = require('./workflow');

test('Student: initial record retains patient-defined choices', async ({ page }) => {
  await runWorkflow(page, 'Student', 'initial');
});
