const { randomInt, randomUUID } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { totpGetToken } = require('../../Backend/utils/totp');
const { enterOtp, latestMessageId, readLatestMailValue, readLatestOtp, signIn } = require('../core/auth');
const { graphql } = require('../staff-records/api');
require('../core/sanitized-artifacts');

const patientUrl = process.env.E2E_PATIENT_URL;
const staffUrl = process.env.E2E_STAFF_URL;
const password = process.env.E2E_ACCOUNT_PASSWORD;

test.setTimeout(120_000);
test.use({ actionTimeout: 15_000 });

function waitForPost(page, path) {
  return page.waitForResponse(response =>
    new URL(response.url()).pathname === path && response.request().method() === 'POST');
}

function bearer(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

test('patient verifies registration, accepts consent, opens a deep link and secures the account', async ({ page, browser }) => {
  const email = `msecurity${randomInt(1_000_000_000)}@tip.edu.ph`;
  const deepLink = `${patientUrl}/settings`;

  await test.step('Verify email and record consent during registration', async () => {
    await page.goto(deepLink);
    await expect(page).toHaveURL(`${patientUrl}/auth/login`);
    await page.goto(`${patientUrl}/auth/register`);
    const create = page.getByRole('button', { name: 'Create Account', exact: true });
    const form = page.locator('form').filter({ has: create });
    await form.getByPlaceholder('your.email@tip.edu.ph').fill(email);
    await form.getByPlaceholder('At least 8 characters').fill(password);
    await form.getByPlaceholder('Re-enter your password').fill(password);
    const previousMessage = await latestMessageId(email);
    await create.click();
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await enterOtp(page, await readLatestOtp(email, previousMessage));
    const verified = waitForPost(page, '/auth/email/verification/verify');
    await page.getByRole('button', { name: 'Verify code' }).click();
    expect((await verified).status()).toBe(200);

    const agreement = page.getByRole('checkbox', { name: /I have read and agree/ });
    const accept = page.getByRole('button', { name: 'Accept & Continue' });
    await expect(agreement).toBeVisible();
    await expect(accept).toBeDisabled();
    await agreement.evaluate(element => {
      const policy = element.closest('form').parentElement.previousElementSibling;
      policy.scrollTop = policy.scrollHeight;
    });
    await agreement.check();
    const consented = waitForPost(page, '/info/consent/register');
    const registered = waitForPost(page, '/auth/register/complete');
    await accept.click();
    expect((await consented).status()).toBe(200);
    expect((await registered).status()).toBe(201);
    await expect(page).toHaveURL(`${patientUrl}/`);
    await page.goto(deepLink);
    await expect(page).toHaveURL(deepLink);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });

  const fresh = await browser.newPage();
  try {
    const session = await test.step('Redeem the one-time reset link and sign in with the new password', async () => {
      const previousMessage = await latestMessageId(email);
      const sent = await fresh.request.post(`${patientUrl}/auth/password/forget-password`, {
        data: { email, recaptchaToken: process.env.E2E_RECAPTCHA_TOKEN },
      });
      expect(sent.status()).toBe(200);
      const link = await readLatestMailValue(email, previousMessage,
        /https:\/\/www\.e2e\.invalid\/auth\/password\/reset-password\/[a-f0-9]{64}/i);
      // Mail uses the configured public origin. The browser runs on the Compose network.
      const resetPath = new URL(link).pathname;
      const key = resetPath.split('/').pop();
      const checkPath = `/auth/password/reset-password/check/${key}`;
      const checked = fresh.waitForResponse(response =>
        new URL(response.url()).pathname === checkPath && response.request().method() === 'GET');
      await fresh.goto(patientUrl + resetPath);
      expect((await checked).status()).toBe(200);
      const newPassword = `${password}-changed`;
      await fresh.getByPlaceholder('Enter new password', { exact: true }).fill(newPassword);
      await fresh.getByPlaceholder('Re-enter new password', { exact: true }).fill(newPassword);
      const reset = waitForPost(fresh, resetPath);
      await fresh.getByRole('button', { name: 'Reset Password', exact: true }).click();
      expect((await reset).status()).toBe(200);
      await expect(fresh).toHaveURL(`${patientUrl}/auth/login`);
      expect((await fresh.request.get(patientUrl + checkPath)).status()).toBe(400);
      const oldLogin = await fresh.request.post(`${patientUrl}/auth/login`, { data: { email, password } });
      expect(oldLogin.status()).toBe(400);
      expect((await oldLogin.json()).error).toBe('INVALID_CREDENTIALS');
      return signIn(fresh, patientUrl, email, { password: newPassword });
    });

    await test.step('Enable TOTP and verify it during a fresh login', async () => {
      const request = fresh.request;
      const headers = bearer(session.accessToken);
      const setup = await request.post(`${patientUrl}/settings/totp/setup`, { headers });
      expect(setup.status()).toBe(200);
      const { secret } = await setup.json();
      expect(typeof secret).toBe('string');
      const statusUrl = `${patientUrl}/settings/totp/status`;
      expect((await (await request.get(statusUrl, { headers })).json()).totpEnabled).toBe(false);
      const verify = await request.post(`${patientUrl}/settings/totp/verify`, {
        headers, data: { token: totpGetToken(secret) },
      });
      expect(verify.status()).toBe(200);
      expect((await (await request.get(statusUrl, { headers })).json()).totpEnabled).toBe(true);

      const login = await page.request.post(`${patientUrl}/auth/login`, {
        data: { email, password: `${password}-changed` },
      });
      expect(login.status()).toBe(200);
      const { LoginKey, requiresTotp } = await login.json();
      expect(requiresTotp).toBe(true);
      const complete = () => page.request.post(`${patientUrl}/auth/login/complete`, { data: { LoginKey } });
      const unverified = await complete();
      expect(unverified.status()).toBe(400);
      expect((await unverified.json()).error).toBe('2FA_NOT_VERIFIED');
      const validated = await page.request.post(`${patientUrl}/settings/totp/validate`, {
        data: { email, verificationKey: LoginKey, token: totpGetToken(secret) },
      });
      expect(validated.status()).toBe(200);
      const completed = await complete();
      expect(completed.status()).toBe(200);
      expect(typeof (await completed.json()).accessToken).toBe('string');
    });
  } finally {
    await fresh.close();
  }
});

test('Manila staff cannot see or change Quezon City announcements and loses access in the same session', async ({ page, browser }) => {
  const admin = await browser.newPage();
  try {
    const staff = await signIn(page, staffUrl, process.env.E2E_STAFF_EMAIL);
    const adminAuth = await signIn(admin, staffUrl, process.env.E2E_ADMIN_EMAIL);
    const adminHeaders = bearer(adminAuth.accessToken);
    const staffHeaders = bearer(staff.accessToken);
    const endpoint = `${staffUrl}/announcement`;

    const create = async location => {
      const label = `U1 ${location} ${randomUUID()}`;
      const response = await admin.request.post(endpoint, {
        headers: adminHeaders, data: { label, description: 'Branch isolation fixture', isActive: true, location },
      });
      expect(response.status()).toBe(201);
      const { data } = await response.json();
      return data;
    };
    const quezon = await create('QuezonCity');
    const manila = await create('Manila');

    await page.goto(`${staffUrl}/announcements`);
    await expect(page.getByText(manila.label, { exact: true })).toBeVisible();
    await expect(page.getByText(quezon.label, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'New Announcement' }).click();
    await expect(page.getByRole('option', { name: 'Quezon City', includeHidden: true })).toHaveCount(0);

    const checkAccess = location => page.request.get(`${endpoint}/admin/all`, {
      headers: staffHeaders, params: { location },
    });
    expect((await checkAccess('Manila')).status()).toBe(200);
    expect((await checkAccess('QuezonCity')).status()).toBe(403);
    expect((await page.request.get(`${endpoint}/${quezon.id}`, { headers: staffHeaders })).status()).toBe(404);
    const denied = await page.request.put(`${endpoint}/${quezon.id}`, {
      headers: staffHeaders, data: { label: 'Unauthorized edit', location: 'Manila' },
    });
    expect(denied.status()).toBe(403);
    const qcRecords = await admin.request.get(`${endpoint}/admin/all`, {
      headers: adminHeaders, params: { location: 'QuezonCity' },
    });
    expect(qcRecords.status()).toBe(200);
    expect((await qcRecords.json()).data).toContainEqual(expect.objectContaining({
      id: quezon.id, label: quezon.label, location: 'QuezonCity',
    }));

    const setAnnouncementPermission = async enabled => {
      const result = await graphql(
        { page: admin, url: staffUrl, token: adminAuth.accessToken, evidence: { network: [] } },
        '/rolemanagement/admin',
        `mutation SetAnnouncementPermission($user: ID!, $permissions: [ExtendedPermissionInput!]!) {
          setStaffPermissionsExtended(userId: $user, permissions: $permissions, defaultBranch: Manila) { ok }
        }`,
        { user: String(staff.userId), permissions: [{ key: 'announcement_allow_crud', enabled, branch: 'Manila' }] },
      );
      expect(result.setStaffPermissionsExtended.ok).toBe(true);
    };
    try {
      await setAnnouncementPermission(false);
      expect((await checkAccess('Manila')).status()).toBe(403);
      await page.goto(`${staffUrl}/announcements`);
      await expect(page).toHaveURL(`${staffUrl}/`);
      await expect(page.getByRole('button', { name: 'New Announcement' })).toHaveCount(0);
    } finally {
      await setAnnouncementPermission(true);
    }
  } finally {
    await admin.close();
  }
});
