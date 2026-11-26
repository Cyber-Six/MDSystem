const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { test, expect } = require('@playwright/test');
const { signIn } = require('../core/auth');
const { graphql } = require('../staff-records/api');
require('../core/sanitized-artifacts');

const staffUrl = process.env.E2E_STAFF_URL;
const patientUrl = process.env.E2E_PATIENT_URL;
const regularStaff = process.env.E2E_STAFF_EMAIL;

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

function postResponse(page, pathname, matchesBody = () => true) {
  return page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === pathname &&
      request.method() === 'POST' && matchesBody(request.postDataJSON());
  }, { timeout: 30_000 });
}

test('staff publishes an active announcement and a patient reads it', async ({ page: staff, browser }) => {
  const title = `E2E clinic notice ${randomUUID()}`;
  const description = 'The clinic will open at its usual time.';
  const patient = await browser.newPage();

  try {
    await signIn(staff, staffUrl, regularStaff);
    await staff.goto(`${staffUrl}/announcements`);
    await staff.getByRole('button', { name: 'New Announcement' }).click();
    await staff.getByPlaceholder('Enter announcement title').fill(title);
    await staff.getByPlaceholder('Enter announcement description').fill(description);
    const publish = postResponse(staff, '/announcement');
    await staff.getByRole('button', { name: 'Create Announcement' }).click();
    const created = await publish;
    expect(created.status()).toBe(201);
    expect((await created.json()).data).toMatchObject({ label: title, description, isActive: true, location: 'Manila' });
    await expect(staff.getByText(title, { exact: true })).toBeVisible();

    await signIn(patient, patientUrl, process.env.E2E_PATIENT_EMAIL);
    await patient.getByRole('button', { name: `View announcement: ${title}` }).click();
    await expect(patient.getByRole('heading', { name: title, exact: true, level: 2 })).toBeVisible();
    await expect(patient.getByText(description, { exact: true })
      .and(patient.locator('.prose p'))).toBeVisible();
  } finally {
    await patient.close();
  }
});

test('staff filters live analytics and downloads a non-empty PDF report', async ({ page }) => {
  await signIn(page, staffUrl, regularStaff);
  const initial = postResponse(page, '/analytics/batch', body => body?.groupBy === 'monthly');
  await page.goto(`${staffUrl}/analytics`);
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  expect((await initial).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();

  const filtered = postResponse(page, '/analytics/batch', body => body?.groupBy === 'weekly');
  await page.getByTitle('Select period', { exact: true }).selectOption('weekly');
  const batch = await filtered;
  expect(batch.ok()).toBe(true);
  const analytics = await batch.json();
  expect(analytics).toMatchObject({ success: true, branch: 'Manila' });
  expect(Object.values(analytics.results).some(result => result.success)).toBe(true);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Export Analytics' })).toBeVisible();
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: /Select Specific Metrics/ }) })
    .selectOption('custom');
  await page.getByRole('checkbox', { name: 'Patient Credential Status', exact: true }).check();
  const exportResponse = postResponse(page, '/analytics/export');
  const downloadEvent = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Export', exact: true }).last().click();

  const response = await exportResponse;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toMatchObject({
    format: 'pdf', branch: 'Manila', groupBy: 'weekly', dataTypes: ['patient-credential-status'],
  });
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const pdf = await readFile(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(100);
});

test('an admin role change grants the signed-in staff account announcement access', async ({ page: admin, browser }) => {
  const staff = await browser.newPage();
  const email = process.env.E2E_RESTRICTED_STAFF_EMAIL;
  const role = `E2E Announcer ${randomUUID().slice(0, 8)}`;

  try {
    const staffSession = await signIn(staff, staffUrl, email);
    const checkAccess = async () => {
      const response = await staff.request.get(`${staffUrl}/announcement/admin/all`, {
        headers: { Authorization: `Bearer ${staffSession.accessToken}` },
      });
      return response.status();
    };
    expect(await checkAccess()).toBe(403);
    await staff.goto(`${staffUrl}/announcements`);
    await expect(staff).toHaveURL(`${staffUrl}/`);

    const adminSession = await signIn(admin, staffUrl, process.env.E2E_ADMIN_EMAIL);
    const result = await graphql(
      { page: admin, url: staffUrl, token: adminSession.accessToken, evidence: { network: [] } },
      '/rolemanagement/admin',
      `mutation CreateAnnouncementRole($input: CreateTemplateInput!) {
        createPermissionTemplate(input: $input) { ok template { id label } }
      }`,
      { input: { label: role, permissions: [{ key: 'announcement_allow_crud', enabled: true }] } },
    );
    expect(result.createPermissionTemplate).toMatchObject({ ok: true, template: { label: role } });

    await admin.goto(`${staffUrl}/settings/roles`);
    await expect(admin.getByRole('heading', { name: 'Administration' })).toBeVisible();
    const account = admin.getByRole('row').filter({ hasText: email });
    await account.getByRole('button', { name: 'Nurse', exact: true }).click();
    await admin.getByRole('button', { name: role, exact: true }).click();
    const updating = postResponse(admin, '/rolemanagement/admin', body => /mutation UpdateStaffAccount/.test(body?.query));
    await admin.getByRole('button', { name: 'Update Account', exact: true }).click();
    const updated = await updating;
    expect(updated.ok()).toBe(true);
    expect(await updated.json()).toMatchObject({ data: { updateStaffAccount: { ok: true } } });
    await expect(account.getByRole('button', { name: role, exact: true })).toBeVisible();

    expect(await checkAccess()).toBe(200);
    await staff.goto(`${staffUrl}/announcements`);
    await expect(staff.getByRole('button', { name: 'New Announcement' })).toBeVisible();
  } finally {
    await staff.close();
  }
});
