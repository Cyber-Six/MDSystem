const { test, expect } = require('@playwright/test');
const { signIn } = require('../core/auth');
require('../core/sanitized-artifacts');

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

async function expectStock(page, quantity) {
  await page.getByRole('button', { name: 'Medical Items', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'E2E Medicine' }).getByText('E2E Medicine', { exact: true }).click();
  const total = page.getByText('Total Stock', { exact: true }).locator('..');
  await expect(total.getByText(String(quantity), { exact: true })).toBeVisible();
}

test('patient requests medicine, staff dispenses it, and stock and status persist', async ({ page: patient, browser }) => {
  const patientUrl = process.env.E2E_PATIENT_URL;
  const staffUrl = process.env.E2E_STAFF_URL;
  const purpose = 'E2E medicine fulfillment';
  const staff = await browser.newPage();
  const patientRequest = patient.getByRole('row').filter({ hasText: purpose });
  const staffRequest = staff.getByRole('row').filter({ hasText: purpose });

  try {
    await test.step('Patient submits a request for the seeded medicine', async () => {
      await signIn(patient, patientUrl, process.env.E2E_PATIENT_EMAIL);
      await patient.goto(`${patientUrl}/medicine-request`);
      await patient.getByPlaceholder(/Headache, Fever/).fill(purpose);
      await patient.getByRole('radio', { name: 'Arlegui' }).check();
      await patient.getByRole('checkbox', { name: 'E2E Medicine', exact: true }).check();
      await patient.getByRole('button', { name: 'Submit Medicine Request' }).click();
      await expect(patientRequest.getByText('Pending', { exact: true })).toBeVisible();
    });

    await test.step('Branch staff verifies stock, reviews the request, and dispenses two units', async () => {
      await signIn(staff, staffUrl, process.env.E2E_STAFF_EMAIL);
      await staff.goto(`${staffUrl}/inventory`);
      await expectStock(staff, 5);
      await staff.getByRole('button', { name: /^Dispense Queue/ }).click();
      await staff.getByRole('button', { name: 'Arlegui', exact: true }).click();
      await expect(staffRequest.getByText('E2E Medicine', { exact: true })).toBeVisible();
      await staffRequest.getByRole('button', { name: 'Approve', exact: true }).click();
      const approval = staff.getByRole('heading', { name: 'Approve Request' }).locator('xpath=../..');
      await approval.getByRole('spinbutton').fill('2');
      await approval.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(staffRequest.getByText('Approved', { exact: true })).toBeVisible();
      await staffRequest.getByRole('button', { name: 'Dispense', exact: true }).click();
      await expect(staff.getByRole('heading', { name: 'Dispense Medicine' })).toBeVisible();
      await expect(staff.getByRole('spinbutton')).toHaveValue('2');
      await staff.getByRole('button', { name: 'Complete', exact: true }).click();
      await expect(staffRequest.getByRole('cell', { name: 'Completed', exact: true }).first()).toBeVisible();
    });

    await test.step('Fresh pages show three units remaining and the completed request', async () => {
      await staff.reload();
      await expectStock(staff, 3);
      await patient.reload();
      await expect(patientRequest.getByText('Completed', { exact: true })).toBeVisible();
    });
  } finally {
    await staff.close();
  }
});
