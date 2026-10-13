const { test, expect } = require('@playwright/test');

const patientUrl = process.env.E2E_PATIENT_URL;
const runId = `${Date.now()}${Math.floor(Math.random() * 10_000).toString().padStart(4, '0')}`;

async function openRegistration(page) {
  if (!patientUrl) throw new Error('Set E2E_PATIENT_URL to the patient test deployment URL.');
  await page.addInitScript(() => {
    // Registration input checks are client-side. Supply a harmless test token
    // so a deployment with reCAPTCHA enabled can reach those checks.
    window.grecaptcha = {
      ready(callback) { callback(); },
      render(_container, options) {
        queueMicrotask(() => options.callback('playwright-test-token'));
        return 1;
      },
      reset() {},
    };
  });
  await page.goto(`${patientUrl.replace(/\/+$/, '')}/auth/login`);
  await page.getByRole('button', { name: 'Open login panel' }).click();
  await page.getByRole('button', { name: 'Register' }).click();
}

async function fillAccount(page, { email, password, confirmation }) {
  const registrationForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create Account', exact: true }) });
  await registrationForm.locator('input[name="email"]').fill(email);
  await registrationForm.locator('input[name="password"]').fill(password);
  await registrationForm.getByLabel('Confirm Password').fill(confirmation);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

test('registration blocks mismatched passwords before sending a request', async ({ page }) => {
  let registerRequests = 0;
  await page.route('**/auth/register', async route => {
    registerRequests += 1;
    await route.fulfill({ status: 500, body: 'Unexpected registration request' });
  });
  await openRegistration(page);
  await fillAccount(page, {
    email: `mqa${runId}@tip.edu.ph`,
    password: 'correct-password',
    confirmation: 'different-password',
  });
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
  expect(registerRequests).toBe(0);
  await expect(page.getByRole('button', { name: 'Verify code' })).toHaveCount(0);
});

test('registration blocks passwords shorter than eight characters before sending a request', async ({ page }) => {
  let registerRequests = 0;
  await page.route('**/auth/register', async route => {
    registerRequests += 1;
    await route.fulfill({ status: 500, body: 'Unexpected registration request' });
  });
  await openRegistration(page);
  await fillAccount(page, {
    email: `mqa${runId}short@tip.edu.ph`,
    password: 'short7',
    confirmation: 'short7',
  });
  await expect(page.getByText('Password must be at least 8 characters long.', { exact: true })).toBeVisible();
  expect(registerRequests).toBe(0);
  await expect(page.getByRole('button', { name: 'Verify code' })).toHaveCount(0);
});

test('registration reports non-institutional email addresses without creating an account', async ({ page }) => {
  let registerRequests = 0;
  await page.route('**/auth/register', async route => {
    registerRequests += 1;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'INVALID_INSTITUTION_EMAIL', message: 'Email must follow TIP institutional format.' }),
    });
  });
  await openRegistration(page);
  await fillAccount(page, {
    email: `qa.user.${runId}@example.com`,
    password: 'valid-password',
    confirmation: 'valid-password',
  });
  await expect(page.getByRole('paragraph').filter({ hasText: /^Email must follow TIP institutional format\.$/ })).toBeVisible();
  expect(registerRequests).toBe(1);
  await expect(page.getByRole('button', { name: 'Verify code' })).toHaveCount(0);
});

