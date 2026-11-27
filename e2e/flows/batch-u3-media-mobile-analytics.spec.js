const { test, expect } = require('@playwright/test');
const { latestMessageId, readLatestOtp } = require('../core/auth');

const patientUrl = process.env.E2E_PATIENT_URL;
const staffUrl = process.env.E2E_STAFF_URL;
const patientEmail = `muclinicthree${process.env.E2E_PATIENT_EMAIL}`;
const otherPatientEmail = `quclinicthree${process.env.E2E_ALT_PATIENT_EMAIL}`;
const staffEmail = process.env.E2E_STAFF_EMAIL;
const restrictedEmail = process.env.E2E_RESTRICTED_STAFF_EMAIL;
const emr = '/emr/patient';
const appointments = '/appointment/patient';
const inventory = '/medical-inventory/medical';
const audit = '/rolemanagement/admin';
const dateRange = { startDate: '2020-01-01', endDate: '2099-01-01' };
const metric = 'inventory-report-summary';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aL8AAAAASUVORK5CYII=',
  'base64',
);
const pdf = Buffer.from('%PDF-1.4\n% Synthetic U3 attachment\n%%EOF\n');

test.setTimeout(120_000);

function api(request, baseUrl, forwardHost, token) {
  const headers = { 'X-Forwarded-Host': forwardHost };
  if (token) headers.Authorization = `Bearer ${token}`;
  const send = (path, { data, ...options } = {}) => request.fetch(baseUrl + path, {
    ...options,
    headers: data === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    data,
  });
  return {
    send,
    post: (path, data) => send(path, { method: 'POST', data }),
    graphql: (path, query, variables = {}) => send(path, { method: 'POST', data: { query, variables } }),
  };
}

async function json(response, status = 200) {
  expect(response.status(), `${response.url()} HTTP status`).toBe(status);
  return response.json();
}

async function graph(response) {
  const body = await json(response);
  expect(body.errors).toBeUndefined();
  return body.data;
}

async function graphDenied(response, status, field, message) {
  const body = await json(response, status);
  expect(body.errors).toEqual([expect.objectContaining({ path: [field], message })]);
  expect(body.data?.[field] ?? null).toBeNull();
}

async function denied(response, status, error) {
  expect(await json(response, status)).toMatchObject({ error });
}

async function login(request, email, { medical = false, verifyGate = false } = {}) {
  const baseUrl = medical ? staffUrl : patientUrl;
  const forwardHost = medical ? 'staff.mdsystemtip.space' : new URL(baseUrl).hostname;
  const client = api(request, baseUrl, forwardHost);
  const { LoginKey, ok, requires2FA } = await json(await client.post('/auth/login', {
    email, password: process.env.E2E_ACCOUNT_PASSWORD,
  }));
  expect(ok).toBe(true);
  expect(requires2FA).toBe(true);
  expect(typeof LoginKey).toBe('string');
  if (verifyGate) {
    await denied(await client.post('/auth/login/complete', { LoginKey }), 400, '2FA_NOT_VERIFIED');
  }
  const previous = await latestMessageId(email);
  expect(await json(await client.post('/auth/email/2fa', { email }))).toMatchObject({ ok: true });
  const otp = await readLatestOtp(email, previous);
  const verified = await json(await client.post('/auth/email/2fa/verify', { email, otp, verificationKey: LoginKey }));
  expect(verified.ok).toBe(true);
  const completed = await json(await client.post('/auth/login/complete', { LoginKey: verified.verificationKey }));
  expect(completed.ok && typeof completed.accessToken === 'string' && typeof completed.refreshToken === 'string').toBe(true);
  const claims = JSON.parse(Buffer.from(completed.accessToken.split('.')[1], 'base64url'));
  expect(claims.role).toBe(medical ? 'medical' : 'patient');
  return { ...api(request, baseUrl, forwardHost, completed.accessToken), id: String(claims.id), token: completed.accessToken };
}

async function stage(client, buffer, name, mimeType) {
  return client.send('/media/stage/', {
    method: 'POST', multipart: { file: { name, mimeType, buffer } },
  });
}

function recordPath(category, id) {
  return `/media/record/${category}/${id}`;
}

async function expectMedia(client, path, bytes, type) {
  const response = await client.send(path);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain(type);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect((await response.body()).equals(bytes)).toBe(true);
}

