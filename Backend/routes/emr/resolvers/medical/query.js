const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days


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