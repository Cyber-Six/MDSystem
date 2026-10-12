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

async function latestMessageId(email) {
  const url = `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`SMTP capture search failed (${response.status}).`);
  const result = await response.json();
  return result.messages?.[0]?.ID || null;
}

async function readLatestOtp(email, previousMessageId) {
  let otp;
  await expect.poll(async () => {
    const messageId = await latestMessageId(email);
    if (!messageId || messageId === previousMessageId) return false;
    // Read this specific message so polling and retrieval cannot select
    // different emails, or reuse an OTP from an earlier login.
    const response = await fetch(`${mailpitUrl}/view/${encodeURIComponent(messageId)}.txt`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    otp = body.match(/\b\d{6}\b/)?.[0];
    return Boolean(otp);
  }, {
    message: 'Wait for a new OTP email from the current login',
    timeout: 20_000,
    intervals: [200, 400, 800, 1200],
  }).toBe(true);
  return otp;
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
  const previousMessageId = await latestMessageId(email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();

  const otp = await readLatestOtp(email, previousMessageId);
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