test('private staged uploads, dental photos, and medical attachments are scoped to their owner and authorized staff', async ({ request }) => {
  const patient = await login(request, patientEmail);
  const other = await login(request, otherPatientEmail);
  const staff = await login(request, staffEmail, { medical: true });
  const otherBranch = await login(request, `u3.${restrictedEmail}`, { medical: true });
  const anonymous = api(request, patientUrl, new URL(patientUrl).hostname);
  await denied(await stage(anonymous, png, 'dental.png', 'image/png'), 401, 'TOKEN_REQUIRED');
  await denied(await stage(patient, Buffer.from('invalid'), 'dental.png', 'image/png'), 400, 'INVALID_FILE_TYPE');

  const { fileId: upper } = await json(await stage(patient, png, 'upper.png', 'image/png'));
  const { fileId: lower } = await json(await stage(patient, png, 'lower.png', 'image/png'));
  const { fileId: unused } = await json(await stage(patient, png, 'unused.png', 'image/png'));
  const { fileId: spareOne } = await json(await stage(patient, png, 'spare-one.png', 'image/png'));
  const { fileId: spareTwo } = await json(await stage(patient, png, 'spare-two.png', 'image/png'));
  await denied(await stage(patient, png, 'over-limit.png', 'image/png'), 429, 'MAX_FILES_STAGING_EXCEEDED');
  await expectMedia(patient, recordPath('staging', upper), png, 'image/png');
  await denied(await other.send(recordPath('staging', upper)), 404, 'FILE_NOT_FOUND');
  await denied(await other.send(`/media/unstage/${upper}`, { method: 'DELETE' }), 404, 'FILE_NOT_FOUND');
  expect(await json(await patient.send(`/media/unstage/${unused}`, { method: 'DELETE' }))).toEqual({ success: true });
  await denied(await patient.send(recordPath('staging', unused)), 404, 'FILE_NOT_FOUND');
  const { fileId: replacement } = await json(await stage(patient, png, 'replacement.png', 'image/png'));
  for (const id of [spareOne, spareTwo, replacement]) {
    await json(await patient.send(`/media/unstage/${id}`, { method: 'DELETE' }));
  }

  const { createDentalPhotoRecord: photos } = await graph(await patient.graphql(emr, `
    mutation ($input: DentalPhotoRecordInput!) {
      createDentalPhotoRecord(input: $input) { upperTeeth lowerTeeth }
    }`, { input: { upperTeeth: upper, lowerTeeth: lower } }));
  expect(photos.upperTeeth).not.toBe(upper);
  expect(photos.lowerTeeth).not.toBe(lower);
  await denied(await patient.send(recordPath('staging', upper)), 404, 'FILE_NOT_FOUND');

  const { documents } = await json(await staff.send('/documents/required', { params: { patientId: patient.id } }));
  const tag = documents.find(document => document.label === 'U3 Private Medical Attachment');
  expect(tag).toBeDefined();
  await json(await staff.post(`/documents/required/${tag.id}/request`, { patientId: patient.id }));
  const { fileId } = await json(await stage(patient, pdf, 'medical.pdf', 'application/pdf'));
  expect(await json(await patient.post(`/documents/requests/${tag.id}`, { file: fileId }))).toMatchObject({ success: true });
  const reviewed = await json(await staff.send('/documents/required', { params: { patientId: patient.id } }));
  const submission = reviewed.documents.find(document => document.id === tag.id).submission;
  expect(submission).toMatchObject({ status: 'Pending', file: expect.any(String) });

  const { createTicket } = await graph(await patient.graphql('/healthchat/patient', `
    mutation ($input: CreateTicketInput!) { createTicket(input: $input) { success chat { id status } } }
  `, { input: { purpose: 'U3 attachment review' } }));
  expect(createTicket).toMatchObject({ success: true, chat: { status: 'Open' } });
  const { fileId: chatUpload } = await json(await stage(patient, pdf, 'chat.pdf', 'application/pdf'));
  const { sendPatientMessage } = await graph(await patient.graphql('/healthchat/patient', `
    mutation ($input: SendMessageInput!) { sendPatientMessage(input: $input) { success message { filename } } }
  `, { input: { chatId: createTicket.chat.id, filename: chatUpload, promptType: 'file' } }));
  expect(sendPatientMessage.success).toBe(true);

  for (const [path, bytes, type] of [
    [recordPath('dentalPhoto', photos.upperTeeth), png, 'image/png'],
    [recordPath('dentalPhoto', photos.lowerTeeth), png, 'image/png'],
    [recordPath('documents', submission.file), pdf, 'application/pdf'],
    [recordPath('eConsultation', sendPatientMessage.message.filename), pdf, 'application/pdf'],
  ]) {
    await expectMedia(patient, path, bytes, type);
    await expectMedia(staff, path, bytes, type);
    await denied(await anonymous.send(path), 401, 'TOKEN_REQUIRED');
    await denied(await other.send(path), 404, 'FILE_NOT_FOUND');
    await denied(await otherBranch.send(path), 404, 'FILE_NOT_FOUND');
  }
});

