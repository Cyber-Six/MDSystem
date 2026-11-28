const bcrypt = require('/app/Backend/node_modules/bcrypt');
const { Client } = require('/app/Backend/node_modules/pg');
const { connectE2eDb } = require('./core/db');

const {
  PRESCRIPTION_TEMPLATE_NAME,
  PRESCRIPTION_REQUIRED_TAGS,
} = require('/app/Backend/services/doc-generate-module/prescription-normalized');
const {
  MEDICAL_CERTIFICATE_TEMPLATE_NAME,
  MEDICAL_CERTIFICATE_REQUIRED_TAGS,
} = require('/app/Backend/services/doc-generate-module/medical-certificate-normalized');

async function main() {
  const client = await connectE2eDb(Client);
  try {
    const passwordHash = await bcrypt.hash(process.env.E2E_ACCOUNT_PASSWORD, 12);
    const accounts = [
      { email: process.env.E2E_PATIENT_EMAIL, identity: 'Student', patient: true },
      { email: process.env.E2E_ALT_PATIENT_EMAIL, identity: 'Student', patient: true },
      { email: process.env.E2E_U2_PATIENT_EMAIL, identity: 'Student', patient: true },
      { email: `muclinicthree${process.env.E2E_PATIENT_EMAIL}`, identity: 'Student', patient: true, batchU3: true },
      { email: `quclinicthree${process.env.E2E_ALT_PATIENT_EMAIL}`, identity: 'Student', patient: true, branch: 'QuezonCity' },
      { email: process.env.E2E_STAFF_EMAIL, identity: 'Employee', staff: true, role: 'Nurse', branch: 'Manila' },
      { email: process.env.E2E_RESTRICTED_STAFF_EMAIL, identity: 'Employee', staff: true, role: 'Nurse', branch: 'QuezonCity' },
      { email: `u3.${process.env.E2E_RESTRICTED_STAFF_EMAIL}`, identity: 'Employee', staff: true, role: 'Nurse', branch: 'QuezonCity', batchU3: true },
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
        if (account.batchU3) {
          await client.query(`
            WITH ticket AS (
              INSERT INTO "patientUpdateLog" ("patientId", status, scope)
              VALUES ($1, 'InProgress', 'Both') RETURNING id
            )
            INSERT INTO "MedicalHistory" (id)
            SELECT id FROM ticket
          `, [id]);
        }
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
        const roles = ['IS_STAFF'];
        if (account.branch === 'Manila' || account.batchU3) {
          roles.push('ALLOW_TO_VIEW_EMR', 'ALLOW_TO_VIEW_DOCUMENTS');
        }
        if (account.batchU3) {
          roles.push('ALLOW_TO_ACCESS_HEALTH_CHAT', 'ALLOW_TO_VIEW_APPOINTMENT');
        }
        // The staff portal requires all mapped permissions to enable a module.
        if (account.branch === 'Manila') {
          roles.push(
            'ALLOW_TO_CRUD_ANNOUNCEMENT',
            'ALLOW_TO_VIEW_ANALYTICS',
            'ALLOW_TO_EXPORT_ANALYTICS',
            'ALLOW_TO_ACCESS_HEALTH_CHAT',
            'ALLOW_TO_VIEW_APPOINTMENT',
            'ALLOW_TO_APPROVE_APPOINTMENT',
            'ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION',
            'ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION',
            'ALLOW_TO_VIEW_INVENTORY',
            'ALLOW_TO_EDIT_INVENTORY',
            'ALLOW_TO_DISPENSE_MEDICINE',
            'ALLOW_TO_MANAGE_MEDICINE_REQUESTS',
            'ALLOW_TO_PRESCRIBE',
            'ALLOW_TO_CONFIGURE_INVENTORY',
            'ALLOW_TO_VIEW_PROFILE',
            'ALLOW_TO_VIEW_CONSULTATION',
            'ALLOW_TO_EDIT_CONSULTATION',
            'ALLOW_TO_MANAGE_DOCUMENTS',
            'ALLOW_TO_GENERATE_DOCUMENTS',
          );
        }
        await client.query(
          `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
           SELECT $1, rt.id, $2::"UserDesignation", $3
           FROM "rolesTable" rt WHERE rt.label = ANY($4::text[])`,
          [id, account.branch, adminRows[0].id, roles],
        );
      }
    }

    await client.query('INSERT INTO "rawDocumentTag" (label) VALUES ($1)', ['U3 Private Medical Attachment']);

    // Post-build setup runs before the bootstrap administrator exists. Complete
    // the templates and their mappings now that there is a staff owner.
    for (const [template, description, tags] of [
      [PRESCRIPTION_TEMPLATE_NAME, 'Prescription document template', PRESCRIPTION_REQUIRED_TAGS],
      [MEDICAL_CERTIFICATE_TEMPLATE_NAME, 'Medical certificate document template', MEDICAL_CERTIFICATE_REQUIRED_TAGS],
    ]) {
      await client.query(`
        INSERT INTO "documentTemplate" (template, description, "revisedDate", "createdBy")
        SELECT $1::text, $2, TO_CHAR(CURRENT_DATE, 'YYYY-MM'), mp.id
        FROM "MedicalPersonnel" mp JOIN "UserCredentials" uc ON uc.id = mp.id
        WHERE uc.email = $3
          AND NOT EXISTS (
            SELECT 1 FROM "documentTemplate"
            WHERE REPLACE(LOWER(template), ' ', '-') = LOWER($1)
          )
      `, [template, description, process.env.E2E_ADMIN_EMAIL]);
      await client.query(`
        INSERT INTO "documentRequirements" ("templateId", "requirementtagId")
        SELECT dt.id, tag.id
        FROM "documentTemplate" dt
        JOIN "documentRequirementsTag" tag ON LOWER(tag.vartag) = ANY($2::text[])
        WHERE REPLACE(LOWER(dt.template), ' ', '-') = LOWER($1)
          AND NOT EXISTS (
            SELECT 1 FROM "documentRequirements" req
            WHERE req."templateId" = dt.id AND req."requirementtagId" = tag.id
          )
      `, [template, tags]);
    }

    await client.query(
      'INSERT INTO "ICDLookup" (code, title, release) VALUES ($1, $2, $3)',
      ['CA40', 'Pneumonia', process.env.ICD_RELEASE],
    );

    await client.query(`
      INSERT INTO "slotScheduler"
        (label, location, "scheduleFlags", "morningAllowed", "afternoonAllowed", "purposeRequired", "containsCustomDates")
      VALUES ('E2E Appointment', 'Arlegui', 127, 1, 1, true, false),
             ('U2 Clinic Visit', 'Arlegui', 127, 1, 1, true, false),
             ('U3 Manila Clinic', 'Arlegui', 127, 1, 1, true, false),
             ('U3 Quezon City Clinic', 'QuezonCity', 127, 1, 1, true, false)
    `);
    await client.query(`
      INSERT INTO "scheduleRequirement" ("slotId", label)
      SELECT id, 'U3 Appointment Attachment' FROM "slotScheduler" WHERE label = 'U3 Manila Clinic'
    `);

    await client.query(`
      WITH item AS (
        INSERT INTO "MedicalItems" (item_code, item_name, category)
        VALUES ('E2E-MED', 'E2E Medicine', 'Medicine'),
               ('U2-MED', 'U2 Medicine', 'Medicine')
        RETURNING id, item_code
      ), batch AS (
        INSERT INTO "MedicineBatch" ("medicalItemId", "batchNumber", "dosageUnit", "dosageValue", "expiryDate", location)
        SELECT id, item_code || '-BATCH', 'mg', 100, CURRENT_DATE + 365, 'Arlegui' FROM item
        RETURNING id
      )
      INSERT INTO "MedicineEntity" ("batchId")
      SELECT id FROM batch CROSS JOIN generate_series(1, 5)
    `);

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
