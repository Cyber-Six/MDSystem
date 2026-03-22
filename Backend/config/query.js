const pool = require("./db.js");
const { hashPassword } = require("../utils/security.js");
const { deduceRoleFromEmail } = require("../utils/validator.js");
const logger = require("../utils/logger.js");
// ✅ Generic query wrapper

async function connect() {
    try {
        const result = await pool.connect();
        logger.info("Database connection established.");
        return result;
    } catch (err) {
        logger.error("Database connection error:", err);
        throw err;
    }
}

async function query(text, params) {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (err) {
        logger.error("DB QUERY ERROR:", err);
        throw err;
    }
}

async function queryControlled(text, params) {
  try {
    const result = await pool.query(text, params);
    return { success: true, rows: result.rows };
  } catch (err) {
    if (err.code === '23503') {
      // Foreign key violation
      logger.warn("Expected FK violation(queryControlled):", err.detail);
    }
    else if (err.code === '23505') {
      // Unique constraint violation
      logger.warn("Expected unique constraint violation(queryControlled):", err.detail);
    }
    // Unexpected errors still logged as errors
    else logger.error("Unexpected DB error(queryControlled):", err);
    throw err;
  }
}


// ✅ Count-only version (safe for anti-enumeration)
async function countUserByEmail(email) {
    const sql = `
        SELECT COUNT(*) AS count
        FROM "UserCredentials"
        WHERE email = $1;
    `;

    const result = await query(sql, [email]);
    return parseInt(result.rows[0].count, 10);
}

// ✅ Find user by email (safe AFTER ownership is proven)
async function findUserByEmail(email) {
    const sql = `
        SELECT *
        FROM "UserCredentials"
        WHERE email = $1
        LIMIT 1;
    `;

    const result = await query(sql, [email]);
    return result.rows[0] || null;
}

async function findEmailByUserId(userId) {
  const sql = `
      SELECT email
      FROM "UserCredentials"
      WHERE id = $1
      LIMIT 1;
  `;

  const result = await query(sql, [userId]);
  return result.rows[0]?.email || null;
}

// ✅ Create user (final step of registration)
async function createUser({ email, password, role, data_consent_version }) {
    // ✅ Hash password
    const password_hash = await hashPassword(password);

    const sql = `
        INSERT INTO "UserCredentials" (
            email,
            password_hash,
            identity,
            data_consent,
            data_consent_version,
            data_consent_agreed,
            credentials_status,
            locked_until
        )
        VALUES ($1, $2, $3, true, $4, NOW(), 'Unverified', NULL)
        RETURNING id;
    `;

    const params = [
        email,
        password_hash,
        role,                   // maps to your userIdentity enum
        data_consent_version
    ];

    const result = await query(sql, params);
    return result.rows[0];
}



async function createPatient({ id, email }) { 

  const role = deduceRoleFromEmail(email);
  const sql = `
    INSERT INTO "Patients" (
        id,      
        profile
    )
    VALUES ($1, $2)
    RETURNING id;
    `;
  const params = [id, role];
  const result = await query(sql, params);
  return result.rows[0];
  }


