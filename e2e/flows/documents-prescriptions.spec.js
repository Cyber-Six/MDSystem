const { readFile } = require('node:fs/promises');
const { test, expect } = require('@playwright/test');
const { signIn } = require('../core/auth');
require('../core/sanitized-artifacts');

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000, timezoneId: 'UTC', acceptDownloads: true });

const matchesResponse = (pathname, method) => response =>
  new URL(response.url()).pathname === pathname && response.request().method() === method;

test('staff records a consultation and issues a prescription the patient can download', async ({ page: patient, browser }) => {
  const patientUrl = process.env.E2E_PATIENT_URL;
  const staffUrl = process.env.E2E_STAFF_URL;
  const notes = 'E2E consultation for prescription issuance';
  const staff = await browser.newPage();

  try {
    const { userId } = await signIn(patient, patientUrl, process.env.E2E_PATIENT_EMAIL);

    await test.step('Staff saves a consultation and opens it from history', async () => {
      await signIn(staff, staffUrl, process.env.E2E_STAFF_EMAIL);
      await staff.goto(`${staffUrl}/patient/${userId}`);
      await staff.getByRole('tab', { name: 'Consultation', exact: true }).click();
      await staff.getByRole('button', { name: 'New Consultation', exact: true }).click();
      await staff.getByPlaceholder(/Type ICD code/).fill('CA40');
      await staff.getByRole('button', { name: 'CA40 Pneumonia', exact: true }).click();
      await staff.getByPlaceholder('Main reason for consultation').fill('Cough');
      await staff.getByPlaceholder('Consultation notes').fill(notes);
      await staff.getByRole('button', { name: 'Save Consultation', exact: true }).click();
      await expect(staff.getByText(/Consultation saved/)).toBeVisible();

      await staff.reload();
      await staff.getByRole('tab', { name: 'Consultation', exact: true }).click();
      await staff.getByRole('button', { name: 'History', exact: true }).click();
      const consultation = staff.getByRole('article').filter({ hasText: notes });
      await expect(consultation.getByText('Completed', { exact: true })).toBeVisible();
      await consultation.click();
      await expect(staff.getByRole('heading', { name: 'Consultation Details' })).toBeVisible();
    });

    const documentId = await test.step('Staff generates the prescription PDF', async () => {
      await staff.getByRole('button', { name: 'Generate Prescription', exact: true }).click();
      await staff.getByPlaceholder('Medication name *', { exact: true }).fill('E2E Medicine');
      await staff.getByPlaceholder('Dosage (e.g. 500mg)').fill('100 mg');
      const [response] = await Promise.all([
        staff.waitForResponse(matchesResponse('/documents/prescription/generate', 'POST')),
        staff.getByRole('button', { name: 'Generate Prescription', exact: true }).last().click(),
      ]);
      expect(response.ok(), 'Prescription generation should succeed').toBe(true);
      const issued = await response.json();
      expect(issued.success).toBe(true);
      expect(Number(issued.documentId)).toBeGreaterThan(0);
      await expect(staff.getByText('Prescription Generated', { exact: true })).toBeVisible();
      return issued.documentId;
    });

    await test.step('Patient sees the issued prescription and downloads its PDF', async () => {
      const [listing] = await Promise.all([
        patient.waitForResponse(matchesResponse('/documents/my', 'GET')),
        patient.goto(`${patientUrl}/my-documents`),
      ]);
      expect(listing.ok(), 'Patient document listing should succeed').toBe(true);
      const { documents } = await listing.json();
      expect(documents).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: documentId, templateType: 'prescription' }),
      ]));
      await expect(patient.getByRole('heading', { name: 'Issued Documents' })).toBeVisible();
      await expect(patient.getByText('Prescription', { exact: true })).toBeVisible();
      const [response, download] = await Promise.all([
        patient.waitForResponse(matchesResponse(`/documents/prescription/download/${documentId}`, 'GET')),
        patient.waitForEvent('download'),
        patient.getByRole('button', { name: 'Download', exact: true }).click(),
      ]);
      expect(response.ok(), 'Patient PDF download should succeed').toBe(true);
      expect(response.headers()['content-type']).toMatch(/^application\/pdf\b/i);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      const pdf = await readFile(await download.path());
      expect(pdf.length).toBeGreaterThan(100);
      expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-');
      expect(pdf.subarray(-32).toString('ascii').trimEnd()).toMatch(/%%EOF$/);
    });
  } finally {
    await staff.close();
  }
});