test('Expo patient login, revision EMR and appointment requests honor the mobile API contract', async ({ request }) => {
  const anonymous = api(request, patientUrl, new URL(patientUrl).hostname);
  await denied(await anonymous.post('/auth/login', {
    email: patientEmail, password: 'invalid synthetic password',
  }), 400, 'INVALID_CREDENTIALS');
  const patient = await login(request, patientEmail, { verifyGate: true });
  const other = await login(request, otherPatientEmail);
  const profile = `query GetPatientProfileData {
    personalLog: getPersonalRecordLog { id first_name middle_name last_name suffix contactNumber }
    personalRecord: getPersonalRecord { id identifier }
    personalLogStatus: getPersonalRecordLogStatus
    loginEmail: getLoginEmail
  }`;
  await denied(await anonymous.graphql('/profile/patient', profile), 401, 'TOKEN_REQUIRED');
  expect((await graph(await patient.graphql('/profile/patient', profile))).loginEmail).toBe(patientEmail);
  expect((await graph(await other.graphql('/profile/patient', profile))).loginEmail).toBe(otherPatientEmail);
  const record = `query GetRevisionEMRData {
    emrProfile: getProfile { ... on StudentProfile { program year } ... on EmployeeProfile { department role } }
    emergencyContact: getEmergencyContact {
      firstContact { contactName relationship contactNumber address }
      secondContact { contactName relationship contactNumber address }
    }
    medicalHistory: getMedicalHistory { conditions { conditionId relationship } notes }
    allergyProfile: getAllergyProfile { allergies { allergenCatalogId status severity } notes }
    hospitalizationProfile: getHospitalizationProfile { hospitalizations { conditionId admissionDate dischargeDate notes } notes }
    operationProfile: getOperationProfile { operations { procedureId operationDate notes } notes }
    medicationProfile: getMedicationProfile { medications { medicineId description } notes }
    immunizationProfile: getImmunizationProfile { immunizations { vaccineTypeId immunizationDate doseNumber } notes }
    lifestyle: getLifestyle { smoker numberOfCigarettesPerDay yearsSmoked alcoholConsumer frequencyOfAlcoholConsumption vapeUser vapeType vapeFrequency }
    visualAcuity: getVisualAcuityProfile { notes acuity { left_eye right_eye recorded_at } }
    obgyne: getObgynHistory { lastMenstrualPeriod hasDysmenorrhea notes }
  }`;
  await denied(await anonymous.graphql(emr, record), 401, 'TOKEN_REQUIRED');
  expect((await graph(await patient.graphql(emr, record))).medicalHistory).toEqual({
    conditions: [], notes: 'U3 patient medical history',
  });
  expect((await graph(await other.graphql(emr, record))).medicalHistory).toBeNull();

  const status = `query {
    getAppointmentStatus { id status session notes created_at schedulerLabel }
  }`;
  await denied(await anonymous.graphql(appointments, status), 401, 'TOKEN_REQUIRED');
  const list = `query ListOpenAppointments($offset: Int, $limit: Int) {
    listOpenAppointments(offset: $offset, limit: $limit) {
      id label location patientType schedulePerWeek morningAllowed afternoonAllowed notes
      purposeRequired isActive containsCustomDates whitelistOnly
    }
  }`;
  const vars = { offset: 0, limit: 20 };
  const manila = (await graph(await patient.graphql(appointments, list, vars))).listOpenAppointments;
  const quezon = (await graph(await other.graphql(appointments, list, vars))).listOpenAppointments;
  const scheduler = manila.find(entry => entry.label === 'U3 Manila Clinic');
  const otherScheduler = quezon.find(entry => entry.label === 'U3 Quezon City Clinic');
  expect(scheduler).toBeDefined();
  expect(otherScheduler).toBeDefined();
  expect(manila.map(entry => entry.id)).not.toContain(otherScheduler.id);
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const availability = `query ListAppointmentSchedule($schedulerId: ID!, $date: Date!) {
    listAppointmentSchedule(schedulerId: $schedulerId, date: $date) {
      id slotId morningAllowed morningRegistered morningPending
      afternoonAllowed afternoonRegistered afternoonPending allowDuring scheduledDate
    }
  }`;
  await graphDenied(await patient.graphql(appointments, availability, { schedulerId: otherScheduler.id, date }),
    401, 'listAppointmentSchedule', 'Unauthorized');
  expect((await graph(await patient.graphql(appointments, availability, { schedulerId: scheduler.id, date })))
    .listAppointmentSchedule).toMatchObject({ slotId: scheduler.id, morningAllowed: 1 });
  const requirements = `query ListAppointmentRequirements($schedulerId: ID!, $offset: Int, $limit: Int) {
    listAppointmentRequirements(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
      id slotId label notes isDigital isActive
    }
  }`;
  const { listAppointmentRequirements: [requirement] } = await graph(await patient.graphql(
    appointments, requirements, { schedulerId: scheduler.id, offset: 0, limit: 50 },
  ));
  expect(requirement).toMatchObject({ label: 'U3 Appointment Attachment', isDigital: true });
  const { fileId: attachment } = await json(await stage(patient, pdf, 'appointment.pdf', 'application/pdf'));
  const book = `mutation ($schedulerId: ID!, $date: Date!, $session: SCHEDULE_SESSION!, $requirements: [patientScheduleRequirementInput!]!, $purpose: String) {
    submitAppointment(schedulerId: $schedulerId, date: $date, session: $session, requirements: $requirements, purpose: $purpose) {
      id requirements { filename }
    }
  }`;
  const { submitAppointment } = await graph(await patient.graphql(appointments, book, {
    schedulerId: scheduler.id, date, session: 'Morning', purpose: 'U3 mobile contract',
    requirements: [{ scheduleRequirementId: requirement.id, filename: attachment }],
  }));
  expect((await graph(await patient.graphql(appointments, status))).getAppointmentStatus).toMatchObject({
    id: submitAppointment.id, status: 'Pending', session: 'Morning', schedulerLabel: scheduler.label,
    created_at: expect.any(String),
  });
  expect((await graph(await other.graphql(appointments, status))).getAppointmentStatus?.id).not.toBe(submitAppointment.id);
  const path = recordPath('appointmentRequirement', submitAppointment.requirements[0].filename);
  await expectMedia(patient, path, pdf, 'application/pdf');
  await denied(await other.send(path), 404, 'FILE_NOT_FOUND');
  const staff = await login(request, staffEmail, { medical: true });
  const otherBranch = await login(request, `u3.${restrictedEmail}`, { medical: true });
  await expectMedia(staff, path, pdf, 'application/pdf');
  await denied(await otherBranch.send(path), 404, 'FILE_NOT_FOUND');
});

