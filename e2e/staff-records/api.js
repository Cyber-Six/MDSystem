'use strict';
const { expect, test } = require('@playwright/test');
const { redact } = require('../custom-choices/evidence');
const fields = {
  profile: ['Profile', '... on StudentProfile { id program year status } ... on EmployeeProfile { id department role position employmentCategoryOther status }'],
  emergencyContact: ['EmergencyContact', 'id firstContact { id contactName relationship contactNumber address } secondContact { id contactName relationship contactNumber address }'],
  medicalHistory: ['MedicalHistory', 'id conditions { conditionId relationship description diagnosedDate } notes'],
  allergyProfile: ['AllergyProfile', 'id allergies { allergenCatalogId status severity notes dateIdentified } notes'],
  hospitalizationProfile: ['HospitalizationProfile', 'id hospitalizations { conditionId admissionDate dischargeDate notes } notes'],
  operationProfile: ['OperationProfile', 'id operations { procedureId operationDate notes } notes'],
  medicationProfile: ['MedicationProfile', 'id medications { medicineId description } notes'],
  immunizationProfile: ['ImmunizationProfile', 'id immunizations { vaccineTypeId immunizationDate doseNumber } notes'],
  lifestyle: ['Lifestyle', 'id smoker numberOfCigarettesPerDay yearsSmoked alcoholConsumer frequencyOfAlcoholConsumption vapeUser vapeType vapeFrequency yearsVaping notes'],
  visualAcuityProfile: ['VisualAcuityProfile', 'id acuity { acuityId left_eye right_eye notes recorded_at } notes'],
  dentalHistory: ['DentalHistory', 'id seenByDentist lastDentalCleaning purpose lastVisitDate'],
  dentalProcedureProfile: ['DentalProcedureProfile', 'id procedures { procedureTypeId procedureDate } notes'],
  oralApplianceProfile: ['OralApplianceProfile', 'id appliances { tagId status dateIssued arch } notes otherDescription otherArch'],
  dentalPhotoRecord: ['DentalPhotoRecord', 'id upperTeeth lowerTeeth'],
  obgynHistory: ['ObgynHistory', 'id lastMenstrualPeriod hasDysmenorrhea notes'],
};
const personalFields = 'id first_name middle_name last_name suffix date_of_birth sex civil_status nationality religion contactNumber present_address province_address branch identifier';

function loginCompletion(status, auth) {
  if (status >= 200 && status < 300 && auth?.ok === true && typeof auth.accessToken === 'string' && auth.accessToken) return auth.accessToken;
  const code = typeof auth?.error === 'string' && /^[A-Z0-9_]{1,80}$/.test(auth.error) ? auth.error : 'INVALID_COMPLETION_RESPONSE';
  const hints = {
    DATA_CONSENT_REQUIRED: 'Sign in manually to the QA portal and accept its data consent policy, then rerun.',
    OUTDATED_CONSENT: 'Sign in manually to the QA portal and accept the latest data consent policy, then rerun.',
    '2FA_NOT_VERIFIED': 'The server has not verified two-factor authentication; check the configured test OTP and deployed authentication configuration.',
    INVALID_LOGIN_SESSION: 'The login session expired or is invalid; check deployed session storage and authentication configuration.',
    ACCOUNT_LOCKED: 'The QA account is locked; resolve its lock before rerunning.',
  };
  throw new Error(`QA login completion failed (HTTP ${status}, ${code}). ${hints[code] || 'Inspect the deployed login handler; no access token was issued.'}`);
}

async function graphql(session, endpoint, query, variables = {}) {
  const response = await session.page.request.post(`${session.url}${endpoint}`, {
    headers: { authorization: `Bearer ${session.token}` }, data: { query, variables },
  });
  let body;
  try { body = await response.json(); } catch { throw new Error(`Non-JSON API response from ${endpoint}: HTTP ${response.status()}`); }
  session.evidence.network.push(redact({ endpoint, request: { query, variables }, response: body, status: response.status() }));
  const details = (body.errors || []).map(error => error.message).join('; ');
  expect(response.ok(), `HTTP ${response.status()} from ${endpoint}${details ? `: ${details}` : ''}`).toBe(true);
  expect(body.errors || [], `GraphQL errors from ${endpoint}`).toEqual([]);
  return body.data;
}

