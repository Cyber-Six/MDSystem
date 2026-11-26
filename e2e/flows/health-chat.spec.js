const { test, expect } = require('@playwright/test');
const { signIn } = require('../core/auth');
require('../core/sanitized-artifacts');

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

test('patient opens a health chat, staff accepts and replies, and patient sees it close', async ({ page: patient, browser }) => {
  const patientUrl = process.env.E2E_PATIENT_URL;
  const staffUrl = process.env.E2E_STAFF_URL;
  const patientEmail = process.env.E2E_ALT_PATIENT_EMAIL;
  const question = 'I have a question about clinic hours.';
  const followUp = 'Do I need an appointment?';
  const reply = 'The clinic can help you during regular office hours.';
  const staff = await browser.newPage();

  try {
    await test.step('Patient opens a Health Chat request', async () => {
      await signIn(patient, patientUrl, patientEmail);
      await patient.goto(`${patientUrl}/health-chat`);
      await patient.getByRole('button', { name: 'Start Health Chat' }).click();
      await patient.getByPlaceholder(/I've had a headache/).fill(question);
      await patient.getByRole('button', { name: /Send Request/ }).click();
      await expect(patient.getByText('Waiting for Staff Approval', { exact: true })).toBeVisible();
    });

    await test.step('Staff accepts and the patient receives the approval notification', async () => {
      await signIn(staff, staffUrl, process.env.E2E_STAFF_EMAIL);
      await staff.goto(`${staffUrl}/health-chat`);
      await staff.getByPlaceholder(/Search by name, email/).fill(patientEmail);
      await staff.getByText('E2E Patient', { exact: true }).click();
      await staff.getByRole('button', { name: 'Accept Conversation' }).click();

      await expect(patient.getByText('Chat Active', { exact: true })).toBeVisible();
      const notifications = patient.getByRole('button', { name: 'Notifications', exact: true });
      await notifications.click();
      await expect(patient.getByText('Health Chat Approved', { exact: true })).toBeVisible();
      await notifications.click();
    });

    await test.step('Both participants receive messages in the open chat', async () => {
      const patientInput = patient.getByPlaceholder('Type a message…', { exact: true });
      await patientInput.fill(followUp);
      await patient.getByTitle('Send message', { exact: true }).click();
      const messageBubble = staff.getByText(followUp, { exact: true }).and(staff.locator('div'));
      await expect(messageBubble).toBeVisible();

      const staffInput = staff.getByPlaceholder(/^Type a message/);
      await staffInput.fill(reply);
      await staffInput.press('Enter');
      await expect(patient.getByText(reply, { exact: true })).toBeVisible();
    });

    await test.step('Staff closes the chat and the patient sees the archived conversation', async () => {
      await staff.getByRole('button', { name: 'Close Ticket', exact: true }).click();
      await expect(staff.getByRole('heading', { name: 'Close Ticket', exact: true })).toBeVisible();
      await staff.getByRole('button', { name: 'Close Ticket', exact: true }).last().click();

      const newConsultation = patient.getByRole('button', { name: 'New Consultation' });
      await expect(newConsultation).toBeVisible();
      await expect(patient.getByText('Previous conversation', { exact: true })).toBeVisible();
      await patient.getByRole('button', { name: 'Notifications', exact: true }).click();
      await expect(patient.getByText('Chat Session Closed', { exact: true })).toBeVisible();

      await patient.reload();
      await expect(newConsultation).toBeVisible();
      await expect(patient.getByText(reply, { exact: true })).toBeVisible();
      await expect(patient.getByPlaceholder('Type a message…', { exact: true })).toHaveCount(0);
    });
  } finally {
    await staff.close();
  }
});