test('branch-scoped analytics and reporting agree with inventory and audit recorded medical and inventory actions', async ({ request }) => {
  const patient = await login(request, patientEmail);
  const staff = await login(request, staffEmail, { medical: true });
  const restricted = await login(request, restrictedEmail, { medical: true });
  const admin = await login(request, process.env.E2E_ADMIN_EMAIL, { medical: true });

  const queryPath = `/analytics/query/${metric}`;
  const query = (client, branch) => client.send(queryPath, { params: { branch, ...dateRange } });
  const { getMedicalItems } = await graph(await staff.graphql(inventory, `{
    getMedicalItems(category: Medicine, active: true) { id item_code }
  }`));
  const itemId = Number(getMedicalItems.find(item => item.item_code === 'U2-MED').id);
  const restock = 'mutation ($input: MedicineBatchInput!) { addMedicalSupply(input: $input) { id batchNumber } }';
  const stock = { medicalItemId: itemId, batchNumber: 'U3 MANILA', dosageUnit: 'mg', dosageValue: 10,
    expiryDate: '2099-01-01', quantity: 3, location: 'Arlegui' };
  const create = `mutation ($input: ConsultationInput!) {
    createConsultation(input: $input) { id patientId status }
  }`;
  const consultation = { input: { patientId: patient.id, mode: 'Onsite', type: 'Medical', notes: 'U3 sensitive note' } };
  const auditQuery = `query ($id: ID!, $type: String!) {
    getSystemAuditLog(medicalId: $id, eventType: $type, pageSize: 100) {
      entries { actorId changedBy event_type action target_id payload timestamp } totalCount
    }
  }`;
  const auditLog = async (id, type) => (await graph(await admin.graphql(audit, auditQuery, { id, type }))).getSystemAuditLog;
  const types = ['CONSULTATION_MANAGEMENT', 'INVENTORY_MANAGEMENT'];
  const before = await Promise.all(types.map(type => auditLog(restricted.id, type)));

  await graphDenied(await restricted.graphql('/consultation', create, consultation), 403,
    'createConsultation', 'Not permitted to modify medical data');
  await graphDenied(await restricted.graphql(inventory, restock, { input: stock }), 401, 'addMedicalSupply', 'Unauthorized');
  const { createConsultation } = await graph(await staff.graphql('/consultation', create, consultation));
  expect(createConsultation).toMatchObject({ patientId: patient.id, status: 'Created' });
  const { addMedicalSupply } = await graph(await staff.graphql(inventory, restock, { input: stock }));
  await graph(await admin.graphql(inventory, restock, {
    input: { ...stock, location: 'QuezonCity', batchNumber: 'U3 QUEZON', quantity: 7 },
  }));

  const medicalAudit = (await auditLog(staff.id, types[0])).entries.find(entry => entry.action === 'CREATE_CONSULTATION');
  const inventoryAudit = (await auditLog(staff.id, types[1])).entries.find(entry => entry.action === 'CREATE_MEDICAL_SUPPLY');
  expect(medicalAudit).toMatchObject({
    actorId: staff.id, target_id: patient.id, changedBy: 'Medical', event_type: types[0], timestamp: expect.any(String),
  });
  const medicalPayload = JSON.parse(medicalAudit.payload);
  expect(medicalPayload).toMatchObject({ consultationId: Number(createConsultation.id), patientId: Number(patient.id), status: 'Created' });
  expect(medicalPayload).not.toHaveProperty('notes');
  expect(inventoryAudit).toMatchObject({ actorId: staff.id, target_id: null, changedBy: 'Medical', event_type: types[1] });
  expect(JSON.parse(inventoryAudit.payload)).toMatchObject({ batchId: Number(addMedicalSupply.id), itemId });
  expect(await Promise.all(types.map(type => auditLog(restricted.id, type)))).toEqual(before);
  await graphDenied(await staff.graphql(audit, auditQuery, { id: staff.id, type: types[0] }), 403,
    'getSystemAuditLog', 'Admin access required.');

  const quantity = result => result.data.series.find(series => series.name === 'Medicine').values[0];
  const manila = await json(await query(staff, 'Manila'));
  const quezon = await json(await query(admin, 'QuezonCity'));
  const both = await json(await query(admin, 'Both'));
  expect(manila).toMatchObject({ success: true, branch: 'Manila', dataType: metric, dateRange });
  expect(quantity(manila)).toBeGreaterThanOrEqual(3);
  expect(quantity(quezon)).toBe(7);
  expect(quantity(both)).toBe(quantity(manila) + quantity(quezon));

  const batch = branch => ({ branch, ...dateRange, dataTypes: [metric] });
  const report = branch => ({ branch, ...dateRange, dataType: metric });
  const bulkReport = branch => ({ ...batch(branch), format: 'csv' });
  const batchResponse = await json(await staff.post('/analytics/batch', batch('Manila')));
  expect(batchResponse).toMatchObject({
    success: true, branch: 'Manila', results: { [metric]: { success: true, data: manila.data } },
  });
  expect(await json(await staff.send('/analytics/filter-options'))).toMatchObject({
    success: true, departments: expect.any(Array),
  });
  const exported = await staff.post('/analytics/export/single', report('Manila'));
  expect(exported.status()).toBe(200);
  expect(exported.headers()['content-type']).toContain('application/pdf');
  expect((await exported.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const csv = await staff.post('/analytics/export', bulkReport('Manila'));
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('application/zip');
  expect((await csv.body()).subarray(0, 4).toString('hex')).toBe('504b0304');

  for (const branch of ['QuezonCity', 'Both']) {
    await denied(await query(staff, branch), 403, 'BRANCH_ACCESS_DENIED');
    await denied(await staff.post('/analytics/batch', batch(branch)), 403, 'BRANCH_ACCESS_DENIED');
    await denied(await staff.post('/analytics/export/single', report(branch)), 403, 'BRANCH_ACCESS_DENIED');
    await denied(await staff.post('/analytics/export', bulkReport(branch)), 403, 'BRANCH_ACCESS_DENIED');
  }
  await denied(await query(restricted, 'QuezonCity'), 403, 'ANALYTICS_ACCESS_DENIED');
  await denied(await restricted.send('/analytics/filter-options'), 403, 'ANALYTICS_ACCESS_DENIED');
  // The staff server also validates the caller role before resolving analytics.
  const patientOnStaff = await request.fetch(staffUrl + queryPath, {
    params: { branch: 'Manila', ...dateRange }, headers: { Authorization: `Bearer ${patient.token}` },
  });
  await denied(patientOnStaff, 403, 'FORBIDDEN');
});

