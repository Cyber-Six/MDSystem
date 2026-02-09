const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { log } = require("console");
const { create } = require("domain");
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
       `SELECT up.*
        FROM "usersPersonal" AS up
        WHERE up."id" = $1
        ORDER BY up.created_at DESC
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
        return {id: ticket.id, patientId: userId, status: "Pending", scope: ticket.scope}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredPersonalTickets(ticket.id); // mark expired
      return {id: ticket.id, patientId: userId, status: "Expired", scope: ticket.scope};
    }

    return {id: ticket?.id, patientId: userId, status: ticket?.status, scope: ticket?.scope}; // return scalar ID
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
    logger.debug("User Personal Record Log Query Result:", result.rows);
    return result.rows;
  },

  _getUserAnchorData: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT up.id, up.email, up."entityId"
        FROM "UsersPersonal" AS up
        WHERE up.id = $1
        ORDER BY up.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );
    return result.rows[0] || null;
    },
};

const Mutation = {
  _applyUpdatePersonalRecord: async (_, { userId, input }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Build dynamic SET clause for non-null fields
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
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    // Add userId for WHERE clause
    values.push(userId);

    const query = `
      UPDATE "UsersPersonal"
      SET ${fields.join(", ")}
      WHERE "id" = $${idx}
      RETURNING *;
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throwGraphQLError(res).message("Profile not found").status(404).throw();
    }

    return result.rows[0];
  },
  //continuation
  _createPersonalRecordLog: async (_, { input }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    }
};