const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days
const DEFAULT_DATE_STRING = '1970-01-01T00:00:00Z';

const Query = {
  _getUserCredentialStatus: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const sql = `
      SELECT credentials_status AS status
      FROM "UserCredentials"
      WHERE id = $1
      LIMIT 1;
    `;
    const status = await db.query(sql, [userId]);
    return status.rows[0]?.status || null;
  },


  _getUserPersonalRecord: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT up.*, uc.email
        FROM "UsersPersonal" AS up
        JOIN "UserCredentials" AS uc
          ON up.id = uc.id
        WHERE up."id" = $1
        ORDER BY uc.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );

    return result.rows[0] || null;
    },

  _getUserPersonalRecordLogStatus: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT upl.id, upl.status, upl.created_at
        FROM "UsersPersonalLog" AS upl
        WHERE upl."user_id" = $1
        ORDER BY upl.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );
     
    const ticket = result.rows[0];
    logger.debug("Fetched Update Personal Ticket:", ticket);
    if (ticket && ticket.status === "Pending") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isUserValidated(userId))) {
        return {id: ticket.id, patientId: userId, status: "Pending"}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredPersonalTickets(ticket.id); // mark expired
      return {id: ticket.id, patientId: userId, status: "Expired"};
    }

    return {id: ticket?.id, patientId: userId, status: ticket?.status}; // return scalar ID
  },

  _getUserPersonalRecordLog: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT upl.*
      FROM "UsersPersonalLog" AS upl
      WHERE upl."user_id" = $1
        AND upl.created_at >= $2
      ORDER BY upl.created_at DESC
      OFFSET $3 LIMIT $4;
    `;

    const result = await db.query(query, [
      userId,
      new Date(from), // parse DEFAULT_DATE_STRING or provided date
      offset || 0,
      limit || 10
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getBranchIdentifier: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT up.identifier, up.branch
        FROM "UsersPersonal" AS up
        JOIN "UserCredentials" AS uc
          ON up.id = uc.id
        WHERE up.id = $1
        ORDER BY uc.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );
    return result.rows[0] || null;
    },

  _getUserCredentialStatus: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const sql = `
      SELECT credentials_status AS status
      FROM "UserCredentials"
      WHERE id = $1
      LIMIT 1;
    `;
    const status = await db.query(sql, [userId]);
    return status.rows[0]?.status || null;
  },
};

const Mutation = {
  //continuation
  _PersonalRecordLog: async (_, { userId, input }, { user, res }) => {
    const query = `
      INSERT INTO "UsersPersonalLog" (
        user_id,
        first_name, middle_name, last_name, suffix,
        date_of_birth, sex, civil_status, nationality, religion,
        "contactNumber",
        present_address, province_address,
        status
        )
      VALUES (
        $1, 
        $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11,
        $12, $13,
        $14
      )
      RETURNING *;
    `;

    const pending = "Pending";
    const values = [
      userId,
      input.first_name, input.middle_name, input.last_name, input.suffix,
      input.date_of_birth, input.sex, input.civil_status, input.nationality, input.religion,
      input.contactNumber,
      input.present_address, input.province_address,
      pending
    ];

    try {
      const { rows } = await db.query(query, values);

      console.log("Created personal record log with ID:", rows[0]);
      return rows[0];
    } catch (err) {
      logger.error("Error in _PersonalRecordLog:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _UserBranchIdentifier: async (_, { userId, input }, { user, res }) => {
    if (!input.identifier || !input.branch) {
      throwGraphQLError(res).message("Both identifier and branch are required.").status(400).throw();
    }

    const query = `
      INSERT INTO "UsersPersonal" (id, identifier, branch)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        identifier = COALESCE(EXCLUDED.identifier, "UsersPersonal".identifier),
        branch = COALESCE(EXCLUDED.branch, "UsersPersonal".branch)
      RETURNING *;
    `;

    const values = [
      userId,
      input.identifier || null,
      input.branch || null
    ];

    try {
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (err) {
      logger.error("Error in _UserBranchIdentifier:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _setPersonalRecordLog: async (_, { userId, status }, { user, res }) => {
    const validStatuses = ["Revision", "Approved", "Rejected"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res).message("Invalid status").status(400).throw();
    }
    const BI = await Query._getBranchIdentifier(_, { userId }, { user, res });
    if (!(BI?.identifier && BI?.branch)) {
      throwGraphQLError(res).message("Branch identifier not set. Please notify the patient to set their branch identifier.").status(400).throw();
    }

    const query = `
      UPDATE "UsersPersonalLog"
      SET status = $1
      WHERE user_id = $2 AND status = 'Pending'
      RETURNING *;
    `;

      const { rows } = await db.query(query, [status, userId]);
      if (rows.length === 0) {
        return null;
      }

      if (status === "Approved") {
        logger.info(`Applying approved personal record update for user ${userId}, log ID ${rows[0].id}`);
        await applyUpdatePersonalRecord(_, { userId, input: rows[0] }, { res, db });
        }
        
      return rows[0].status;

  },

  _reloadCredentialStatus: async (_, { userId }, { user, res }) => {
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM "UsersPersonalLog" upl
        JOIN "patientUpdateLog" pul
          ON upl.user_id = pul."patientId"
        WHERE upl.user_id = $1
          AND upl.status = 'Approved'
          AND pul.status = 'Approved'
      );
    `;
    
    const result = await db.query(checkQuery, [userId]);
    if (result.rows[0].exists) {
      const updateQuery = `
        UPDATE "UserCredentials"
        SET credentials_status = 'Active'
        WHERE id = $1;
      `;
      await db.query(updateQuery, [userId]);
      return { success: true, message: "Credential status updated to Active." };
    } else {
      return { success: false, message: "User is not yet verified. Submit account and medical/dental information." };
    }
  },

  _cancelPersonalRecordLog: async (_, { userId }, { user, res }) => {
    const query = `
      UPDATE "UsersPersonalLog"
      SET status = 'Cancelled'
      WHERE user_id = $1 AND status = 'Pending'
      RETURNING status;
    `;

    try {
      const { rows } = await db.query(query, [userId]);
      if (rows.length === 0) {
        throwGraphQLError(res).message("No pending log found to cancel").status(404).throw();
      }
      return rows[0].status;
    } catch (err) {
      logger.error("Error in _cancelPersonalRecordLog:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _StaffUpdatePersonalRecordLog: async (_, { userId, id, input }, { user, res }) => {
    // Build dynamic SET clauses based on non-null input fields
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined) {
        fields.push(`"${key}" = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) {
      return { success: false, message: "No fields to update." };
    }

    // Add userId at the end for WHERE clause
    values.push(userId);
    values.push(id);
    const query = `
      UPDATE "UsersPersonalLog"
      SET ${fields.join(", ")}
      WHERE user_id = $${idx} AND id = $${idx + 1}
      RETURNING *;
    `;

    try {
      const { rows } = await db.query(query, values);
      if (rows.length === 0) {
        throwGraphQLError(res).message("No record found to update").status(404).throw();
      }
      return rows[0];
    } catch (err) {
      logger.error("Error in _StaffUpdatePersonalRecordLog:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

  _staffSetCredentialStatus: async (_, { userId, status, lockDays = 7 }, { user, res }) => {
    const validStatuses = ["locked", "active"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res).message("Invalid credential status").status(400).throw();
    }

    let query, params;
    console.log("Executing _staffSetCredentialStatus with params:", params);

    if (status === "locked") {
      query = `
        UPDATE "UserCredentials"
        SET credentials_status = $1,
            locked_until = NOW() + $3 * INTERVAL '1 day'
        WHERE id = $2
        AND credentials_status != 'Unverified'
        RETURNING credentials_status, locked_until;
      `;
      params = [status, userId, lockDays];
    } else {
      // status = "active"
      query = `
        UPDATE "UserCredentials"
        SET credentials_status = $1,
            locked_until = NULL
        WHERE id = $2
        AND credentials_status != 'Unverified'
        RETURNING credentials_status, locked_until;
      `;
      params = [status, userId];
    }

    
    try {
      const { rows } = await db.query(query, params);
      if (rows.length === 0) {
        throwGraphQLError(res).message("User not found").status(404).throw();
      }
      return rows[0];
    } catch (err) {
      logger.error("Error in _staffSetCredentialStatus:", err);
      throwGraphQLError(res).message("Database error").status(500).throw();
    }
  },

};

const applyUpdatePersonalRecord = async (_, { userId, input }, { user, res }) => {


  // Whitelist of allowed fields
  const allowedFields = [
    "first_name",
    "middle_name",
    "last_name",
    "suffix",
    "date_of_birth",
    "sex",
    "civil_status",
    "nationality",
    "religion",
    "contactNumber",
    "present_address",
    "province_address"
  ];

  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (allowedFields.includes(key) && value !== null && value !== undefined) {
      fields.push(`"${key}" = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) {
    throwGraphQLError(res).message("No valid fields to update").status(400).throw();
  }

  // Add userId for WHERE clause
  values.push(userId);

  const updateQuery = `
    UPDATE "UsersPersonal"
    SET ${fields.join(", ")}
    WHERE "id" = $${idx}
    RETURNING *;
  `;

  try {
    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      // No row found → insert new record with only allowed fields
      const insertFields = ["id", ...Object.keys(input)
        .filter(k => allowedFields.includes(k) && input[k] !== null && input[k] !== undefined)];
      const insertValues = [userId, ...insertFields.slice(1).map(f => input[f])];
      const placeholders = insertValues.map((_, i) => `$${i + 1}`);

      const insertQuery = `
        INSERT INTO "UsersPersonal" (${insertFields.map(f => `"${f}"`).join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING *;
      `;

      const insertResult = await db.query(insertQuery, insertValues);
      return insertResult.rows[0];
    }

    return result.rows[0];
  } catch (err) {
    logger.error("Error in applyUpdatePersonalRecord:", err);
    throwGraphQLError(res).message("Database error").status(500).throw();
  }
};


module.exports = { Query, Mutation };
