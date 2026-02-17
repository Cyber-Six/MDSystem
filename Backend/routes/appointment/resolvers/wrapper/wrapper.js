const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const { decodeSchedulingFlags, validateSchedulerDate,
  getAppointmentCounts, isWithinFutureTimeframe } = require("./helper.js");


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

  _listAllOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ss.*
      FROM "slotScheduler" ss
      ORDER BY ss.created_at ASC
      LIMIT $1 OFFSET $2;
    `;

    const result = await db.query(query, [
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

  _listAppointmentSchedule: async (_, { schedulerId, date }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    if (!isWithinFutureTimeframe(date, MAX_SCHEDULING_DAYS)) {
      const today = new Date();
      const latestAllowed = new Date(today);
      latestAllowed.setDate(today.getDate() + MAX_SCHEDULING_DAYS);

      throwGraphQLError(res)
        .message(`Scheduling is only allowed from ${today.toISOString().split("T")[0]} up to ${latestAllowed.toISOString().split("T")[0]}`)
        .status(400)
        .throw();
    }


    const isValidDate = await validateSchedulerDate(schedulerId, date);
    if (!isValidDate) {
      throwGraphQLError(res).message("Invalid date for scheduler").status(400).throw();
    }

    // Try to fetch existing schedule
    const query = `
      SELECT sde.*
      FROM "SlotScheduler" ss
      JOIN "ScheduleDateEntity" sde ON sde."slotId" = ss.id
      WHERE ss.id = $1 AND sde."scheduledDate" = $2
    `;
    const result = await db.query(query, [schedulerId, date]);

    if (result.rowCount > 0) {
      result.rows[0].schedulePerWeek = decodeSchedulingFlags(result.rows[0].scheduleFlags);
      return { ...result.rows[0], ...await getAppointmentCounts(schedulerId, date) };
    }

    const queryScheduler = `
      SELECT morningAllowed, afternoonAllowed
      FROM "SlotScheduler" ss
      WHERE ss.id = $1;
    `;

    const schedulerResult = await db.query(queryScheduler, [schedulerId]);
    if (schedulerResult.rowCount === 0) {
      throwGraphQLError(res).message("Scheduler not found").status(404).throw();
    }

    const { morningAllowed, afternoonAllowed } = schedulerResult.rows[0];

    const newSchedule = await db.query(`
      INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [schedulerId, date, morningAllowed, afternoonAllowed]);

    if (newSchedule.rowCount === 0) {
      throwGraphQLError(res).message("Failed to create schedule for the date").status(500).throw();
    }

    return { ...newSchedule.rows[0], 
      morningRegistered: 0, afternoonRegistered: 0,
      morningPending: 0, afternoonPending: 0
    };
  },

  _listAllAppointmentRequirements: async (_, { schedulerId, offset, limit, isActive }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT *
      FROM "scheduleRequirement" sr
      WHERE sr."slotId" = $1
        AND ($4 IS NULL OR sr."isActive" = $4)
      ORDER BY sr.label ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      schedulerId,
      limit || 10,
      offset || 0,
      isActive // can be true, false, or null
    ]);
    return result.rows;
  },

  _getUserAppointmentRecords: async (_, { userId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Fetch the patient slots
    const querySlots = `
      SELECT ps.*
      FROM "patientSlot" ps
      WHERE ps."patientId" = $1
      ORDER BY ps.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const slotResult = await db.query(querySlots, [userId, limit || 10, offset || 0]);
    if (slotResult.rowCount === 0) {
      return [];
    }

    const slots = slotResult.rows;

    // Collect slot IDs
    const slotIds = slots.map(s => s.id);
    if (slotIds.length === 0) {
      return slots.map(s => ({ ...s, requirements: [] }));
    }

    // Fetch requirements for those slots
    const queryRequirements = `
      SELECT psr.*
      FROM "patientScheduleRequirement" psr
      WHERE psr."patientSlotId" = ANY($1);
    `;
    const reqResult = await db.query(queryRequirements, [slotIds]);

    // Group requirements by patientSlotId
    const requirementsBySlot = {};
    for (const req of reqResult.rows) {
      if (!requirementsBySlot[req.patientSlotId]) {
        requirementsBySlot[req.patientSlotId] = [];
      }
      requirementsBySlot[req.patientSlotId].push(req);
    }

    // Merge requirements into slot records
    const records = slots.map(slot => ({
      ...slot,
      requirements: requirementsBySlot[slot.id] || []
    }));

    return records;
  },

  _getUserAppointmentStatus: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ps.status
      FROM "patientSlot" ps
      WHERE ps."patientId" = $1
      ORDER BY ps.created_at DESC
      LIMIT 1;
    `;

    const result = await db.query(query, [userId]);
    if (result.rowCount === 0) {
      return null; // No appointments found
    }
    return result.rows[0].status;
  },

  _searchAppointmentStatuses: async (_, { status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ps.*
      FROM "patientSlot" ps
      WHERE ps.status = $1
      ORDER BY ps.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [status, limit || 10, offset || 0]);
    return result.rows;
  }
};

const Mutation = {
};


module.exports = { Query, Mutation };
