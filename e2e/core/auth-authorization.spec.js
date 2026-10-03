const { test, expect } = require('@playwright/test');
require('./sanitized-artifacts');

// The patient flow performs three logins, polls email, and verifies two OTPs.
// Keep individual UI actions bounded while allowing the complete flow on the Pi.
test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

const patientUrl = process.env.E2E_PATIENT_URL;
const staffUrl = process.env.E2E_STAFF_URL;
const password = process.env.E2E_ACCOUNT_PASSWORD;
const mailpitUrl = process.env.MAILPIT_URL;

async function openLogin(page, baseUrl) {
  await page.goto(`${baseUrl}/auth/login`);
  const openLoginButton = page.getByRole('button', { name: 'Open login panel' });
  // Both portals start with a closed sliding panel. isVisible() is an immediate
  // snapshot and can skip opening it when the React UI has not rendered yet.
  await expect(openLoginButton).toBeVisible({ timeout: 15_000 });
  await openLoginButton.click();
  await expect(page.getByLabel('Email address')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
}

async function readLatestOtp(email) {
  const url = `${mailpitUrl}/view/latest.txt?query=${encodeURIComponent(`to:${email}`)}`;
  await expect.poll(async () => {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = await response.text();
    const code = body.match(/\b\d{6}\b/)?.[0];
    return code || null;
  }, { timeout: 20_000, intervals: [200, 400, 800, 1200] }).not.toBeNull();
  const response = await fetch(url);
  const body = await response.text();
  const code = body.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error('The local SMTP capture received no six-digit OTP.');
  return code;
}

async function enterOtp(page, code) {
  const inputs = page.locator('input[inputmode="numeric"]');
  await expect(inputs).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await inputs.nth(index).fill(code[index]);
}

async function signIn(page, baseUrl, email, { rejectOtpOnce = false } = {}) {
  await openLogin(page, baseUrl);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();

  const otp = await readLatestOtp(email);
  if (rejectOtpOnce) {
    const invalidOtp = otp === '123456' ? '654321' : '123456';
    await enterOtp(page, invalidOtp);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/Invalid OTP code/)).toBeVisible();
  }

  await enterOtp(page, otp);
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login(?:$|\?)/, { timeout: 20_000 });
}

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
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 20_000 });
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
