const { test, expect } = require('@playwright/test');

const requiredSettings = [
  ['E2E_STAFF_URL', 'Staff portal URL'],
  ['E2E_REVIEW_STAFF_EMAIL', 'Review QA staff email'],
  ['E2E_REVIEW_STAFF_PASSWORD', 'Review QA staff password'],
  ['E2E_TEST_OTP', 'Test OTP'],
  ['E2E_REVIEW_PATIENT_NAME', 'Pending QA patient name'],
];

test('staff can open a pending patient record for read-only review', async ({ page }) => {
  for (const [key, label] of requiredSettings) {
    expect(process.env[key]?.trim(), `Set ${key} (${label}) in .env.e2e`).toBeTruthy();
  }

  const staffUrl = process.env.E2E_STAFF_URL.replace(/\/+$/, '');
  const email = process.env.E2E_REVIEW_STAFF_EMAIL.trim();
  const password = process.env.E2E_REVIEW_STAFF_PASSWORD;
  const otp = process.env.E2E_TEST_OTP.trim();
  const patientName = process.env.E2E_REVIEW_PATIENT_NAME.trim();
  expect(otp, 'E2E_TEST_OTP must contain exactly six digits').toMatch(/^\d{6}$/);

  await page.goto(`${staffUrl}/auth/login`);
  const openLogin = page.getByRole('button', { name: 'Open login panel' });
  await expect(openLogin).toBeVisible();
  await openLogin.click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  const otpInputs = page.locator('input[inputmode="numeric"][maxlength="1"]');
  await expect(otpInputs).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await otpInputs.nth(index).fill(otp[index]);
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/login(?:$|\?)/, { timeout: 20_000 });

  const pendingLink = page.getByRole('link', { name: /Pending Requests/ });
  await expect(pendingLink).toBeVisible();
  await pendingLink.click();
  await expect(page.getByRole('heading', { name: /Initial Record Submissions/ })).toBeVisible();

  const patientCell = page.getByText(patientName, { exact: true });
  const patientRows = page.getByRole('row').filter({ has: patientCell });
  await expect.poll(() => patientRows.count(), {
    message: `Expected exactly one pending initial record for "${patientName}"`,
    timeout: 20_000,
  }).toBe(1);
  const patientRow = patientRows.first();
  await expect(patientRow.getByRole('cell').nth(3)).toHaveText('Pending');
  await patientRow.click();

  await page.getByRole('button', { name: 'Review Full Record', exact: true }).click();
  await expect(page.getByText('Personal Information', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Medical History', { exact: true })).toBeVisible();
  await expect(page.getByText(patientName, { exact: false }).first()).toBeVisible();
});
