const { test, expect } = require('@playwright/test');
const { latestMessageId, readLatestMailValue, signIn } = require('../core/auth');
require('../core/sanitized-artifacts');

const patientUrl = process.env.E2E_PATIENT_URL;
const staffUrl = process.env.E2E_STAFF_URL;
const patientEmail = process.env.E2E_U2_PATIENT_EMAIL;
const staffEmail = process.env.E2E_STAFF_EMAIL;
const restrictedEmail = process.env.E2E_RESTRICTED_STAFF_EMAIL;
const staffAppointment = '/appointment/medical';
const patientAppointment = '/appointment/patient';
const prescription = '/medical-inventory/prescription/medical';
const staffMedicineRequests = '/medical-inventory/medicine-request/medical';
const consultation = '/consultation';

test.setTimeout(120_000);
test.use({ actionTimeout: 15_000, timezoneId: 'UTC' });

function session(page, baseUrl, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  return {
    async graphql(path, query, variables = {}) {
      const response = await page.request.post(baseUrl + path, { headers, data: { query, variables } });
      return { status: response.status(), ...await response.json() };
    },
    async enableAppointmentEmail() {
      const response = await page.request.patch(baseUrl + '/settings', {
        headers,
        data: { notification: { moduleChannels: { appointments: { web: true, email: true } } } },
      });
      expect(response.status()).toBe(200);
    },
  };
}

function expectData(result) {
  expect(result.errors).toBeUndefined();
  expect(result.status).toBe(200);
  return result.data;
}

function expectError(result, status, field, message) {
  expect(result.status).toBe(status);
  expect(result.errors).toEqual([
    expect.objectContaining({ message, path: [field] }),
  ]);
  expect(result.data?.[field] ?? null).toBeNull();
}

async function book(page, purpose, sessionName) {
  await page.getByRole('button', { name: /U2 Clinic Visit/ }).click();
  await page.getByText('Open', { exact: true }).first().click();
  await page.getByText(sessionName, { exact: true }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByPlaceholder(/Briefly describe the reason/).fill(purpose);
  await page.getByRole('button', { name: 'Submit Appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Your Current Appointment' })).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
  await expect(page.getByText(purpose, { exact: true })).toBeVisible();
}

test('appointment cancellation, rebooking, staff completion and patient notifications', async ({ page: patient, browser }) => {
  const purpose = 'U2 rescheduled clinic visit';
  const staff = await browser.newPage();

  try {
    const patientAuth = await signIn(patient, patientUrl, patientEmail);
    const patientApi = session(patient, patientUrl, patientAuth.accessToken);
    await patientApi.enableAppointmentEmail();
    const getAppointment = async () => expectData(await patientApi.graphql(
      patientAppointment, '{ getAppointmentStatus { id status session purpose scheduledDate } }',
    )).getAppointmentStatus;

    const appointment = await test.step('Patient books, cancels and rebooks for the afternoon', async () => {
      await patient.goto(`${patientUrl}/appointments`);
      await book(patient, 'U2 original clinic visit', 'Morning');
      const original = await getAppointment();
      expect(original).toMatchObject({ status: 'Pending', session: 'Morning' });

      await patient.getByRole('button', { name: 'Cancel Appointment', exact: true }).click();
      await patient.getByRole('button', { name: 'Yes, Cancel', exact: true }).click();
      await expect(patient.getByText('Appointment cancelled.', { exact: true })).toBeVisible();
      expect(await getAppointment()).toMatchObject({ id: original.id, status: 'CancelledByPatient' });

      await book(patient, purpose, 'Afternoon');
      const replacement = await getAppointment();
      expect(replacement).toMatchObject({ status: 'Pending', session: 'Afternoon', purpose });
      expect(replacement.id).not.toBe(original.id);
      return replacement;
    });

    const staffAuth = await signIn(staff, staffUrl, staffEmail);
    const staffApi = session(staff, staffUrl, staffAuth.accessToken);
    await test.step('Manila staff cannot open the Quezon City appointment queue', async () => {
      expectError(await staffApi.graphql(staffAppointment, `{
        searchAppointmentStatuses(status: Pending, location: QuezonCity) { id }
      }`), 401, 'searchAppointmentStatuses', 'Unauthorized');
    });

    await test.step('Staff approves and the open patient page updates through Socket.IO', async () => {
      await staff.goto(`${staffUrl}/appointments`);
      await staff.getByTitle(purpose, { exact: true }).click();
      await expect(staff.getByRole('heading', { name: `Appointment #${appointment.id}` })).toBeVisible();
      const previous = await latestMessageId(patientEmail);
      await staff.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(staff.getByText('Appointment confirmed.', { exact: true })).toBeVisible();
      await expect(patient.getByText('Scheduled', { exact: true })).toBeVisible();
      await readLatestMailValue(patientEmail, previous, /Your appointment request has been Scheduled\./i);
    });

    await test.step('Staff records attendance and completes the appointment', async () => {
      await staff.getByRole('button', { name: /^Scheduled\b/ }).click();
      await staff.getByTitle(purpose, { exact: true }).click();
      await staff.getByRole('button', { name: 'Record Attendance', exact: true }).click();
      await expect(staff.getByText('Attendance recorded.', { exact: true })).toBeVisible();
      await expect(patient.getByText('InProgress', { exact: true })).toBeVisible();

      await staff.getByRole('button', { name: /^In Progress\b/ }).click();
      await staff.getByTitle(purpose, { exact: true }).click();
      await staff.getByRole('button', { name: 'Mark Complete', exact: true }).click();
      await expect(staff.getByText('Appointment marked as completed.', { exact: true })).toBeVisible();
      await expect(patient.getByRole('button', { name: /U2 Clinic Visit/ })).toBeVisible();
      await patient.reload();
      expect(await getAppointment()).toMatchObject({ id: appointment.id, status: 'Completed', purpose });
    });
  } finally {
    await staff.close();
  }
});

