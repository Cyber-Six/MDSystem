const { test } = require('@playwright/test');
require('./safe-artifacts');
const { runWorkflow } = require('./workflow');

test('Student: initial record retains patient-defined choices', async ({ page }) => {
  await runWorkflow(page, 'Student', 'initial');
});
