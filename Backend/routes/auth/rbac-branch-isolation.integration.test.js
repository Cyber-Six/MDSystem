const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const integration = process.env.E2E_AUTH_RBAC_INTEGRATION === '1' ? describe : describe.skip;

integration('Batch U1 against the disposable Docker E2E stack', () => {
  jest.setTimeout(60_000);

  const staffUrl = process.env.E2E_STAFF_URL;
  const patientUrl = process.env.E2E_PATIENT_URL;
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const staffEmail = process.env.E2E_STAFF_EMAIL;
  const lockedEmail = process.env.E2E_ALT_PATIENT_EMAIL;
  const password = process.env.E2E_ACCOUNT_PASSWORD;
  let db;
  let admin;
  let staff;
  let mail;

  async function api(path, { method = 'POST', token, data, base = staffUrl } = {}) {
    const headers = {};
    if (base === staffUrl) headers['x-forwarded-host'] = 'staff.e2e.invalid';
    if (token) headers.authorization = `Bearer ${token}`;
    if (data) headers['content-type'] = 'application/json';
    const response = await fetch(base + path, {
      method, headers, body: JSON.stringify(data), signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function login(email) {
    const { status, body } = await api('/auth/login', { data: { email, password } });
    expect(status).toBe(200);
    const previous = await mail.latestMessageId(email);
    expect((await api('/auth/email/2fa', { data: { email } })).status).toBe(200);
    const otp = await mail.readLatestOtp(email, previous);
    const verified = await api('/auth/email/2fa/verify', {
      data: { email, otp, verificationKey: body.LoginKey },
    });
    expect(verified.status).toBe(200);
    const completed = await api('/auth/login/complete', { data: { LoginKey: verified.body.verificationKey } });
    expect(completed.status).toBe(200);
    const { rows } = await db.query('SELECT id::text FROM "UserCredentials" WHERE email = $1', [email]);
    return { id: rows[0].id, token: completed.body.accessToken };
  }

  function roleManagement(actor, query, variables) {
    return api('/rolemanagement/admin', { token: actor.token, data: { query, variables } });
  }

  async function roleState() {
    const personnel = await db.query(
      'SELECT id::text, role, designation FROM "MedicalPersonnel" ORDER BY id',
    );
    const mappings = await db.query(
      `SELECT rm."personnelId"::text AS id, rt.label, rm.branch, rm."assignedBy"::text AS "assignedBy"
       FROM "rolesMap" rm JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       ORDER BY rm."personnelId", rt.label`,
    );
    return { personnel: personnel.rows, mappings: mappings.rows };
  }

  beforeAll(async () => {
    const { Client } = require('../../node_modules/pg');
    const { connectE2eDb } = require('../../../e2e/core/db');
    mail = require('../../../e2e/core/auth');
    db = await connectE2eDb(Client);
    admin = await login(adminEmail);
    staff = await login(staffEmail);
  });

  afterAll(async () => {
    await db?.end();
  });

  test('returns 403 for a cross-branch list or update and preserves the Quezon City record', async () => {
    const created = await api('/announcement', {
      token: admin.token,
      data: { label: `U1 QC ${randomUUID()}`, description: 'Persisted branch fixture', isActive: true, location: 'QuezonCity' },
    });
    expect(created.status).toBe(201);
    const { id } = created.body.data;
    const snapshot = async () => (await db.query('SELECT * FROM "Announcement" WHERE id = $1', [id])).rows;
    const before = await snapshot();
    expect(before).toHaveLength(1);

    const list = location => api(`/announcement/admin/all?location=${location}`, { method: 'GET', token: staff.token });
    expect((await list('Manila')).status).toBe(200);
    expect(await list('QuezonCity')).toMatchObject({ status: 403, body: { error: 'FORBIDDEN' } });
    expect(await api(`/announcement/${id}`, {
      method: 'PUT', token: staff.token, data: { label: 'Denied update', location: 'Manila' },
    })).toMatchObject({ status: 403, body: { error: 'FORBIDDEN' } });
    expect(await snapshot()).toEqual(before);
  });

  test('rejects valid credentials for a locked account and preserves the credential row', async () => {
    const credentials = async () => (await db.query(
      'SELECT * FROM "UserCredentials" WHERE email = $1', [lockedEmail],
    )).rows;
    const [original] = await credentials();
    expect(original.credentials_status).toBe('Active');
    await db.query('UPDATE "UserCredentials" SET credentials_status = \'Locked\' WHERE email = $1', [lockedEmail]);
    try {
      const [before] = await credentials();
      const denied = await api('/auth/login', { base: patientUrl, data: { email: lockedEmail, password } });
      expect(denied).toMatchObject({ status: 403, body: { error: 'ACCOUNT_LOCKED' } });
      for (const key of ['LoginKey', 'accessToken', 'refreshToken']) {
        expect(Object.hasOwn(denied.body, key)).toBe(false);
      }
      expect(isDeepStrictEqual((await credentials())[0], before)).toBe(true);
    } finally {
      await db.query('UPDATE "UserCredentials" SET credentials_status = $1 WHERE email = $2',
        [original.credentials_status, lockedEmail]);
    }
  });

  test('rejects direct grants and invalid confirmations, then transfers the sole admin permission', async () => {
    const before = await roleState();
    expect(before.mappings.filter(mapping => mapping.label === 'IS_ADMIN')).toEqual([
      expect.objectContaining({ id: admin.id, branch: 'Both' }),
    ]);

    const directGrant = await roleManagement(admin, `
      mutation GrantAdmin($user: ID!) {
        setStaffPermissionsExtended(userId: $user, permissions: [{ key: "is_admin", enabled: true }]) { ok }
      }`, { user: staff.id });
    expect(directGrant).toMatchObject({ status: 403, body: { errors: [expect.objectContaining({
      message: expect.stringMatching(/only be granted through Admin Transfer/i),
    })] } });
    expect(await roleState()).toEqual(before);

    const previous = await mail.latestMessageId(adminEmail);
    const started = await roleManagement(admin, `
      mutation StartTransfer($user: ID!, $password: String!) {
        initiateAdminTransfer(newAdminUserId: $user, password: $password) { ok verificationRequired bootstrapMode }
      }`, { user: staff.id, password });
    expect(started).toMatchObject({ status: 200, body: { data: {
      initiateAdminTransfer: { ok: true, verificationRequired: true, bootstrapMode: false },
    } } });
    expect(await roleState()).toEqual(before);
    const token = await mail.readLatestMailValue(adminEmail, previous, /\b\d{8}\b/);
    const confirm = (actor, code) => roleManagement(actor, `
      mutation ConfirmTransfer($code: String!) {
        confirmAdminTransfer(verificationToken: $code) { ok oldAdminId newAdminId }
      }`, { code });

    const denied = await confirm(staff, token);
    expect(denied).toMatchObject({ status: 403, body: { errors: [expect.objectContaining({
      message: 'Admin access required.',
    })] } });
    expect(await roleState()).toEqual(before);

    const invalid = await confirm(admin, token === '00000000' ? '11111111' : '00000000');
    expect(invalid).toMatchObject({ status: 400, body: { errors: [expect.objectContaining({
      message: 'Invalid or expired verification token.',
    })] } });
    expect(await roleState()).toEqual(before);

    const completed = await confirm(admin, token);
    expect(completed).toMatchObject({ status: 200, body: { data: {
      confirmAdminTransfer: { ok: true, oldAdminId: admin.id, newAdminId: staff.id },
    } } });
    const after = await roleState();
    expect(after.mappings.filter(mapping => mapping.label === 'IS_ADMIN')).toEqual([
      { id: staff.id, label: 'IS_ADMIN', branch: 'Both', assignedBy: admin.id },
    ]);
    expect(after.personnel).toContainEqual({ id: staff.id, role: 'Admin', designation: 'Both' });
    expect(after.mappings).toContainEqual(expect.objectContaining({ id: admin.id, label: 'IS_STAFF' }));
    expect((await confirm(admin, token)).status).toBe(403);
    expect((await confirm(staff, token)).status).toBe(400);
    expect(await roleState()).toEqual(after);
  });
});
