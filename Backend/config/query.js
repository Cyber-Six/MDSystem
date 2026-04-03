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

// to be used on dbClient
function db(){
  return pool;
}

async function query(text, params) {
  return await queryClient(pool, text, params);
}

async function queryClient(db, text, params) {
    try {
        const result = await db.query(text, params);
        return result;
    } catch (err) {
        logger.error("DB QUERY ERROR:", err);
        throw err;
    }
}

async function queryControlled(text, params) {
  return await queryControlledClient(pool, text, params);
}

async function queryControlledClient(db, text, params) {
  try {
    const result = await db.query(text, params);
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

    const status = result.rows[0].status;
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
      logger.debug(`No branch found for userId=${userId}`);
      return null; // patient not found
    }
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

async function getMedicalPersonnelStatus(userId) {
  const sql = `
    SELECT mp.is_active
    FROM "MedicalPersonnel" mp
    JOIN "UserCredentials" uc ON uc.id = mp.id
    WHERE mp.id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) return null; // not found

    return result.rows[0].is_active; 
  } catch (err) {
    logger.error(`Error fetching medical status for userId=${userId}:`, err);
    throw err;
  }
}

async function setSystemAuditLog({client=pool, eventType, actorId, actorType, targetId, action, details, changedBy}) {
  const result = await client.query(
    `INSERT INTO "SystemAuditLog"
     ("event_type", "actorId", "actorType", "targetId", "action", "details", "changedBy")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id;`,
    [eventType, actorId, actorType, targetId, action, details, changedBy]
  );
  return result.rows[0].id;
}

/**
 * Verify multiple user IDs and return their identity information
 * Checks if each ID exists, their role/identity, and status
 * @param {Array<string|number>} userIds - Array of user IDs to verify
 * @returns {Promise<Object>} { valid: [{id, identity, status}], invalid: [id] }
 */
async function verifyUserIdentities(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { valid: [], invalid: [] };
  }

  const sql = `
    SELECT
      uc.id,
      uc.identity,
      uc.credentials_status AS status
    FROM "UserCredentials" uc
    WHERE uc.id = ANY($1)
    ORDER BY uc.id;
  `;

  try {
    const result = await query(sql, [userIds]);
    const foundIds = new Set(result.rows.map(row => String(row.id)));

    // Separate valid from invalid IDs
    const valid = result.rows.map(row => ({
      id: String(row.id),
      identity: row.identity,
      status: row.status
    }));

    const invalid = userIds.filter(id => !foundIds.has(String(id)));

    logger.info(`[VERIFY_IDENTITIES] Valid: ${valid.length}, Invalid: ${invalid.length}`);

    return {
      valid,
      invalid,
      totalRequested: userIds.length,
      totalValid: valid.length,
      totalInvalid: invalid.length
    };
  } catch (err) {
    logger.error(`Error verifying user identities:`, err);
    throw err;
  }
}

/**
 * Get detailed identity info for multiple user IDs
 * Includes identity type, account status, and whether they're active staff
 * @param {Array<string|number>} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of {id, identity, status, isMedicalPersonnel, isActive}
 */
async function getUserIdentitiesDetailed(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  const sql = `
    SELECT
      uc.id,
      uc.identity,
      uc.credentials_status AS status,
      CASE WHEN mp.id IS NOT NULL THEN true ELSE false END AS is_medical_personnel,
      CASE WHEN mp.is_active = true THEN true ELSE false END AS is_active,
      mp.designation AS branch
    FROM "UserCredentials" uc
    LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
    WHERE uc.id = ANY($1)
    ORDER BY uc.id;
  `;

  try {
    const result = await query(sql, [userIds]);
    return result.rows.map(row => ({
      id: String(row.id),
      identity: row.identity,
      status: row.status,
      isMedicalPersonnel: row.is_medical_personnel,
      isActive: row.is_active,
      branch: row.branch
    }));
  } catch (err) {
    logger.error(`Error fetching detailed identities:`, err);
    throw err;
  }
}

/**
 * Get branches for multiple patient user IDs
 * @param {Array<string|number>} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of {userId, branch}
 */
async function getPatientBranches(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  const sql = `
    SELECT id AS "userId", branch
    FROM "UsersPersonal"
    WHERE id = ANY($1)
    ORDER BY id;
  `;

  try {
    const result = await query(sql, [userIds]);
    return result.rows.map(row => ({
      userId: String(row.userId),
      branch: row.branch
    }));
  } catch (err) {
    logger.error(`Error fetching patient branches:`, err);
    throw err;
  }
}

/**
 * Resolve union branch for multiple patients
 * If all patients have the same branch, return that branch
 * If branches differ, return 'Both' to indicate multi-branch scope
 * @param {Array<{userId: string, branch: string}>} patientBranches - Array from getPatientBranches()
 * @returns {string} Single branch name or 'Both'
 */
function resolveUnionBranch(patientBranches) {
  if (!Array.isArray(patientBranches) || patientBranches.length === 0) {
    return 'Both';
  }

  // Get unique branches
  const branches = [...new Set(patientBranches.map(p => p.branch).filter(b => b))];

  // If all patients have same branch, return it
  if (branches.length === 1) {
    return branches[0];
  }

  // If multiple different branches, return 'Both'
  return 'Both';
}

/**
 * Get user preferences (appearance, notification settings)
 * @param {string|number} userId
 * @returns {Promise<{appearance: object, notification: object} | null>}
 */
async function getUserPreferences(userId) {
  const sql = `
    SELECT appearance, notification
    FROM "UsersPreferences"
    WHERE id = $1
    LIMIT 1;
  `;

  try {
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      appearance: row.appearance || {},
      notification: row.notification || {}
    };
  } catch (err) {
    logger.error(`Error fetching preferences for userId=${userId}:`, err);
    throw err;
  }
}

/**
 * Create or update user preferences
 * @param {string|number} userId
 * @param {{appearance?: object, notification?: object}} updates
 * @returns {Promise<{appearance: object, notification: object}>}
 */
async function setUserPreferences(userId, updates) {
  const sql = `
    INSERT INTO "UsersPreferences" (id, appearance, notification)
    VALUES ($1, $2, $3)
    ON CONFLICT(id) DO UPDATE SET
      appearance = COALESCE($2, "UsersPreferences".appearance),
      notification = COALESCE($3, "UsersPreferences".notification),
      updated_at = NOW()
    RETURNING appearance, notification;
  `;

  try {
    const appearance = updates.appearance ? JSON.stringify(updates.appearance) : null;
    const notification = updates.notification ? JSON.stringify(updates.notification) : null;

    const result = await query(sql, [userId, appearance, notification]);

    if (result.rows.length === 0) {
      throw new Error("Failed to set preferences");
    }

    const row = result.rows[0];
    return {
      appearance: row.appearance || {},
      notification: row.notification || {}
    };
  } catch (err) {
    logger.error(`Error setting preferences for userId=${userId}:`, err);
    throw err;
  }
}

module.exports = {
    db,
    connect,
    query,
    queryClient,
    queryControlled,
    queryControlledClient,
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
    isActiveMedicalPersonnel,
    getMedicalPersonnelStatus,
    setSystemAuditLog,
    verifyUserIdentities,
    getUserIdentitiesDetailed,
    getPatientBranches,
    resolveUnionBranch,
    getUserPreferences,
    setUserPreferences
};