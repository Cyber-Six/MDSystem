const { test, expect } = require('@playwright/test');
const { inspectBatchSubmission } = require('./submission-result');

const enabled = process.env.E2E_REGISTRATION_ENABLED === '1';
const patientUrl = process.env.E2E_PATIENT_URL;
const testOtp = process.env.E2E_TEST_OTP || String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
const runId = `${Date.now()}${Math.floor(Math.random() * 10_000).toString().padStart(4, '0')}`;
const password = `E2e-${runId}`;

function configureAccountTests() {
  test.setTimeout(150_000);
  test.beforeAll(() => {
    if (!enabled) throw new Error('Set E2E_REGISTRATION_ENABLED=1 to allow account creation on the configured test deployment.');
    if (!patientUrl) throw new Error('Set E2E_PATIENT_URL to the patient test deployment URL.');
    if (!/^\d{6}$/.test(testOtp)) throw new Error('E2E_TEST_OTP must contain six digits.');
  });
}
function accountEmail(profile, index) {
  if (profile.role === 'Student') return `${profile.branch}qa${runId}${index}@tip.edu.ph`;
  return `qa${runId}${index}.employee@tip.edu.ph`;
}

async function registerAndOpenRecord(page, profile, index, hooks = {}) {
  page.setDefaultTimeout(20_000);
  // Space account creation across files to respect the eight-per-minute limit.
  await page.waitForTimeout(8_000);

  const email = accountEmail(profile, index);
  await test.info().attach('synthetic-test-data.json', {
    body: JSON.stringify({ runId, role: profile.role, gender: profile.gender, email: hooks.hideCredentials ? undefined : email }),
    contentType: 'application/json',
  });

  await page.goto(`${patientUrl.replace(/\/+$/, '')}/auth/login`);
  await page.getByRole('button', { name: 'Open login panel' }).click();
  await page.getByRole('button', { name: 'Register' }).click();
  const registrationForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create Account', exact: true }) });
  await registrationForm.locator('input[name="email"]').fill(email);
  await registrationForm.locator('input[name="password"]').fill(password);
  await registrationForm.getByLabel('Confirm Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  const otpInputs = page.locator('input[inputmode="numeric"]');
  await expect(otpInputs).toHaveCount(6, { timeout: 30_000 });
  for (let i = 0; i < 6; i += 1) await otpInputs.nth(i).fill(testOtp[i]);
  await page.getByRole('button', { name: 'Verify code' }).click();

  const consentScroll = page.locator('.overflow-y-auto.px-6');
  await expect(page.getByRole('heading', { name: 'Data Consent Policy', exact: true })).toBeVisible();
  await hooks.onRegistered?.({ email, password });
  const consent = page.getByRole('checkbox', { name: /I have read and agree/ });
  await expect(consent).toBeDisabled();
  await expect(page.getByText('Loading consent policy...', { exact: true })).toBeHidden();
  await consentScroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(consent).toBeEnabled();
  await consent.check();
  await page.getByRole('button', { name: 'Accept & Continue' }).click();

  const employee = profile.role === 'Employee';
  await expect(page.getByPlaceholder(employee ? 'Enter employee ID number' : 'Enter student number')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('Enter surname').fill(profile.surname);
  await page.getByPlaceholder(employee ? 'Enter given name' : 'Enter first name').fill(profile.name);
  await page.locator('select').first().selectOption(profile.gender);
  const identifier = page.getByPlaceholder(employee ? 'Enter employee ID number' : 'Enter student number');
  return { identifier, employee, email, password };
}

async function fillAndSubmitRecord(page, profile, index, account, hooks = {}) {
  const variant = index % 5;
  const recordIdentifier = String(1_000_000 + Number(runId.slice(-6))) + index;
  const choose = async (label, value) => {
    await page.locator('label').filter({ hasText: new RegExp('^' + label + '[\\s*]*$') }).locator('..').locator('select').selectOption(value);
  };
  const next = () => page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('input[type="date"]').fill(`199${variant}-0${variant + 1}-15`);
  await choose('Civil Status', variant % 2 ? 'Married' : 'Single');
  await page.getByPlaceholder('Enter nationality').fill('Filipino');
  await page.getByPlaceholder('Enter religion').fill(['Christian', 'Catholic', 'None', 'Protestant', 'Other'][variant]);
  await page.getByPlaceholder('09XXXXXXXXX').fill('0917000000' + variant);
  await account.identifier.fill(recordIdentifier);
  if (account.employee) {
    await page.getByPlaceholder('House Number, Street Name, Barangay, City / Municipality, Province').fill(`${variant + 10} QA Street, Manila`);
    await page.getByPlaceholder('Enter department').fill(['Engineering', 'Administration', 'Library', 'IT Services', 'Facilities'][variant]);
    await choose('Employment Category', ['Teaching', 'Teaching (Officer)', 'Non-Teaching', 'Non-Teaching (Officer)', 'Other'][variant]);
    if (variant === 4) await page.getByPlaceholder('Enter your employment category').fill('Research Consultant');
    await page.getByPlaceholder('Enter position').fill(['Instructor', 'Department Head', 'Librarian', 'IT Officer', 'Consultant'][variant]);
    await choose('Campus Branch', variant % 2 ? 'QuezonCity' : 'Manila');
  } else {
    await page.getByPlaceholder('Enter current/present address').fill(`${variant + 10} QA Street, Manila`);
    await page.getByPlaceholder('Enter province/permanent address').fill(`${variant + 20} Sample Road, Cavite`);
    const program = page.getByPlaceholder('Type to search for your program...');
    await program.fill(process.env.E2E_PROGRAM_SEARCH || 'Computer');
    await program.locator('..').getByRole('button').first().click();
    await choose('Student Category', ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Returnee'][variant]);
  }
  const contacts = account.employee ? 1 : 2;
  for (let contact = 0; contact < contacts; contact += 1) {
    await page.getByPlaceholder('Contact Name', { exact: true }).nth(contact).fill(`QA Guardian ${variant + 1}-${contact + 1}`);
    const relationship = contact ? 'e.g., Sibling, Guardian' : account.employee ? 'e.g., Spouse, Parent' : 'e.g., Mother, Father';
    await page.getByPlaceholder(relationship).fill(contact ? 'Sibling' : 'Parent');
    await page.getByPlaceholder('Contact Number', { exact: true }).nth(contact).fill('0918000000' + contact);
    await page.getByPlaceholder("Contact's home address").nth(contact).fill('25 Sample Road, Cavite');
  }
  if (hooks.personal) await hooks.personal();
  await next();
  await expect(page.getByRole('button', { name: 'Family', exact: true })).toBeVisible();
  if (hooks.history) await hooks.history();
  else {
    if (variant === 1 || variant === 3) await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    if (variant >= 2) {
      await page.getByRole('checkbox').first().check();
      await page.getByPlaceholder('Who has this condition? (e.g., Mother, Father, Sibling)').first().fill(variant === 2 ? 'Mother' : 'Father');
    }
  }
  await next();
  if (hooks.background) await hooks.background();
  else {
    for (const [title, name] of [['History of Allergies', 'hasAllergies'], ['History of Hospitalizations', 'hasHospitalization'], ['History of Operation', 'hasOperation'], ['Medications', 'hasMedications']]) {
      await page.getByRole('button', { name: title, exact: true }).click();
      await page.locator(`input[name="${name}"][value="No"]`).check();
    }
    await page.getByRole('button', { name: 'Lifestyle', exact: true }).click();
    for (const name of ['smoker', 'alcoholDrinker', 'vaper']) {
      await page.locator(`input[name="${name}"][value="no"]`).check();
    }
  }
  await next();
  await page.locator('input[name="firstTimeDentist"][value="no"]').check();
  await page.locator('input[type="month"]').fill('2025-06');
  await page.locator('input[name="lastDentalCleaning"]').nth(variant % 3).check();
  await page.locator('input[name="hasIntraOralAppliance"][value="no"]').check();
  // Synthetic image fixture, supplied in memory rather than a machine-specific path.
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=', 'base64');
  for (let photo = 0; photo < 2; photo += 1) {
    await page.locator('input[type="file"]').nth(photo).setInputFiles({ name: `synthetic-dental-${photo}.png`, mimeType: 'image/png', buffer: image });
    await expect(page.getByText(`synthetic-dental-${photo}.png`, { exact: true })).toBeVisible();
  }
  if (hooks.dental) await hooks.dental();
  await next();
  if (profile.gender === 'Female') {
    const lastPeriod = new Date();
    lastPeriod.setUTCDate(lastPeriod.getUTCDate() - 10 - variant);
    await page.locator('input[type="date"]').fill(lastPeriod.toISOString().slice(0, 10));
    await page.getByPlaceholder('Your answer').first().fill(String(4 + variant % 3));
    await next();
  }
  if (hooks.review) await hooks.review();
  await page.getByRole('checkbox').check();
  await test.info().attach('initial-record-data.json', { body: JSON.stringify({ role: profile.role, name: profile.name, surname: profile.surname, identifier: recordIdentifier, variant, email: hooks.hideCredentials ? undefined : account.email }), contentType: 'application/json' });
  const profileResponse = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && (request.postData() || '').includes('mutation CreateInitialPersonalRecord');
  }, { timeout: 30_000 });
  const submissionResponse = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && (request.postData() || '').includes('BatchCreateInitialRecords');
  }, { timeout: 60_000 }).catch(error => error);
  const { submission, submittedData, submissionResult } = await test.step('Send and parse the medical-record batch submission', async () => {
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const [initialProfile, batchResponse] = await Promise.all([profileResponse, submissionResponse]);
    const initialProfileData = await initialProfile.json();
    expect(initialProfileData.errors || [], 'Backend must accept the initial personal information').toEqual([]);
    expect(initialProfileData.data.createInitialPersonalRecord).toMatchObject({ first_name: profile.name, last_name: profile.surname, identifier: recordIdentifier });
    expect(batchResponse, `Backend must receive the medical-record batch submission${batchResponse instanceof Error ? `: ${batchResponse.message}` : ''}`).not.toBeInstanceOf(Error);
    let body;
    try {
      body = await batchResponse.json();
    } catch (error) {
      throw new Error(`Could not parse medical-record batch response (HTTP ${batchResponse.status()}): ${error.message}`);
    }
    return { submission: batchResponse, submittedData: body, submissionResult: inspectBatchSubmission(batchResponse.status(), body) };
  });
  if (hooks.afterBatch) {
    await hooks.afterBatch({ body: submittedData, result: submissionResult, status: submission.status() });
    return;
  }
  await test.step('Validate medical-record batch submission', async () => {
    expect(submissionResult.ok, `Medical-record submission failed: ${submissionResult.details}`).toBe(true);
  });
  await expect(page.getByText('Medical record submitted successfully. You can now access the system.', { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  // Read the authenticated ticket again: a success modal alone cannot prove
  // that the backend retained a pending submission.
  const headers = Object.fromEntries(Object.entries(await submission.request().allHeaders())
    .filter(([name]) => ['authorization', 'content-type', 'x-csrf-token', 'x-xsrf-token', 'x-portal'].includes(name)));
  return test.step('Read back the submitted Pending ticket', async () => {
    const persistedResponse = await page.request.post(submission.url(), {
      headers,
      data: { query: 'query VerifySubmittedInitialRecord { getUpdateTicket { id status scope } }', variables: {} },
    });
    const persistedData = await persistedResponse.json();
    expect(persistedResponse.ok(), `Ticket readback failed: HTTP ${persistedResponse.status()}; ${JSON.stringify(persistedData.errors || [])}`).toBe(true);
    expect(persistedData.errors || []).toEqual([]);
    expect(persistedData.data.getUpdateTicket).toMatchObject({ status: 'Pending', scope: 'Both' });
    expect(persistedData.data.getUpdateTicket.id).toBeTruthy();
    return persistedData.data.getUpdateTicket;
  });
}

module.exports = { configureAccountTests, registerAndOpenRecord, fillAndSubmitRecord };
