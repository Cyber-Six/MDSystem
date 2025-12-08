const pool = require("./db.js");
const { hashPassword } = require("./security.js");


// ✅ Generic query wrapper
async function query(text, params) {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (err) {
        console.error("DB QUERY ERROR:", err);
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
        VALUES ($1, $2, $3, true, $4, NOW(), 'unverified', NULL)
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

async function getUserConsentStateByEmail(email) {
  const sql = `
    SELECT id, data_consent_version, data_consent, data_consent_agreed
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


module.exports = {
    query,
    countUserByEmail,
    findUserByEmail,
    createUser,
    getUserConsentStateByEmail,
    updateUserConsent
};