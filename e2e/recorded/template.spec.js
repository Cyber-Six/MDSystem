const { test, expect } = require('@playwright/test');

// Choose the portal this recording targets, then paste Codegen actions inside
// the test. Targets are loaded from the repository-root .env.e2e file.
const portalName = 'patient'; // Change to 'staff' for the staff portal.
const portals = {
  patient: process.env.E2E_PATIENT_URL || 'http://127.0.0.1:4173',
  staff: process.env.E2E_STAFF_URL || 'http://127.0.0.1:4174',
};
const portal = {
  baseUrl: portals[portalName],
  startPath: '/auth/login',
};

test(`recorded ${portalName} test template`, async ({ page }) => {
  await page.goto(`${portal.baseUrl.replace(/\/+$/, '')}${portal.startPath}`);

  // Paste recorded Playwright actions here, for example:
  // await page.getByRole('button', { name: 'Open login panel' }).click();
  // await expect(page.getByRole('heading', { name: 'Patient Portal' })).toBeVisible();
});