async function login(page, url, email, password, evidence) {
  await page.goto(`${url}/auth/login`);
  await page.getByRole('button', { name: 'Open login panel' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const signed = page.waitForResponse(response => new URL(response.url()).pathname === '/auth/login' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const result = await signed;
  const body = await result.json();
  if (!result.ok() || body.ok !== true) throw new Error(`QA authentication failed (HTTP ${result.status()}, ${body.error || 'unknown'}).`);
  const otp = process.env.E2E_TEST_OTP || '111111';
  expect(otp).toMatch(/^\d{6}$/);
  const inputs = page.locator('input[inputmode="numeric"][maxlength="1"]');
  await expect(inputs).toHaveCount(6);
  for (let i = 0; i < 6; i++) await inputs.nth(i).fill(otp[i]);
  const completion = page.waitForResponse(response => new URL(response.url()).pathname === '/auth/login/complete' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  const completed = await completion;
  const auth = await completed.json();
  const diagnostic = { endpoint: '/auth/login/complete', status: completed.status(),
    error: typeof auth?.error === 'string' && /^[A-Z0-9_]{1,80}$/.test(auth.error) ? auth.error : null,
    authenticated: completed.ok() && auth?.ok === true && Boolean(auth.accessToken) };
  evidence.network.push(diagnostic);
  if (!diagnostic.authenticated) await test.info().attach('qa-authentication.json', { contentType: 'application/json', body: JSON.stringify(diagnostic) });
  return { page, url, token: loginCompletion(completed.status(), auth), evidence };
}

async function ticket(session, patientId) {
  const staff = patientId != null;
  const data = await graphql(session, staff ? '/emr/medical' : '/emr/patient', staff
    ? 'query StaffWorkflowTicket($userId: ID!) { ticket: getUserUpdateTicket(userId: $userId) { id patientId status scope notes } }'
    : 'query StaffWorkflowPatientTicket { ticket: getUpdateTicket { id patientId status scope notes } }', staff ? { userId: patientId } : {});
  return data.ticket;
}

async function snapshot(session, patientId, ticketId, { includeApproved = true } = {}) {
  const document = `query StaffWorkflowSnapshot($userId: ID!) {
    basicInfo: getPatientBasicInfo(userId: $userId) { id profile_type sex latest_ticket_id }
    ${Object.entries(fields).map(([key, [name, selection]]) => `${key}: getUser${name}(userId: $userId, limit: 1000) { ${selection} }`).join('\n')}
  }`;
  const data = await graphql(session, '/emr/medical', document, { userId: patientId });
  const record = {};
  for (const key of Object.keys(fields)) record[key] = (data[key] || []).find(row => String(row.id) === String(ticketId)) ?? null;
  const personal = await graphql(session, '/profile/medical', `query StaffWorkflowPersonal($userId: ID!) {
    logs: getUserPersonalRecordLog(userId: $userId, limit: 100) { ${personalFields} }
    ${includeApproved ? `approved: getUserPersonalRecord(userId: $userId) { ${personalFields} }` : ''}
  }`, { userId: patientId });
  return { record, basicInfo: data.basicInfo, personal, ticketId: String(ticketId) };
}

async function patientPersonal(session, { includeApproved = true } = {}) {
  return graphql(session, '/profile/patient', `query StaffWorkflowPatientPersonal {
    ${includeApproved ? `approved: getPersonalRecord { ${personalFields} }` : `pending: getPersonalRecordLog { ${personalFields} }`}
    getCredentialStatus
  }`);
}

module.exports = { fields, personalFields, graphql, loginCompletion, login, ticket, snapshot, patientPersonal };
