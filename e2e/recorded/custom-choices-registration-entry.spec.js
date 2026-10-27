const { test, expect } = require('@playwright/test');

const patientUrl = (process.env.E2E_PATIENT_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');

test('Codegen: open patient registration form for custom-choice testing', async ({ page }) => {
  await page.goto(`${patientUrl}/auth/login`);

  // Keep this short, stable Codegen-style recording as a deployment smoke test.
  // It verifies entry to registration and deliberately does not create an account.
  await page.getByRole('button', { name: 'Open login panel' }).click();
  await page.getByRole('button', { name: 'Register' }).click();

  const registrationForm = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Create Account', exact: true }),
  });

  await expect(registrationForm.getByPlaceholder('your.email@tip.edu.ph')).toBeVisible();
  await expect(registrationForm.getByPlaceholder('At least 8 characters')).toBeVisible();
  await expect(registrationForm.getByLabel('Confirm Password')).toBeVisible();
  await expect(registrationForm.getByRole('button', { name: 'Create Account', exact: true })).toBeVisible();
});
