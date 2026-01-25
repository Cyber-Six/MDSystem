const db  = require("../../../config/query.js");

const { upsertEmergencyNumber, upsertAllergenCatalog,
  upsertDomainCatalog } = require("../query/upsert.js");

const anchor = require("../query/anchor.js");
const remove = require("../query/delete.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { get } = require("http");
const { create } = require("domain");
const Mutation = require("./mutation.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days


const Query = {
  getUpdateTicket: async (_, {}, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT log.id, log.status, log.created_at
        FROM "patientUpdateLog" AS log
        JOIN "Patients" AS p ON p.id = log."patientId"
        WHERE p.id = $1
        ORDER BY log.created_at DESC
        LIMIT 1;
        `,
      [user.id]
      );
     
    const ticket = result.rows[0];

    if (ticket && ticket.status.toLowerCase() === "in-progress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(user.id))) {
        return {id: ticket.id, status: "Inprogress"}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return {id: ticket.id, status: "Expired"};
    }

    return {id: ticket?.id, status: ticket?.status}; // return scalar ID
  },

  getProfile: async (_, args, {user, logId}) => {
    if (!user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    await db.query("", [user.id, logId]);
    // Example: return a student profile
    return { id: "1", program: "BSCS", year: "FIRST" };
  },
};

module.exports = Query;