test('staff dispenses an approved medicine request after denied and invalid actions leave stock intact', async ({ page: patient, browser }) => {
  const purpose = 'U2 medicine pickup';
  const staff = await browser.newPage();
  const restricted = await browser.newPage();
  const patientRow = patient.getByRole('row').filter({ hasText: purpose });
  const staffRow = staff.getByRole('row').filter({ hasText: purpose });

  try {
    const patientAuth = await signIn(patient, patientUrl, patientEmail);
    const patientApi = session(patient, patientUrl, patientAuth.accessToken);
    const staffAuth = await signIn(staff, staffUrl, staffEmail);
    const staffApi = session(staff, staffUrl, staffAuth.accessToken);
    const restrictedAuth = await signIn(restricted, staffUrl, restrictedEmail);
    const restrictedApi = session(restricted, staffUrl, restrictedAuth.accessToken);

    const requestId = await test.step('Patient submits a request for the Arlegui clinic', async () => {
      await patient.goto(`${patientUrl}/medicine-request`);
      await patient.getByPlaceholder(/Headache, Fever/).fill(purpose);
      await patient.getByRole('radio', { name: 'Arlegui' }).check();
      await patient.getByRole('checkbox', { name: 'U2 Medicine', exact: true }).check();
      await patient.getByRole('button', { name: 'Submit Medicine Request' }).click();
      await expect(patientRow.getByText('Pending', { exact: true })).toBeVisible();
      const { getMedicineStatus } = expectData(await patientApi.graphql(
        '/medical-inventory/medicine-request/patient', '{ getMedicineStatus { id status purpose location } }',
      ));
      const request = getMedicineStatus.find(record => record.purpose === purpose);
      expect(request).toMatchObject({ location: 'Arlegui', status: 'Pending' });
      return request.id;
    });

    const inventory = '/medical-inventory/medical';
    const { getMedicalItems } = expectData(await staffApi.graphql(inventory, `{
      getMedicalItems(category: Medicine, active: true) { id item_code }
    }`));
    const medicineId = Number(getMedicalItems.find(item => item.item_code === 'U2-MED').id);
    const getStock = async () => {
      const { getMedicalSupply } = expectData(await staffApi.graphql(inventory, `query ($id: Int!) {
        getMedicalSupply(medicalItemId: $id, location: Arlegui, availableOnly: true) { id batchNumber availableQuantity }
      }`, { id: medicineId }));
      return getMedicalSupply.find(batch => batch.batchNumber === 'U2-MED-BATCH');
    };

    await test.step('Restrict approval and reject invalid dispensing without consuming stock', async () => {
      expectError(await staffApi.graphql(staffMedicineRequests, `{
        getAllMedicineRequests(location: QuezonCity) { id }
      }`), 401, 'getAllMedicineRequests', 'Unauthorized');
      const approved = 'mutation ($id: ID!) { setStatusMedicineRequest(requestId: $id, status: Approved) { id } }';
      expectError(await restrictedApi.graphql(staffMedicineRequests, approved, { id: requestId }),
        401, 'setStatusMedicineRequest', 'Unauthorized');
      await patient.reload();
      await expect(patientRow.getByText('Pending', { exact: true })).toBeVisible();

      const stock = await getStock();
      expect(stock).toMatchObject({ availableQuantity: 5 });
      const dispense = 'mutation ($input: IssuePrescriptionInput!) { issuePrescription(input: $input) { id } }';
      const issue = quantity => staffApi.graphql(prescription, dispense, {
        input: { patientId: Number(patientAuth.userId), requestId, items: [{ batchId: Number(stock.id), quantity }] },
      });
      expectError(await issue(6), 400, 'issuePrescription', 'Only 5 units available, requested 6');
      expectError(await issue(1), 400, 'issuePrescription', 'Only approved medicine requests can be dispensed');
      expect(await getStock()).toEqual(stock);
    });

    await test.step('Staff approves, patient sees the live status, and staff dispenses two units', async () => {
      await staff.goto(`${staffUrl}/inventory`);
      await staff.getByRole('button', { name: /^Dispense Queue/ }).click();
      await staff.getByRole('button', { name: 'Arlegui', exact: true }).click();
      await staffRow.getByRole('button', { name: 'Approve', exact: true }).click();
      const approval = staff.getByRole('heading', { name: 'Approve Request' }).locator('xpath=../..');
      await approval.getByRole('spinbutton').fill('2');
      await approval.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(staffRow.getByText('Approved', { exact: true })).toBeVisible();
      await expect(patientRow.getByText('Approved', { exact: true })).toBeVisible();
      await staffRow.getByRole('button', { name: 'Dispense', exact: true }).click();
      await expect(staff.getByRole('heading', { name: 'Dispense Medicine' })).toBeVisible();
      await expect(staff.getByRole('spinbutton')).toHaveValue('2');
      await staff.getByRole('button', { name: 'Complete', exact: true }).click();
      await expect(staffRow.getByRole('cell', { name: 'Completed', exact: true }).first()).toBeVisible();
      await expect(patientRow.getByText('Completed', { exact: true })).toBeVisible();

      const stock = await getStock();
      expect(stock).toMatchObject({ availableQuantity: 3 });
      await patient.reload();
      await expect(patientRow.getByText('Completed', { exact: true })).toBeVisible();
      const { getMyPrescriptions } = expectData(await patientApi.graphql(
        '/medical-inventory/prescription/patient',
        '{ getMyPrescriptions { id action quantity items { id batchId transactionId } } }',
      ));
      expect(getMyPrescriptions).toHaveLength(1);
      const [transaction] = getMyPrescriptions;
      expect(transaction).toMatchObject({ action: 'Issue', quantity: 2 });
      expect(transaction.items).toHaveLength(2);
      expect(new Set(transaction.items.map(item => item.id)).size).toBe(2);
      for (const item of transaction.items) {
        expect(item).toMatchObject({ batchId: Number(stock.id), transactionId: Number(transaction.id) });
      }
    });
  } finally {
    await Promise.all([staff.close(), restricted.close()]);
  }
});

