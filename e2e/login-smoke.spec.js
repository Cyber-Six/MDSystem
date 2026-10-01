const { test, expect } = require('@playwright/test');

const portals = [
  { name: 'patient', url: 'http://127.0.0.1:4173/auth/login', title: 'Patient Portal' },
  { name: 'staff', url: 'http://127.0.0.1:4174/auth/login', title: 'Staff Portal' },
];

for (const portal of portals) {
  test(`${portal.name} portal renders and handles an invalid login`, async ({ page }) => {
    // Keep the smoke test isolated from Google services and real backend accounts.
    await page.route('https://www.google.com/**', route => route.abort());
    await page.route('https://accounts.google.com/**', route => route.abort());
    await page.route('**/auth/login', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'gui-smoke@example.invalid',
        password: 'incorrect-test-password',
      });
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }),
      });
    });

    await page.goto(portal.url);
    await expect(page.getByRole('button', { name: 'Open login panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Open login panel' }).click();
    await expect(page.getByRole('heading', { name: portal.title })).toBeVisible();

    await page.getByLabel('Email address').fill('gui-smoke@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('incorrect-test-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveValue('gui-smoke@example.invalid');
  });
}
