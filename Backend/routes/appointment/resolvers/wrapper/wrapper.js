const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const { decodeSchedulingFlags } = require("./helper.js");


const MAX_SCHEDULING_DAYS = parseInt(dotenv.MAX_SCHEDULING_DAYS || 7);

const Query = {
  _listOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ss.*
      FROM "slotScheduler" ss
      WHERE ss.whitelistOnly = false
         OR EXISTS (
           SELECT 1
           FROM "schedulerWhiteList" swl
           WHERE swl."slotSchedulerId" = ss.id
             AND swl."patientId" = $1
         )
      ORDER BY ss.created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      user.id,
      limit || 10,
      offset || 0
    ]);
    result.rows.forEach(row => {
      row.schedulePerWeek = decodeSchedulingFlags(row.scheduleFlags);
    });
    return result.rows;
  },

  _listCustomDates: async (_, { schedulerId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const query = `
      SELECT scd.scheduledDate
      FROM "SlotCustomDate" scd
      WHERE scd."slotSchedulerId" = $1
      ORDER BY scd.scheduledDate ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      schedulerId,
      limit || 10,
      offset || 0
    ]);
    
    return result.rows.map(row => row.scheduledDate);
  },

  _listAppointmentSchedules: async (_, { schedulerId, date }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const query = `
      SELECT ps.*, ss.*
      FROM "patientSchedule" ps
      JOIN "slotScheduler" ss ON ps."slotSchedulerId" = ss.id
      WHERE ps."slotSchedulerId" = $1
        AND ps.scheduledDate = $2
      ORDER BY ps.created_at ASC;
    `;

    const result = await db.query(query, [schedulerId, date]);
    return result.rows;
  },
};

const Mutation = {
};


module.exports = { Query, Mutation };
