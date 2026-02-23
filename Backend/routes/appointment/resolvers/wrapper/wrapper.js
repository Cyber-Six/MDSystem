const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const { encodeSchedulingFlags, decodeSchedulingFlags, validateSchedulerDate,
  getAppointmentCounts, isWithinFutureTimeframe,
  validateSatisfiedAllRequirements,
  insertSlotCustomDates, insertSchedulerWhitelist } = require("./helper.js");


const MAX_SCHEDULING_DAYS = parseInt(dotenv.MAX_SCHEDULING_DAYS || 7);

const Query = {
  _listOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ss.*
      FROM "slotScheduler" ss
      WHERE ss."whitelistOnly" = false
         OR EXISTS (
           SELECT 1
           FROM "schedulerWhitelist" swl
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
      SELECT scd."scheduledDate"
      FROM "SlotCustomDate" scd
      WHERE scd."slotScheduleId" = $1
      ORDER BY scd."scheduledDate" ASC
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

    // Timeframe validation
    if (!isWithinFutureTimeframe(date, MAX_SCHEDULING_DAYS)) {
      const today = new Date();
      const latestAllowed = new Date(today);
      latestAllowed.setDate(today.getDate() + MAX_SCHEDULING_DAYS);

      throwGraphQLError(res)
        .message(`Scheduling is only allowed from ${today.toISOString().split("T")[0]} up to ${latestAllowed.toISOString().split("T")[0]}`)
        .status(400)
        .throw();
    }

    // Scheduler/date validation
    const isValidDate = await validateSchedulerDate(schedulerId, date);
    if (!isValidDate) {
      throwGraphQLError(res).message("Invalid date for scheduler").status(400).throw();
    }

    // Step 1: Try to fetch existing schedule (respect staff edits)
    const existingResult = await db.query(
      `SELECT sde.*
       FROM "ScheduleDateEntity" sde
       WHERE sde."slotId" = $1 AND sde."scheduledDate" = $2;`,
      [schedulerId, date]
    );

    if (existingResult.rowCount > 0) { // Schedule exists → return it with counts
      const schedule = existingResult.rows[0];
      schedule.schedulePerWeek = decodeSchedulingFlags(schedule.scheduleFlags);

      const counts = await getAppointmentCounts(schedulerId, date);
      return { ...schedule, ...counts };
    }

    // Step 2: No schedule exists → fetch defaults from SlotScheduler
    const schedulerResult = await db.query(
      `SELECT "morningAllowed", "afternoonAllowed"
       FROM "slotScheduler"
       WHERE id = $1;`,
      [schedulerId]
    );

    if (schedulerResult.rowCount === 0) {
      throwGraphQLError(res).message("Scheduler not found").status(404).throw();
    }

    const { morningAllowed, afternoonAllowed } = schedulerResult.rows[0];

    // Step 3: Insert new schedule with defaults
    const newScheduleResult = await db.query(
      `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [schedulerId, date, morningAllowed, afternoonAllowed]
    );

    if (newScheduleResult.rowCount === 0) {
      throwGraphQLError(res).message("Failed to create schedule for the date").status(500).throw();
    }

    const newSchedule = newScheduleResult.rows[0];
    newSchedule.schedulePerWeek = decodeSchedulingFlags(newSchedule.scheduleFlags);

    // Step 4: Return with zero counts for a fresh schedule
    return {
      ...newSchedule,
      morningRegistered: 0,
      afternoonRegistered: 0,
      morningPending: 0,
      afternoonPending: 0
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
        AND (COALESCE($4::boolean, sr."isActive") = sr."isActive")
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
      ORDER BY ps.id DESC
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
      ORDER BY ps.id DESC
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
      SELECT ps.*, ss.location
      FROM "patientSlot" ps
      JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
      JOIN "slotScheduler" ss ON ss.id = sde."slotId"

      WHERE ps.status = $1
      ORDER BY ps.id DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [status, limit || 10, offset || 0]);
    return result.rows;
  }
};

const Mutation = {
  _submitAppointment: async (_, { schedulerId, date, session, requirements }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // 1. Validate scheduler/date and session availability
    const scheduleData = await Query._listAppointmentSchedule(_, { schedulerId, date }, { user, res });
    if (session === "Morning" && scheduleData.morningAllowed <= scheduleData.morningRegistered) {
      throwGraphQLError(res).message("Morning session already full for the selected date").status(400).throw();
    } else if (session === "Afternoon" && scheduleData.afternoonAllowed <= scheduleData.afternoonRegistered) {
      throwGraphQLError(res).message("Afternoon session already full for the selected date").status(400).throw();
    }

    // 2. Ensure requirements are satisfied
    await validateSatisfiedAllRequirements(schedulerId, requirements, db, res);

    // 3. Create patientSlot row
    const psResult = await db.query(
      `INSERT INTO "patientSlot" ("patientId", "slotEntityId", "status", "session")
       VALUES ($1, $2, 'Pending', $3)
       RETURNING id;`,
      [user.id, scheduleData.id, session]
    );

    if (psResult.rowCount === 0) {
      throwGraphQLError(res).message("Failed to create appointment").status(500).throw();
    }

    const patientSlotId = psResult.rows[0].id;

    // 4. Insert patientScheduleRequirement rows (one per requirement)
    if (requirements && requirements.length > 0) {
      const values = [];
      const placeholders = requirements.map((req, i) => {
        if (!req.scheduleRequirementId) {
          throwGraphQLError(res)
            .message(`Requirement at index ${i} missing scheduleRequirementId`)
            .status(400)
            .throw();
        }
        const offset = i * 3;
        values.push(patientSlotId, req.scheduleRequirementId, req.filename || null);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
      });

      await db.query(
        `INSERT INTO "patientScheduleRequirement" ("patientSlotId", "scheduleRequirementId", "filename")
         VALUES ${placeholders.join(", ")};`,
        values
      );
    }

    return psResult.rows[0];
  },

  _cancelAppointment: async (_, { patientId, cancelledBy, slotId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    // 1. Decide cancellation status
    const newStatus = patientId === cancelledBy ? "CancelledByPatient" : "CancelledByMedical";

    // 2. Get the latest appointment record for this patient
    const updateResult = await db.query(
      `UPDATE "patientSlot" SET status = $1 WHERE id = $2;`,
      [newStatus, slotId]
    );

    if (updateResult.rowCount === 0) {
      throwGraphQLError(res).message("Failed to cancel appointment").status(500).throw();
    }

    return { success: true };
  },

  _respondAppointment: async (_, { slotId, status, notes }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const validStatuses = ["Scheduled", "Rejected"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res)
        .message(`Invalid status. Must be one of: ${validStatuses.join(", ")}`)
        .status(400)
        .throw();
    }

    // Step 1: Check current slot status
    const { rows } = await db.query(
      `SELECT status FROM "patientSlot" WHERE id = $1;`,
      [slotId]
    );

    if (rows.length === 0) {
      throwGraphQLError(res).message("Slot not found").status(404).throw();
    }

    if (rows[0].status !== "Pending") {
      throwGraphQLError(res)
        .message("Slot status must be Pending to respond")
        .status(400)
        .throw();
    }

    // Step 2: Perform update
    const updateResult = await db.query(
      `UPDATE "patientSlot" SET status = $1, notes = $2 WHERE id = $3;`,
      [status, notes || null, slotId]
    );

    return updateResult.rowCount > 0;
  },

  _recordAppointmentAttendance: async (_, { slotId, arrived_at }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Step 1: Check current slot status
    const { rows } = await db.query(
      `SELECT status FROM "patientSlot" WHERE id = $1;`,
      [slotId]
    );

    if (rows.length === 0) {
      throwGraphQLError(res).message("Slot not found").status(404).throw();
    }

    if (rows[0].status !== "Scheduled") {
      throwGraphQLError(res)
        .message("Slot status must be Scheduled to record attendance")
        .status(400)
        .throw();
    }
    
    // Step 2: Perform update
    const updateResult = await db.query(
      `UPDATE "patientSlot" SET status = 'InProgress', arrived_at = $1 WHERE id = $2;`,
      [arrived_at, slotId]
    );

    return updateResult.rowCount > 0;
  },

  _createScheduler: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect(); // get a dedicated client
    try {
      await client.query("BEGIN");

      const encodedScheduleFlags = encodeSchedulingFlags(input.schedulePerWeek);
      if (encodedScheduleFlags === -1) {
        throwGraphQLError(res).message("Invalid schedule days").status(400).throw();
      }

      const result = await client.query(
        `INSERT INTO "slotScheduler"
          (label, location, "scheduleFlags", "morningAllowed", "afternoonAllowed", "whitelistOnly", "containsCustomDates", notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;`,
        [
          input.label,
          input.location,
          encodedScheduleFlags,
          input.morningAllowed,
          input.afternoonAllowed,
          input.whitelistOnly || false,
          input.slotCustomDates.length > 0,
          input.notes || null,
        ]
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res).message("Failed to create scheduler").status(500).throw();
      }

      const schedulerId = result.rows[0].id;

      // Use the same client inside transaction
      await insertSlotCustomDates(schedulerId, input.slotCustomDates || [], client);
      await insertSchedulerWhitelist(schedulerId, input.whiteLists || [], client);

      await client.query("COMMIT");

      const scheduler = result.rows[0];
      scheduler.schedulePerWeek = decodeSchedulingFlags(scheduler.scheduleFlags);
      return scheduler;
    } catch (err) {
      await client.query("ROLLBACK");
      throwGraphQLError(res).message("Transaction failed: " + err.message).status(500).throw();
    } finally {
      client.release();
    }
  },

  _updateScheduler: async (_, { schedulerId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Collect fields to update
    const fields = [];
    const values = [];
    let idx = 1;

    if (input.label !== undefined && input.label !== null) {
      fields.push(`label = $${idx++}`);
      values.push(input.label);
    }

    if (input.location !== undefined && input.location !== null) {
      fields.push(`location = $${idx++}`);
      values.push(input.location);
    }

    if (input.schedulePerWeek !== undefined && input.schedulePerWeek !== null) {
      const encodedScheduleFlags = encodeSchedulingFlags(input.schedulePerWeek);
      if (encodedScheduleFlags === -1) {
        throwGraphQLError(res).message("Invalid schedule days").status(400).throw();
      }
      fields.push(`scheduleFlags = $${idx++}`);
      values.push(encodedScheduleFlags);
    }

    if (input.morningAllowed !== undefined && input.morningAllowed !== null) {
      fields.push(`"morningAllowed" = $${idx++}`);
      values.push(input.morningAllowed);
    }

    if (input.afternoonAllowed !== undefined && input.afternoonAllowed !== null) {
      fields.push(`"afternoonAllowed" = $${idx++}`);
      values.push(input.afternoonAllowed);
    }

    if (input.whitelistOnly !== undefined && input.whitelistOnly !== null) {
      fields.push(`"whitelistOnly" = $${idx++}`);
      values.push(input.whitelistOnly);
    }

    if (input.isActive !== undefined && input.isActive !== null) {
      fields.push(`"isActive" = $${idx++}`);
      values.push(input.isActive);
    }

    if (input.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(input.notes);
    }

    if (fields.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    values.push(schedulerId);

    const query = `
      UPDATE "slotScheduler"
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to update scheduler").status(500).throw();
    }

    const scheduler = result.rows[0];
    scheduler.schedulePerWeek = decodeSchedulingFlags(scheduler.scheduleFlags);
    return scheduler;
  },

  _deleteScheduler: async (_, { schedulerId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
      `DELETE FROM "slotScheduler" WHERE id = $1;`,
      [schedulerId]
    );

    return result.rowCount > 0;
  },

  _updateSchedulerRequirement: async (_, { schedulerId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    } 
    const fields = [];
    const values = [];
    let idx = 1;
    
    if (input.label !== undefined && input.label !== null) {
      fields.push(`label = $${idx++}`);
      values.push(input.label);
    }

    if (input.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(input.notes);
    }

    if (input.isDigital !== undefined && input.isDigital !== null) {
      fields.push(`"isDigital" = $${idx++}`);
      values.push(input.isDigital);
    }

    if (input.isActive !== undefined && input.isActive !== null) {
      fields.push(`"isActive" = $${idx++}`);
      values.push(input.isActive);
    }

    if (fields.length === 0) {
      throwGraphQLError(res).message("No fields to update").status(400).throw();
    }

    values.push(schedulerId);

    const query = `
      UPDATE "scheduleRequirement"
      SET ${fields.join(", ")}
      WHERE slotId = $${idx}
      RETURNING *;
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to update scheduler requirement").status(500).throw();
    }

    return result.rows[0];
  },

  _deleteSchedulerRequirement: async (_, { schedulerId, label }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await db.query(
      `DELETE FROM "scheduleRequirement" WHERE slotId = $1 AND label = $2;`,
      [schedulerId, label]
    );

    return result.rowCount > 0;
  },

  _setCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!schedulerId || !Array.isArray(dates) || dates.length === 0) {
      throwGraphQLError(res)
        .message("Invalid schedulerId or empty dates list")
        .status(400)
        .throw();
    }

    // Build placeholders and values for batch insert
    const values = [];
    const placeholders = dates.map((date, i) => {
      const offset = i * 2;
      values.push(schedulerId, date);
      return `($${offset + 1}, $${offset + 2})`;
    });

    const query = `
      INSERT INTO "SlotCustomDate" ("slotScheduleId", "scheduledDate")
      VALUES ${placeholders.join(", ")}
      RETURNING "scheduledDate";
    `;

    try {
      const result = await db.query(query, values);
      return result.rows.map(r => r.scheduledDate);
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to set custom dates: ${err.message}`)
        .status(500)
        .throw();
    }
  },

  _unsetCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!schedulerId || !Array.isArray(dates) || dates.length === 0) {
      throwGraphQLError(res)
        .message("Invalid schedulerId or empty dates list")
        .status(400)
        .throw();
    }

    try {
      const result = await db.query(
        `DELETE FROM "SlotCustomDate"
         WHERE "slotScheduleId" = $1
         AND "scheduledDate" = ANY($2)
         RETURNING "scheduledDate";`,
        [schedulerId, dates]
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res)
          .message("No matching custom dates found to unset")
          .status(404)
          .throw();
      }

      // Return the list of dates that were actually deleted
      return result.rows.map(r => r.scheduledDate);
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to unset custom dates: ${err.message}`)
        .status(500)
        .throw();
    }
  },

  _addEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!schedulerId || !Array.isArray(patientIds) || patientIds.length === 0) {
      throwGraphQLError(res)
        .message("Invalid schedulerId or empty patientIds list")
        .status(400)
        .throw();
    }

    try {
      // Build placeholders and values for batch insert
      const values = [];
      const placeholders = patientIds.map((pid, i) => {
        const offset = i * 2;
        values.push(schedulerId, pid);
        return `($${offset + 1}, $${offset + 2})`;
      });

      const query = `
        INSERT INTO "schedulerWhitelist" ("slotSchedulerId", "patientId")
        VALUES ${placeholders.join(", ")}
        RETURNING "patientId";
      `;

      const result = await db.query(query, values);

      if (result.rowCount === 0) {
        throwGraphQLError(res)
          .message("Failed to add whitelist entries")
          .status(500)
          .throw();
      }

      // Return the list of patient IDs that were actually inserted
      return result.rows.map(r => r.patientId);
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to add whitelist entries: ${err.message}`)
        .status(500)
        .throw();
    }
  },

  _removeEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!schedulerId || !Array.isArray(patientIds) || patientIds.length === 0) {
      throwGraphQLError(res)
        .message("Invalid schedulerId or empty patientIds list")
        .status(400)
        .throw();
    }

    try {
      const result = await db.query(
        `DELETE FROM "schedulerWhitelist"
         WHERE "slotSchedulerId" = $1
         AND "patientId" = ANY($2)
         RETURNING "patientId";`,
        [schedulerId, patientIds]
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res)
          .message("No matching whitelist entries found to remove")
          .status(404)
          .throw();
      }

      // Return the list of patient IDs that were actually removed
      return result.rows.map(r => r.patientId);
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to remove whitelist entries: ${err.message}`)
        .status(500)
        .throw();
    }
  },

  _updateDateIdentity: async (_, { schedulerId, date, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    try {
      // Build dynamic update fields based on provided input
      const fields = [];
      const values = [];
      let idx = 1;

      if (input.morningAllowed !== undefined) {
        fields.push(`"morningAllowed" = $${idx++}`);
        values.push(input.morningAllowed);
      }
      if (input.afternoonAllowed !== undefined) {
        fields.push(`"afternoonAllowed" = $${idx++}`);
        values.push(input.afternoonAllowed);
      }
      if (input.allowDuring !== undefined) {
        fields.push(`"allowDuring" = $${idx++}`);
        values.push(input.allowDuring);
      }
      if (input.scheduledDate !== undefined) {
        fields.push(`"scheduledDate" = $${idx++}`);
        values.push(input.scheduledDate);
      }

      if (fields.length === 0) {
        throwGraphQLError(res)
          .message("No fields provided to update")
          .status(400)
          .throw();
      }

      // Add schedulerId and date filters
      values.push(schedulerId);
      values.push(date);

      const query = `
        UPDATE "ScheduleDateEntity"
        SET ${fields.join(", ")}
        WHERE "slotId" = $${idx++} AND "scheduledDate" = $${idx++}
        RETURNING *;
      `;

      const result = await db.query(query, values);

      if (result.rowCount === 0) {
        throwGraphQLError(res)
          .message("No matching schedule date entity found to update")
          .status(404)
          .throw();
      }

      return result.rows[0];
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to update schedule date entity: ${err.message}`)
        .status(500)
        .throw();
    }
  }

};  


module.exports = { Query, Mutation };