test('consultation API validates transitions and persists a completed encounter and its outcome', async ({ page: staff, browser }) => {
  const patient = await browser.newPage();
  const restricted = await browser.newPage();
  try {
    const patientAuth = await signIn(patient, patientUrl, patientEmail);
    const staffAuth = await signIn(staff, staffUrl, staffEmail);
    const restrictedAuth = await signIn(restricted, staffUrl, restrictedEmail);
    const staffApi = session(staff, staffUrl, staffAuth.accessToken);
    const restrictedApi = session(restricted, staffUrl, restrictedAuth.accessToken);
    const patientId = String(patientAuth.userId);
    const create = `mutation ($input: ConsultationInput!) {
      createConsultation(input: $input) { id patientId status notes }
    }`;
    const variables = { input: { patientId, mode: 'Onsite', type: 'Medical', notes: 'U2 encounter' } };
    expectError(await restrictedApi.graphql(consultation, create, variables),
      403, 'createConsultation', 'Not permitted to modify medical data');

    const { createConsultation } = expectData(await staffApi.graphql(consultation, create, variables));
    expect(createConsultation).toMatchObject({ patientId, status: 'Created', notes: 'U2 encounter' });
    const id = createConsultation.id;
    const submit = 'mutation ($id: ID!) { submitConsultation(consultationId: $id, status: Completed) }';
    expectError(await staffApi.graphql(consultation, submit, { id }),
      400, 'submitConsultation', 'Consultation cannot be submitted in its current status');

    const open = `mutation ($input: ConsultationOutcomeInput!) {
      openConsultation(input: $input) { id consultationId recordedBy remarks }
    }`;
    const input = {
      consultationId: id, remarks: 'U2 outcome', complaints: ['Synthetic complaint'],
      peFindings: [], treatments: [], diagnoses: [],
    };
    const { openConsultation } = expectData(await staffApi.graphql(consultation, open, { input }));
    expect(openConsultation).toMatchObject({
      consultationId: id, recordedBy: String(staffAuth.userId), remarks: input.remarks,
    });
    expectError(await restrictedApi.graphql(consultation, submit, { id }),
      403, 'submitConsultation', 'Not permitted to modify medical data');
    expect(expectData(await staffApi.graphql(consultation, submit, { id })).submitConsultation).toBe(true);
    expectError(await staffApi.graphql(consultation, submit, { id }),
      400, 'submitConsultation', 'Consultation cannot be submitted in its current status');

    const persisted = expectData(await staffApi.graphql(consultation, `query ($patient: ID!, $id: ID!) {
      getConsultations(patientId: $patient) { id status notes }
      getOutcomes(consultationId: $id) { id remarks complaints { complaint } }
    }`, { patient: patientId, id }));
    expect(persisted.getConsultations).toEqual([{ id, status: 'Completed', notes: 'U2 encounter' }]);
    expect(persisted.getOutcomes).toEqual([{
      id: openConsultation.id, remarks: input.remarks, complaints: [{ complaint: input.complaints[0] }],
    }]);
  } finally {
    await Promise.all([patient.close(), restricted.close()]);
  }
});
