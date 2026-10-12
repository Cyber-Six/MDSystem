// Copy this file to a new name ending in .spec.js, then edit the portal and
// assertions. Files ending in .js are not picked up by Playwright.
const { test, expect } = require('@playwright/test');

// Choose 'patient' or 'staff'. The URLs come from the root .env.e2e file.
const portal = 'patient';
const portals = {
  patient: {
    baseUrl: process.env.E2E_PATIENT_URL || 'http://127.0.0.1:4173',
    heading: 'Patient Portal',
  },
  staff: {
    baseUrl: process.env.E2E_STAFF_URL || 'http://127.0.0.1:4174',
    heading: 'Staff Portal',
  },
};

test(`${portal} portal example page check`, async ({ page }) => {
  const { baseUrl, heading } = portals[portal];
  await page.goto(`${baseUrl.replace(/\/+$/, '')}/auth/login`);

  // The login panel starts closed on the current portal UI.
  const openLoginButton = page.getByRole('button', { name: 'Open login panel' });
  if (await openLoginButton.isVisible().catch(() => false)) {
    await openLoginButton.click();
  }

  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
});
