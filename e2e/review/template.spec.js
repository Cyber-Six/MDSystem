const { test, expect } = require('@playwright/test');

// Choose the portal, then add the reviewed or recorded steps below.
const portalName = 'patient'; // Change to 'staff' for the staff portal.
const portalUrls = {
  patient: process.env.E2E_PATIENT_URL || 'http://127.0.0.1:4173',
  staff: process.env.E2E_STAFF_URL || 'http://127.0.0.1:4174',
};

test.skip(`${portalName} review template`, async ({ page }) => {
  const baseUrl = portalUrls[portalName];
  await page.goto(`${baseUrl.replace(/\/+$/, '')}/auth/login`);

  // Add Playwright actions and assertions here.
  await expect(page).toHaveURL(/\/auth\/login$/);
});
