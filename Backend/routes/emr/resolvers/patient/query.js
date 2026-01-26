const db  = require("../../../../config/query.js");

const { upsertEmergencyNumber, upsertAllergenCatalog,
  upsertDomainCatalog } = require("../../query/upsert.js");

const anchor = require("../../query/anchor.js");
const remove = require("../../query/delete.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { get } = require("http");
const { create } = require("domain");
const Mutation = require("./mutation.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days
const DEFAULT_DATE_STRING = '1970-01-01T00:00:00Z';

const Query = {
  getUpdateTicket: async (_, {}, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT log.id, log.status, log.scope, log.created_at
        FROM "patientUpdateLog" AS log
        JOIN "Patients" AS p ON p.id = log."patientId"
        WHERE p.id = $1
        ORDER BY log.created_at DESC
        LIMIT 1;
        `,
      [user.id]
      );
     
    const ticket = result.rows[0];

    if (ticket && ticket.status === "InProgress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(user.id))) {
        return {id: ticket.id, status: "InProgress", scope: ticket.scope}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return {id: ticket.id, status: "Expired", scope: ticket.scope};
    }

    return {id: ticket?.id, status: ticket?.status, scope: ticket?.scope}; // return scalar ID
  },


  getUserProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT pr.id, pr.profile_type,
             sp.program, sp.year,
             sp.guardian_name, sp.guardian_relation, sp.guardian_contact,
             ep.department, ep.role, ep.position,
             pul.created_at, pul."patientId"
      FROM "profileRecord" pr
      LEFT JOIN "patientUpdateLog" pul ON pul.id = pr.id
      LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
      LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      from || new Date(0)
    ]);

    if (result.rows.length === 0) return [];

    return result.rows.map(row => {
      if (row.profile_type === "Student") {
        return {
          __typename: "StudentProfile",
          id: row.id,
          profile_type: row.profile_type,
          program: row.program,
          year: row.year,
          guardian_name: row.guardian_name,
          guardian_relation: row.guardian_relation,
          guardian_contact: row.guardian_contact,
          created_at: row.created_at,
        };
      } else if (row.profile_type === "Employee") {
        return {
          __typename: "EmployeeProfile",
          id: row.id,
          department: row.department,
          role: row.role,
          position: row.position,
          created_at: row.created_at,
        };
      }
      return null;
    });
  },

  getUserDentalPhotos: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dpr.*, pul.created_at
      FROM "DentalPhotoRecord" dpr
      JOIN "patientUpdateLog" pul ON pul.id = dpr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  getUserObgynHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ogh.*, pul.created_at
      FROM "ObGynHistory" ogh
      JOIN "patientUpdateLog" pul ON pul.id = ogh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

// -------------------------------------- restart testing from here ------------------------------

  getUserLifestyle: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ls.*, pul.created_at
      FROM "Lifestyle" ls
      JOIN "patientUpdateLog" pul ON pul.id = ls.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  getDentalHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dh.*, pul.created_at
      FROM "DentalHistory" dh
      JOIN "patientUpdateLog" pul ON pul.id = dh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  getDentalRecords: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dr.*, pul.created_at
      FROM "DentalRecord" dr
      JOIN "patientUpdateLog" pul ON pul.id = dr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },
};

module.exports = Query;