async function updateUserPasswordById(userId, newPassword) {
  try {
    // ✅ Hash new password using the same hashing logic as createUser()
    const password_hash = await hashPassword(newPassword);

    const sql = `
      UPDATE "UserCredentials"
      SET password_hash = $1
      WHERE id = $2
      RETURNING id;
    `;

    const params = [password_hash, userId];

    const result = await query(sql, params);

    if (result.rowCount === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    return result.rows[0];

  } catch (err) {
    logger.error("updateUserPasswordById error:", err);
    throw err;
  }
}


async function getUserConsentStateByEmail(email) { // i add allow_email_2fa because im tired :(
  const sql = `
    SELECT id, data_consent_version, data_consent, data_consent_agreed, allow_email_2fa
    FROM "UserCredentials" WHERE email = $1 LIMIT 1;`;

  const params = [email];

  const result = await query(sql, params);

  // ✅ Return null if no user found
  if (result.rows.length === 0) return null;

  return result.rows[0];
}

async function updateUserConsent(userId, { data_consent, data_consent_version, data_consent_agreed }) {
  const sql = `
    UPDATE "UserCredentials"
    SET
      data_consent = $1,
      data_consent_version = $2,
      data_consent_agreed = $3
    WHERE id = $4
    RETURNING *;
  `;

  const result = await query(sql, [
    data_consent,
    data_consent_version,
    data_consent_agreed,
    userId
  ]);

  return result.rows[0] || null;
}


async function getUserIdentity(userId) {
  const sql = `
    SELECT identity
    FROM "UserCredentials"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);

    if (result.rows.length === 0) {
      return null; // user not found
    }

    return result.rows[0].identity; // only return identity
  } catch (err) {
    logger.error("Error fetching identity:", err);
    throw err;
  }
}

async function setExpiredUpdateTickets(id) {
    const sql = `
      UPDATE "patientUpdateLog"
      SET status = 'Expired'
      WHERE id = $1 AND status = 'InProgress';
      `;

    try {
      const result = await query(sql, [id]);
      logger.info(`Expired ${result.rowCount} update tickets.`);
    } catch (err) {
      logger.error("Error expiring update tickets:", err);
      throw err;
    }
  }

async function setExpiredPersonalTickets(id) {
    const sql = `
      UPDATE "UsersPersonalLog"
      SET status = 'Expired'
      WHERE id = $1 AND status = 'Pending';
      `;

    try {
      const result = await query(sql, [id]);
      logger.info(`Expired ${result.rowCount} personal update tickets.`);
    } catch (err) {
      logger.error("Error expiring personal update tickets:", err);
      throw err;
    }
  }

async function isUserValidated(userId) {
  const sql = `
    SELECT credentials_status AS status
    FROM "UserCredentials"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);

    if (result.rows.length === 0) {
      return false; // patient not found
    }

    const status = result.rows[0].status?.toLowerCase();
    return status !== "Unverified"; // true if verified or other
  } catch (err) {
    logger.error(`Error fetching credential status for userId=${userId}:`, err);
    throw err;
  }
}

async function getUserCredentialStatus(userId) {
  const sql = `
    SELECT credentials_status AS status
    FROM "UserCredentials"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].status || null;
  } catch (err) {
    logger.error(`Error fetching credential status for userId=${userId}:`, err);
    throw err;
  }
}

async function getUserBranch(userId) {
  const sql = `
    SELECT branch
    FROM "UsersPersonal"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) {
      console.log(`No branch found for userId=${userId}`);
      return null; // patient not found
    }
    console.log(result.rows[0]);
    return result.rows[0].branch; 
  } catch (err) {
    logger.error(`Error fetching branch for userId=${userId}:`, err);
    throw err;
  }
}

async function recordLoginAttempt(email, wasSuccessful) {
  const sql = `
    INSERT INTO "UserLoginAttempt" (user_id, was_successful)
    VALUES (
      (SELECT id FROM "UserCredentials" WHERE email = $1),
      $2
    );
  `;

  try {
    await query(sql, [email, wasSuccessful]);
  } catch (err) {
    logger.error("Error recording login attempt:", err);
    throw err;
  }
}


async function updateUserIdentity(userId, identity) {
  const sql = `
    UPDATE "UserCredentials"
    SET identity = $1
    WHERE id = $2
    RETURNING id, identity;
  `;
  const result = await query(sql, [identity, userId]);
  return result.rows[0] || null;
}

async function getUserPatientType(userId) { 
  const sql = `
    SELECT profile
    FROM "Patients"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) return null; // patient not found

    return result.rows[0].profile; 
  } catch (err) {
    logger.error(`Error fetching patient type for userId=${userId}:`, err);
    throw err;
  }
}

async function isActiveMedicalPersonnel(userId) {
  const sql = `
    SELECT mp.id
    FROM "MedicalPersonnel" mp
    JOIN "UserCredentials" uc ON uc.id = mp.id
    WHERE mp.id = $1
      AND mp.is_active = true
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    return result.rows.length > 0; // true if found, false if not
  } catch (err) {
    logger.error(`Error checking medical personnel for userId=${userId}:`, err);
    throw err;
  }
}

module.exports = {
    connect,
    query,
    queryControlled,
    countUserByEmail,
    findUserByEmail,
    findEmailByUserId,
    createUser,
    createPatient,
    updateUserPasswordById,
    getUserConsentStateByEmail,
    updateUserConsent,
    getUserIdentity,
    getUserCredentialStatus,
    updateUserIdentity,
    isUserValidated,
    setExpiredUpdateTickets,
    setExpiredPersonalTickets,
    getUserBranch,
    recordLoginAttempt,
    getUserPatientType,
    isActiveMedicalPersonnel
};