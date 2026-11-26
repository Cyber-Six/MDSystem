const { test, expect } = require('@playwright/test');
const { signIn } = require('../core/auth');
require('../core/sanitized-artifacts');

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000, timezoneId: 'UTC' });

test('patient books, staff approves and records attendance, patient sees the status', async ({ page: patient, browser }) => {
  const patientUrl = process.env.E2E_PATIENT_URL;
  const staffUrl = process.env.E2E_STAFF_URL;
  const purpose = 'E2E appointment attendance';
  const staff = await browser.newPage();

  try {
    await test.step('Patient submits a morning appointment', async () => {
      await signIn(patient, patientUrl, process.env.E2E_ALT_PATIENT_EMAIL);
      await patient.goto(`${patientUrl}/appointments`);
      await patient.getByRole('button', { name: /E2E Appointment/ }).click();
      await patient.getByText('Open', { exact: true }).first().click();
      await patient.getByText('Morning', { exact: true }).click();
      await patient.getByRole('button', { name: /^Next/ }).click();
      await patient.getByPlaceholder(/Briefly describe the reason/).fill(purpose);
      await patient.getByRole('button', { name: 'Submit Appointment' }).click();
      await expect(patient.getByRole('heading', { name: 'Your Current Appointment' })).toBeVisible();
      await expect(patient.getByText('Pending', { exact: true })).toBeVisible();
    });

    await test.step('Branch staff finds and approves the request', async () => {
      await signIn(staff, staffUrl, process.env.E2E_STAFF_EMAIL);
      await staff.goto(`${staffUrl}/appointments`);
      await expect(staff.getByRole('main').getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
      await staff.getByTitle(purpose, { exact: true }).click();
      await expect(staff.getByRole('heading', { name: /^Appointment #/ })).toBeVisible();
      await staff.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(staff.getByText('Appointment confirmed.', { exact: true })).toBeVisible();
      await patient.reload();
      await expect(patient.getByText('Scheduled', { exact: true })).toBeVisible();
    });

    await test.step('Staff records attendance and the patient sees the persisted status', async () => {
      await staff.getByRole('button', { name: /^Scheduled\b/ }).click();
      await staff.getByTitle(purpose, { exact: true }).click();
      await staff.getByRole('button', { name: 'Record Attendance', exact: true }).click();
      await expect(staff.getByText('Attendance recorded.', { exact: true })).toBeVisible();
      await patient.reload();
      await expect(patient.getByText('InProgress', { exact: true })).toBeVisible();
      await expect(patient.getByText(purpose, { exact: true })).toBeVisible();
    });
  } finally {
    await staff.close();
  }
});
