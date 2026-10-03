const bcrypt = require('/app/Backend/node_modules/bcrypt');
const { Client } = require('/app/Backend/node_modules/pg');

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(process.env.E2E_ACCOUNT_PASSWORD, 12);
    const accounts = [
      { email: process.env.E2E_PATIENT_EMAIL, identity: 'Student', patient: true },
      { email: process.env.E2E_ALT_PATIENT_EMAIL, identity: 'Student', patient: true },
      { email: process.env.E2E_STAFF_EMAIL, identity: 'Employee', staff: true, role: 'Nurse', branch: 'Manila' },
      { email: process.env.E2E_RESTRICTED_STAFF_EMAIL, identity: 'Employee', staff: true, role: 'Nurse', branch: 'QuezonCity' },
    ];

    for (const account of accounts) {
      const { rows } = await client.query(
        `INSERT INTO "UserCredentials"
           ("password_hash", "identity", email, allow_email_2fa, data_consent,
            data_consent_version, data_consent_agreed, credentials_status)
         VALUES ($1, $2::"userIdentity", $3, true, true, $4, now(), 'Active'::"CredentialStatus")
         RETURNING id`,
        [passwordHash, account.identity, account.email, process.env.DATA_CONSENT_VERSION || 'v1.0'],
      );
      const id = rows[0].id;
      await client.query(
        `INSERT INTO "UsersPersonal" (id, first_name, last_name, branch)
         VALUES ($1, 'E2E', $2, $3::"UserDesignation")`,
        [id, account.staff ? (account.role === 'Nurse' ? 'Staff' : 'Test') : 'Patient', account.branch || 'Manila'],
      );

      if (account.patient) {
        await client.query(
          `INSERT INTO "Patients" (id, profile) VALUES ($1, 'Student'::"patientIdentity")`,
          [id],
        );
      }

      if (account.staff) {
        await client.query(
          `INSERT INTO "MedicalPersonnel" (id, role, title, designation, is_active)
           VALUES ($1, $2, 'E2E staff', $3::"UserDesignation", true)`,
          [id, account.role, account.branch],
        );
        const { rows: adminRows } = await client.query(
          `SELECT mp.id FROM "UserCredentials" uc
           JOIN "MedicalPersonnel" mp ON mp.id=uc.id WHERE uc.email=$1`,
          [process.env.E2E_ADMIN_EMAIL],
        );
        if (!adminRows[0]) throw new Error('Bootstrap administrator was not found after startup SQL.');
        await client.query(
          `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
           SELECT $1, rt.id, $2::"UserDesignation", $3
           FROM "rolesTable" rt WHERE rt.label='IS_STAFF'`,
          [id, account.branch, adminRows[0].id],
        );
      }
    }

    await client.query(
      `INSERT INTO "UsersPersonal" (id, first_name, last_name, branch)
       SELECT uc.id, 'E2E', 'Administrator', 'Both'::"UserDesignation"
       FROM "UserCredentials" uc WHERE uc.email=$1
       ON CONFLICT (id) DO NOTHING`,
      [process.env.E2E_ADMIN_EMAIL],
    );
    await client.query(
      `UPDATE "UserCredentials"
       SET data_consent=true, data_consent_version=$2, data_consent_agreed=now()
       WHERE email=$1`,
      [process.env.E2E_ADMIN_EMAIL, process.env.DATA_CONSENT_VERSION || 'v1.0'],
    );
  } finally {
    await client.end();
  }
}

main().catch(error => {
  process.stderr.write(`E2E database fixture setup failed: ${error.message}\n`);
  process.exitCode = 1;
});
