const { test, expect } = require('@playwright/test');
require('./sanitized-artifacts');
const { openLogin, signIn } = require('./auth');

// The patient flow performs three logins, polls email, and verifies two OTPs.
// Keep individual UI actions bounded while allowing the complete flow on the Pi.
test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

const patientUrl = process.env.E2E_PATIENT_URL;
const staffUrl = process.env.E2E_STAFF_URL;
const password = process.env.E2E_ACCOUNT_PASSWORD;

test('CORE-AUTH-01,02 rejects invalid credentials and OTP, then authenticates the patient through email OTP', async ({ page }) => {
  // Patient credentials must not grant a staff portal session.
  await openLogin(page, staffUrl);
  await page.getByLabel('Email address').fill(process.env.E2E_PATIENT_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Email or password is incorrect.', { exact: true })).toBeVisible();

  await openLogin(page, patientUrl);
  await page.getByLabel('Email address').fill(process.env.E2E_PATIENT_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(`${password}-invalid`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Email or password is incorrect.', { exact: true })).toBeVisible();

  await signIn(page, patientUrl, process.env.E2E_PATIENT_EMAIL, { rejectOtpOnce: true });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
});

test('CORE-AUTH-03 startup administrator can authenticate and open role management', async ({ page }) => {
  await signIn(page, staffUrl, process.env.E2E_ADMIN_EMAIL);
  await page.goto(`${staffUrl}/settings/roles`);
  await expect(page.getByRole('main').getByRole('heading', { name: 'Administration', exact: true }))
    .toBeVisible({ timeout: 20_000 });
});

test('CORE-AUTH-04 branch staff authenticate but cannot access administrator role management', async ({ page }) => {
  await signIn(page, staffUrl, process.env.E2E_RESTRICTED_STAFF_EMAIL);
  await page.goto(`${staffUrl}/settings/roles`);
  await expect(page).toHaveURL(`${staffUrl}/`, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0);
});

test('CORE-AUTH-05 unauthenticated staff deep links redirect to login', async ({ page }) => {
  await page.goto(`${staffUrl}/settings/roles`);
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.getByRole('button', { name: 'Open login panel' })).toBeVisible();
});
