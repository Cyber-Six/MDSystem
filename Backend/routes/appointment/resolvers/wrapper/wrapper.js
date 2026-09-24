const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const { promoteFile, deleteFile } = require("../../../../config/multer.js");
const { encodeSchedulingFlags, decodeSchedulingFlags, validateSchedulerDate,
  getAppointmentCounts, isWithinFutureTimeframe,
  validateSatisfiedAllRequirements,
  insertSlotCustomDates, insertSchedulerWhitelist } = require("./helper.js");


const MAX_SCHEDULING_DAYS = parseInt(dotenv.MAX_SCHEDULING_DAYS || 7);

/**
 * Returns true if the given YYYY-MM-DD date string is strictly before today (server local date).
 * Today itself is NOT considered past — only dates < today are blocked.
 */
function isPastDate(dateStr) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return String(dateStr).slice(0, 10) < todayStr;
}

const Query = {
  _listOpenAppointments: async (_, { offset, limit, schedulerId = null }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const userBranch = await db.getUserBranch(user.id);
    const userPatientType = await db.getUserPatientType(user.id);
    const query = `
      SELECT ss.*
      FROM "slotScheduler" ss
      WHERE ss."isActive" = true
        AND ss.id = COALESCE($6, ss.id) -- Optional schedulerId filter for submitAppointment resolver
        AND (
              ss."patientType" IS NULL
              OR ss."patientType" = $5
              )
        AND (
              $4 = 'Both'
           OR ($4 = 'Manila' AND ss.location IN ('Arlegui', 'Casal'))
           OR ($4 = 'QuezonCity' AND ss.location = 'QuezonCity')
            )
        AND (
              ss."whitelistOnly" = false
           OR EXISTS (
                SELECT 1
                FROM "schedulerWhitelist" swl
                WHERE swl."slotSchedulerId" = ss.id
                  AND swl."patientId" = $1
              )
            )
      ORDER BY ss.created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      user.id,
      limit || 10,
      offset || 0,
      userBranch,
      userPatientType,
      schedulerId
    ]);
    result.rows.forEach(row => {
      row.schedulePerWeek = decodeSchedulingFlags(row.scheduleFlags);
    });
    return result.rows;
  },

  _listAllOpenAppointments: async (_, { location, staffBranch = 'Both', offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const query = `
      SELECT ss.*
      FROM "slotScheduler" ss
      WHERE (
        $4 = 'Both'
        OR ($4 = 'Manila'      AND ss.location IN ('Arlegui', 'Casal'))
        OR ($4 = 'QuezonCity'  AND ss.location = 'QuezonCity')
      )
      AND ss.location = COALESCE($1::"LocationDesignation", ss.location)
      ORDER BY ss.created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      location,
      limit || 10,
      offset || 0,
      staffBranch,
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
      SELECT
        scd.id,
        scd."slotScheduleId",
        scd."scheduledDate",
        scd."type",
        sde."morningAllowed",
        sde."afternoonAllowed",
        scd.created_at
      FROM "SlotCustomDate" scd
      LEFT JOIN "ScheduleDateEntity" sde
        ON sde."slotId" = scd."slotScheduleId" AND sde."scheduledDate" = scd."scheduledDate"
      WHERE scd."slotScheduleId" = $1
      ORDER BY scd."scheduledDate" ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      schedulerId,
      limit || 500,
      offset || 0
    ]);

    return result.rows;
  },

  _listAppointmentSchedule: async (_, { schedulerId, date, skipTimeframe }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Timeframe validation (skipped for medical/staff callers)
    if (!skipTimeframe && !isWithinFutureTimeframe(date, MAX_SCHEDULING_DAYS)) {
      const today = new Date();
      const latestAllowed = new Date(today);
      latestAllowed.setDate(today.getDate() + MAX_SCHEDULING_DAYS);

      throwGraphQLError(res)
        .message(`Scheduling is only allowed from ${today.toISOString().split("T")[0]} up to ${latestAllowed.toISOString().split("T")[0]}`)
        .status(400)
        .throw();
    }

    // Scheduler/date validation (skipped for medical/staff callers)
    if (!skipTimeframe) {
      const isValidDate = await validateSchedulerDate(schedulerId, date);
      if (!isValidDate) {
        throwGraphQLError(res).message("Invalid date for scheduler").status(400).throw();
      }
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

    // Step 3: Insert new schedule with defaults (WHERE NOT EXISTS guards against race conditions)
    const newScheduleResult = await db.query(
      `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM "ScheduleDateEntity"
         WHERE "slotId" = $1 AND "scheduledDate" = $2
       )
       RETURNING *;`,
      [schedulerId, date, morningAllowed, afternoonAllowed]
    );

    // If insert returned nothing, another request created it first — fetch it
    const newSchedule = newScheduleResult.rowCount > 0
      ? newScheduleResult.rows[0]
      : (await db.query(
          `SELECT * FROM "ScheduleDateEntity" WHERE "slotId" = $1 AND "scheduledDate" = $2;`,
          [schedulerId, date]
        )).rows[0];

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
      isActive, // can be true, false, or null
    ]);
    return result.rows;
  },

  _getUserAppointmentRecords: async (_, { userId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Fetch the patient slots (with identifier + name from UsersPersonal)
    const querySlots = `
      SELECT ps.*,
        up."identifier" AS "patientIdentifier",
        CONCAT(up.first_name, ' ', up.last_name) AS "patientName",
        CONCAT(staff.first_name, ' ', staff.last_name) AS "approvedBy"
      FROM "patientSlot" ps
      LEFT JOIN "UsersPersonal" up ON up.id = ps."patientId"
      LEFT JOIN "UsersPersonal" staff ON staff.id = ps."approvedBy"
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

  _searchAppointmentStatuses: async (_, { status, location, staffBranch = 'Both', date, schedulerId, searchTerm, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const normalizedSearchTerm = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    const hasSearchTerm = normalizedSearchTerm.length >= 2;
    const prefixTerm = hasSearchTerm ? `${normalizedSearchTerm}%` : null;
    const anyTerm = hasSearchTerm ? `%${normalizedSearchTerm}%` : null;
    const tokens = hasSearchTerm ? normalizedSearchTerm.split(/\s+/).filter(Boolean) : [];
    const hasTwoTokens = tokens.length >= 2;
    const token1Any = hasTwoTokens ? `%${tokens[0]}%` : null;
    const token2Any = hasTwoTokens ? `%${tokens[1]}%` : null;

    const query = `
      SELECT ps.*, ss.location, ss.label AS "schedulerLabel",
        sde."scheduledDate",
        up."identifier" AS "patientIdentifier",
        p.profile AS "patientProfileType",
        CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')) AS "patientName",
        uc.email AS "patientEmail",
        CONCAT(staff.first_name, ' ', staff.last_name) AS "approvedBy"
      FROM "patientSlot" ps
      JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
      JOIN "slotScheduler" ss ON ss.id = sde."slotId"
      LEFT JOIN "UsersPersonal" up ON up.id = ps."patientId"
      LEFT JOIN "Patients" p ON p.id = ps."patientId"
      LEFT JOIN active_user_credentials uc ON uc.id = ps."patientId"
      LEFT JOIN "UsersPersonal" staff ON staff.id = ps."approvedBy"

      WHERE ps.status = $1
      AND (
        $7 = 'Both'
        OR ($7 = 'Manila'      AND ss.location IN ('Arlegui', 'Casal'))
        OR ($7 = 'QuezonCity'  AND ss.location = 'QuezonCity')
      )
      AND ss.location = COALESCE($4::"LocationDesignation", ss.location)
      AND ($5::date IS NULL OR sde."scheduledDate"::date = $5::date)
      AND ($6::integer IS NULL OR ss.id = $6::integer)
      AND (
        $8::boolean = false
        OR up.identifier::text ILIKE $9
        OR (COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')) ILIKE $10
        OR (COALESCE(up.last_name, '') || ', ' || COALESCE(up.first_name, '')) ILIKE $10
        OR COALESCE(up.first_name, '') ILIKE $10
        OR COALESCE(up.last_name, '') ILIKE $10
        OR COALESCE(uc.email, '') ILIKE $10
        OR (
          $13::boolean = true AND (
            (COALESCE(up.first_name, '') ILIKE $11 AND COALESCE(up.last_name, '') ILIKE $12)
            OR
            (COALESCE(up.last_name, '') ILIKE $11 AND COALESCE(up.first_name, '') ILIKE $12)
          )
        )
      )
      ORDER BY sde."scheduledDate" ASC, ps.id DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query,
      [status, limit || 10,
       offset || 0, location, date || null, schedulerId ? parseInt(schedulerId, 10) : null, staffBranch,
       hasSearchTerm, prefixTerm, anyTerm, token1Any, token2Any, hasTwoTokens]);
    const slots = result.rows;

    if (slots.length === 0) return slots;

    // Fetch requirements for returned slots
    const slotIds = slots.map(s => s.id);
    const reqResult = await db.query(
      `SELECT psr.* FROM "patientScheduleRequirement" psr WHERE psr."patientSlotId" = ANY($1);`,
      [slotIds]
    );
    const reqBySlot = {};
    for (const req of reqResult.rows) {
      if (!reqBySlot[req.patientSlotId]) reqBySlot[req.patientSlotId] = [];
      reqBySlot[req.patientSlotId].push(req);
    }

    return slots.map(s => ({ ...s, requirements: reqBySlot[s.id] || [] }));
  },

  _getAppointmentStatusCounts: async (_, { location, staffBranch = 'Both', schedulerId, date }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(`
      SELECT ps.status, COUNT(*)::int AS count
      FROM "patientSlot" ps
      JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
      JOIN "slotScheduler" ss ON ss.id = sde."slotId"
      WHERE (
        $4 = 'Both'
        OR ($4 = 'Manila'      AND ss.location IN ('Arlegui', 'Casal'))
        OR ($4 = 'QuezonCity'  AND ss.location = 'QuezonCity')
      )
      AND ss.location = COALESCE($1::"LocationDesignation", ss.location)
        AND ($2::integer IS NULL OR ss.id = $2::integer)
        AND ($3::date IS NULL OR sde."scheduledDate"::date = $3::date)
      GROUP BY ps.status;
    `, [location || null, schedulerId ? parseInt(schedulerId, 10) : null, date || null, staffBranch]);

    return result.rows;
  },

  _listSchedulerWhitelist: async (_, { schedulerId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const query = `
      SELECT
        swl.id,
        swl."slotSchedulerId",
        swl."patientId",
        up.identifier AS "patientIdentifier",
        CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')) AS "patientName"
      FROM "schedulerWhitelist" swl
      LEFT JOIN "UsersPersonal" up ON up.id = swl."patientId"
      WHERE swl."slotSchedulerId" = $1
      ORDER BY swl.id DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(query, [schedulerId, limit || 50, offset || 0]);
    return result.rows;
  },

  _listMonthAvailability: async (_, { schedulerId, startDate, endDate }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Ensure all SlotCustomDate records have corresponding ScheduleDateEntity entries
      // (in case any were created before the recent fixes and not yet synced)
      const schedulerDefaults = await client.query(
        `SELECT "morningAllowed", "afternoonAllowed" FROM "slotScheduler" WHERE id = $1;`,
        [schedulerId]
      );

      if (schedulerDefaults.rowCount === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Scheduler not found").status(404).throw();
      }

      const { morningAllowed, afternoonAllowed } = schedulerDefaults.rows[0];

      // Insert missing ScheduleDateEntity entries for any SlotCustomDate that doesn't have one
      // For Include dates: use scheduler defaults; for Exclude dates: set to 0 (blocks appointments)
      await client.query(
        `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
         SELECT
           scd."slotScheduleId",
           scd."scheduledDate",
           CASE 
             WHEN scd."type" = 'Exclude' THEN 0
             ELSE $2
           END,
           CASE 
             WHEN scd."type" = 'Exclude' THEN 0
             ELSE $3
           END
         FROM "SlotCustomDate" scd
         WHERE scd."slotScheduleId" = $1
           AND scd."scheduledDate" >= $4
           AND scd."scheduledDate" <= $5
           AND NOT EXISTS (
             SELECT 1 FROM "ScheduleDateEntity" sde
             WHERE sde."slotId" = scd."slotScheduleId"
               AND sde."scheduledDate" = scd."scheduledDate"
           );`,
        [schedulerId, morningAllowed, afternoonAllowed, startDate, endDate]
      );

      // Step 2: Fetch all ScheduleDateEntity records in the date range with counts.
      // Runs in the same transaction so the SELECT sees the just-inserted rows and
      // no concurrent writes can slip in between the INSERT and the read.
      const result = await client.query(
        `SELECT
           sde.*,
           COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status IN ('Scheduled','InProgress','Completed') THEN 1 ELSE 0 END), 0)::int AS "morningRegistered",
           COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status = 'Pending' THEN 1 ELSE 0 END), 0)::int AS "morningPending",
           COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status IN ('Scheduled','InProgress','Completed') THEN 1 ELSE 0 END), 0)::int AS "afternoonRegistered",
           COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status = 'Pending' THEN 1 ELSE 0 END), 0)::int AS "afternoonPending"
         FROM "ScheduleDateEntity" sde
         LEFT JOIN "patientSlot" ps ON ps."slotEntityId" = sde.id
         WHERE sde."slotId" = $1
           AND sde."scheduledDate" >= $2
           AND sde."scheduledDate" <= $3
         GROUP BY sde.id
         ORDER BY sde."scheduledDate" ASC;`,
        [schedulerId, startDate, endDate]
      );

      await client.query('COMMIT');
      return result.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _listMonthAvailability:", err);
      throwGraphQLError(res)
        .message(`Failed to list month availability: ${err.message}`)
        .status(500)
        .throw();
    } finally {
      client.release();
    }
  },

  // -- Returns active appointment count for a given scheduler + date (for pre-action checks) --
  _checkDateOccupancy: async (_, { schedulerId, date }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM "patientSlot" ps
       JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
       WHERE sde."slotId" = $1
         AND sde."scheduledDate"::date = $2::date
         AND ps.status IN ('Pending', 'Scheduled', 'InProgress');`,
      [schedulerId, date]
    );

    return { count: result.rows[0]?.count ?? 0 };
  }
};

const Mutation = {
  _submitAppointment: async (_, { schedulerId, date, session, requirements, purpose }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const normalizedPurpose = typeof purpose === "string" ? purpose.trim() : "";
    let allowedScheduler;

    try {
      allowedScheduler = await Query._listOpenAppointments(_, { offset: 0, limit: 1, schedulerId }, { user, res });
      if (allowedScheduler.length === 0) {
        throwGraphQLError(res).message("Scheduler not found or not allowed.").status(404).throw();
      }

      const purposeRequired = allowedScheduler[0]?.purposeRequired === true;
      if (purposeRequired && !normalizedPurpose) {
        throwGraphQLError(res)
          .message("Purpose / reason for visit is required for this appointment type")
          .status(400)
          .throw();
      }

      // Validate scheduler/date
      const isValidDate = await validateSchedulerDate(schedulerId, date);
      if (!isValidDate) {
        throwGraphQLError(res).message("Invalid date for scheduler").status(400).throw();
      }

      // Validate timeframe (patients cannot book beyond MAX_SCHEDULING_DAYS)
      if (!isWithinFutureTimeframe(date, MAX_SCHEDULING_DAYS)) {
        const today = new Date();
        const latestAllowed = new Date(today);
        latestAllowed.setDate(today.getDate() + MAX_SCHEDULING_DAYS);
        throwGraphQLError(res)
          .message(`Scheduling is only allowed from ${today.toISOString().split("T")[0]} up to ${latestAllowed.toISOString().split("T")[0]}`)
          .status(400)
          .throw();
      }

      // Ensure requirements are satisfied
      await validateSatisfiedAllRequirements(schedulerId, requirements, res);
    } catch (err) {
      logger.error("Error validating appointment submission:", err);
      throwGraphQLError(res).message(err.message || "Failed to submit appointment").status(err.status || 500).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Get or create schedule within transaction with lock
      let scheduleData = await client.query(
        `SELECT sde.* FROM "ScheduleDateEntity" sde
         WHERE sde."slotId" = $1 AND sde."scheduledDate" = $2
         LIMIT 1 FOR UPDATE;`,
        [schedulerId, date]
      );

      if (scheduleData.rowCount === 0) {
        // Fetch defaults to create new schedule
        const schedulerResult = await client.query(
          `SELECT "morningAllowed", "afternoonAllowed" FROM "slotScheduler" WHERE id = $1;`,
          [schedulerId]
        );

        if (schedulerResult.rowCount === 0) {
          await client.query('ROLLBACK');
          throwGraphQLError(res).message("Scheduler not found").status(404).throw();
        }

        const { morningAllowed, afternoonAllowed } = schedulerResult.rows[0];

        scheduleData = await client.query(
          `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [schedulerId, date, morningAllowed, afternoonAllowed]
        );
      }

      const schedule = scheduleData.rows[0];

      // Check availability (atomic within transaction)
      const countResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE "session" = 'Morning' AND "status" IN ('Pending', 'Scheduled', 'InProgress', 'Completed')) AS "morningUsed",
           COUNT(*) FILTER (WHERE "session" = 'Afternoon' AND "status" IN ('Pending', 'Scheduled', 'InProgress', 'Completed')) AS "afternoonUsed"
         FROM "patientSlot" WHERE "slotEntityId" = $1;`,
        [schedule.id]
      );

      const { morningUsed, afternoonUsed } = countResult.rows[0];

      if (session === "Morning" && schedule.morningAllowed <= morningUsed) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Morning session already full for the selected date").status(400).throw();
      } else if (session === "Afternoon" && schedule.afternoonAllowed <= afternoonUsed) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Afternoon session already full for the selected date").status(400).throw();
      }

      // Promote files before we commit
      for (const requirement of requirements) {
        if (requirement.filename) {
          requirement.filename = await promoteFile(user.id, requirement.filename, "appointmentRequirement");
        }
      }

      // Create patientSlot row
      const psResult = await client.query(
        `INSERT INTO "patientSlot" ("patientId", "slotEntityId", "status", "session", "purpose")
         VALUES ($1, $2, 'Pending', $3, $4)
         RETURNING *;`,
        [user.id, schedule.id, session, normalizedPurpose || null]
      );

      const patientSlotId = psResult.rows[0].id;

      // Insert patientScheduleRequirement rows
      if (requirements && requirements.length > 0) {
        const values = [];
        const placeholders = requirements.map((req, i) => {
          if (!req.scheduleRequirementId) {
            throw new Error(`Requirement at index ${i} missing scheduleRequirementId`);
          }
          const offset = i * 3;
          values.push(patientSlotId, req.scheduleRequirementId, req.filename || null);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
        });

        await client.query(
          `INSERT INTO "patientScheduleRequirement" ("patientSlotId", "scheduleRequirementId", "filename")
           VALUES ${placeholders.join(", ")}
           RETURNING *;`,
          values
        );
      }

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Patient",
        targetId: null,
        action: "SUBMIT_APPOINTMENT",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          scheduleDate: date,
          session,
          requirementCount: requirements?.length || 0,
          purpose: normalizedPurpose || null,
          slotEntityId: schedule.id,
          patientSlotId,
        }),
        changedBy: "Patient",
      });

      await client.query('COMMIT');

      // Fetch inserted requirements to attach to the slot
      const reqResult = await db.query(
        `SELECT psr.* FROM "patientScheduleRequirement" psr WHERE psr."patientSlotId" = $1;`,
        [patientSlotId]
      );

      return { ...psResult.rows[0], requirements: reqResult.rows, location: allowedScheduler[0].location };
    } catch (err) {
      await client.query('ROLLBACK');
      // Attempt to clean up promoted files
      if (requirements && requirements.length > 0) {
        for (const requirement of requirements) {
          if (requirement.filename) {
            try {
              await deleteFile("appointmentRequirement", requirement.filename);
            } catch (cleanupErr) {
              logger.warn("Failed to cleanup file:", cleanupErr.message);
            }
          }
        }
      }
      logger.error("Error submitting appointment:", err);
      throwGraphQLError(res).message(err.message || "Failed to submit appointment").status(err.status || 500).throw();
    } finally {
      client.release();
    }
  },

  _cancelAppointment: async (_, { patientId, cancelledBy, slotId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Verify the appointment exists and belongs to the patient
      const slotResult = await client.query(
        `SELECT "patientId", status FROM "patientSlot" WHERE id = $1 FOR UPDATE;`,
        [slotId]
      );

      if (slotResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Appointment not found").status(404).throw();
      }

      const appointment = slotResult.rows[0];

      // Verify patient matches (authorization check)
      if (appointment.patientId !== parseInt(patientId)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Unauthorized: appointment does not belong to this patient").status(403).throw();
      }

      // Verify the appointment is in a cancellable state
      const cancellableStatuses = ["Pending", "Scheduled", "InProgress"];
      if (!cancellableStatuses.includes(appointment.status)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message(`Cannot cancel appointment with status "${appointment.status}". Only ${cancellableStatuses.join(", ")} appointments can be cancelled.`)
          .status(400)
          .throw();
      }

      // Decide cancellation status based on who is cancelling
      const newStatus = parseInt(cancelledBy) === parseInt(patientId) ? "CancelledByPatient" : "CancelledByMedical";

      // Update the appointment
      const updateResult = await client.query(
        `UPDATE "patientSlot" SET status = $1 WHERE id = $2;`,
        [newStatus, slotId]
      );
      const isStaffTriggered = parseInt(cancelledBy) !== parseInt(patientId);

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: isStaffTriggered ? "Staff" : "Patient",
        targetId: isStaffTriggered ? patientId : null,
        action: "CANCEL_APPOINTMENT",
        details: JSON.stringify({
          slotId: Number(slotId),
          previousStatus: appointment.status,
          newStatus,
          cancelledBy: cancelledBy,
          patientId: patientId,
        }),
        changedBy: isStaffTriggered ? "Medical" : "Patient",
      });

      await client.query('COMMIT');

      if (updateResult.rowCount === 0) {
        throwGraphQLError(res).message("Failed to cancel appointment").status(500).throw();
      }

      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _cancelAppointment:", err);
      throwGraphQLError(res).message(err.message || "Failed to cancel appointment").status(err.status || 500).throw();
    } finally {
      client.release();
    }
  },

  _respondAppointment: async (_, { slotId, status, notes }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Valid state transitions per appointment state machine
    const validTransitions = {
      Pending: ["Scheduled", "Rejected"],
      Scheduled: ["CancelledByMedical"],
      InProgress: ["Completed", "CancelledByMedical"],
    };

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the slot row to prevent concurrent status changes
      const { rows } = await client.query(
        `SELECT status FROM "patientSlot" WHERE id = $1 FOR UPDATE;`,
        [slotId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Slot not found").status(404).throw();
      }

      const currentStatus = rows[0].status;
      const allowed = validTransitions[currentStatus];

      if (!allowed || !allowed.includes(status)) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message(`Cannot transition from "${currentStatus}" to "${status}". Allowed: ${(allowed || []).join(", ") || "none"}`)
          .status(400)
          .throw();
      }

      // Perform update within transaction
      const updateResult = await client.query(
        `UPDATE "patientSlot" SET status = $1, notes = $2, "approvedBy" = $3 WHERE id = $4 RETURNING *;`,
        [status, notes || null, user.id, slotId]
      );

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: updateResult.rows[0]?.patientId || null,
        action: "RESPOND_APPOINTMENT",
        details: JSON.stringify({
          slotId: Number(slotId),
          previousStatus: currentStatus,
          newStatus: status,
          notes: notes || null,
          approvedBy: user.id,
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      // Resolve approver name (outside transaction)
      const staffResult = await db.query(
        `SELECT CONCAT(first_name, ' ', last_name) AS name FROM "UsersPersonal" WHERE id = $1 LIMIT 1;`,
        [user.id]
      );

      const row = updateResult.rows[0];
      row.approvedBy = staffResult.rows[0]?.name || String(user.id);

      return { ...row, requirements: [] };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _respondAppointment:", err);
      throwGraphQLError(res).message(err.message || "Failed to update slot status").status(err.status || 500).throw();
    } finally {
      client.release();
    }
  },

  _recordAppointmentAttendance: async (_, { slotId, arrived_at }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the slot row to prevent concurrent status changes
      const { rows } = await client.query(
        `SELECT status FROM "patientSlot" WHERE id = $1 FOR UPDATE;`,
        [slotId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Slot not found").status(404).throw();
      }

      if (rows[0].status !== "Scheduled") {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message("Slot status must be Scheduled to record attendance")
          .status(400)
          .throw();
      }

      // Perform update within transaction
      const updateResult = await client.query(
        `UPDATE "patientSlot" SET status = 'InProgress', arrived_at = $1 WHERE id = $2 RETURNING *;`,
        [arrived_at, slotId]
      );

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: updateResult.rows[0]?.patientId || null,
        action: "RECORD_APPOINTMENT_ATTENDANCE",
        details: JSON.stringify({
          slotId: Number(slotId),
          previousStatus: rows[0].status,
          newStatus: "InProgress",
          arrivedAt: arrived_at || null,
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      return { ...updateResult.rows[0], requirements: [] };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _recordAppointmentAttendance:", err);
      throwGraphQLError(res).message(err.message || "Failed to record attendance").status(err.status || 500).throw();
    } finally {
      client.release();
    }
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

      // Reject any past dates in the initial custom date lists
      const allInitialDates = [
        ...(input.slotIncludedDates || []),
        ...(input.slotExcludedDates || [])
      ];
      const pastInitial = allInitialDates.filter(isPastDate);
      if (pastInitial.length > 0) {
        throwGraphQLError(res)
          .message(`Cannot add, create, or change past dates: ${pastInitial.join(', ')}`)
          .status(400)
          .throw();
      }

      // Check if there are any custom dates (Include or Exclude)
      const hasCustomDates = 
        (input.slotIncludedDates && input.slotIncludedDates.length > 0) ||
        (input.slotExcludedDates && input.slotExcludedDates.length > 0);

      const result = await client.query(
        `INSERT INTO "slotScheduler"
          (label, location, "patientType", "scheduleFlags", "morningAllowed", "afternoonAllowed", "whitelistOnly", "containsCustomDates", "purposeRequired", notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;`,
        [
          input.label,
          input.location,
          input.patientType || null,
          encodedScheduleFlags,
          input.morningAllowed,
          input.afternoonAllowed,
          input.whitelistOnly || false,
          hasCustomDates,
          input.purposeRequired || false,
          input.notes || null,
        ]
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res).message("Failed to create scheduler").status(500).throw();
      }

      const schedulerId = result.rows[0].id;

      // Process Include dates
      if (input.slotIncludedDates && input.slotIncludedDates.length > 0) {
        const includeDatesWithType = input.slotIncludedDates.map(date => ({
          scheduledDate: date,
          type: 'Include'
        }));
        await insertSlotCustomDates(schedulerId, includeDatesWithType, client);
        
        // Initialize ScheduleDateEntity for each included date
        for (const scheduledDate of input.slotIncludedDates) {
          await client.query(
            `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
             SELECT $1, $2, $3, $4
             WHERE NOT EXISTS (
               SELECT 1 FROM "ScheduleDateEntity" WHERE "slotId" = $1 AND "scheduledDate" = $2
             );`,
            [schedulerId, scheduledDate, input.morningAllowed, input.afternoonAllowed]
          );
        }
      }

      // Process Exclude dates
      if (input.slotExcludedDates && input.slotExcludedDates.length > 0) {
        const excludeDatesWithType = input.slotExcludedDates.map(date => ({
          scheduledDate: date,
          type: 'Exclude'
        }));
        await insertSlotCustomDates(schedulerId, excludeDatesWithType, client);
        
        // Initialize ScheduleDateEntity for each excluded date with 0 slots
        for (const scheduledDate of input.slotExcludedDates) {
          await client.query(
            `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
             SELECT $1, $2, $3, $4
             WHERE NOT EXISTS (
               SELECT 1 FROM "ScheduleDateEntity" WHERE "slotId" = $1 AND "scheduledDate" = $2
             );`,
            [schedulerId, scheduledDate, 0, 0]
          );
        }
      }

      if (input.whiteLists && input.whiteLists.length > 0) {
        await insertSchedulerWhitelist(schedulerId, input.whiteLists, client);
      }

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "CREATE_APPOINTMENT_SCHEDULER",
        details: JSON.stringify({
          schedulerId,
          label: input.label,
          location: input.location,
          patientType: input.patientType || null,
          morningAllowed: input.morningAllowed,
          afternoonAllowed: input.afternoonAllowed,
          whitelistOnly: input.whitelistOnly || false,
          purposeRequired: input.purposeRequired || false,
          includeDatesCount: input.slotIncludedDates?.length || 0,
          excludeDatesCount: input.slotExcludedDates?.length || 0,
          whitelistCount: input.whiteLists?.length || 0,
        }),
        changedBy: "Medical",
      });

      await client.query("COMMIT");
      logger.info(`Created new scheduler with ID ${schedulerId} by user ${user.id}`);

      const scheduler = result.rows[0];
      scheduler.schedulePerWeek = decodeSchedulingFlags(scheduler.scheduleFlags);
      return scheduler;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("Error in _createScheduler transaction:", err);
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

    if (input.patientType !== undefined) {
      fields.push(`"patientType" = $${idx++}`);
      values.push(input.patientType ?? null);
    }

    if (input.schedulePerWeek !== undefined && input.schedulePerWeek !== null) {
      const encodedScheduleFlags = encodeSchedulingFlags(input.schedulePerWeek);
      if (encodedScheduleFlags === -1) {
        throwGraphQLError(res).message("Invalid schedule days").status(400).throw();
      }
      fields.push(`"scheduleFlags" = $${idx++}`);
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

    if (input.purposeRequired !== undefined && input.purposeRequired !== null) {
      fields.push(`"purposeRequired" = $${idx++}`);
      values.push(input.purposeRequired);
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

    // Cascade default slot updates to ScheduleDateEntity rows that are NOT backed by a
    // SlotCustomDate entry (those are true "default" dates and should always match the
    // scheduler defaults).  Custom date entities keep their own per-date overrides.
    const newMorning = input.morningAllowed;
    const newAfternoon = input.afternoonAllowed;
    const slotDefaultChanged =
      (newMorning !== undefined && newMorning !== null) ||
      (newAfternoon !== undefined && newAfternoon !== null);

    if (slotDefaultChanged) {
      // Build a SET clause only for the columns that actually changed
      const cascadeFields = [];
      const cascadeValues = [];
      let ci = 1;
      if (newMorning !== undefined && newMorning !== null) {
        cascadeFields.push(`"morningAllowed" = $${ci++}`);
        cascadeValues.push(newMorning);
      }
      if (newAfternoon !== undefined && newAfternoon !== null) {
        cascadeFields.push(`"afternoonAllowed" = $${ci++}`);
        cascadeValues.push(newAfternoon);
      }
      cascadeValues.push(schedulerId);

      await db.query(
        `UPDATE "ScheduleDateEntity" sde
         SET ${cascadeFields.join(', ')}
         WHERE sde."slotId" = $${ci}
           AND NOT EXISTS (
             SELECT 1 FROM "SlotCustomDate" scd
             WHERE scd."slotScheduleId" = sde."slotId"
               AND scd."scheduledDate" = sde."scheduledDate"
           );`,
        cascadeValues
      );
    }

    const updatedFields = { schedulerId: Number(schedulerId) };
    if (input.label !== undefined) updatedFields.label = input.label;
    if (input.location !== undefined) updatedFields.location = input.location;
    if (input.patientType !== undefined) updatedFields.patientType = input.patientType ?? null;
    if (input.schedulePerWeek !== undefined) updatedFields.schedulePerWeek = input.schedulePerWeek;
    if (input.morningAllowed !== undefined) updatedFields.morningAllowed = input.morningAllowed;
    if (input.afternoonAllowed !== undefined) updatedFields.afternoonAllowed = input.afternoonAllowed;
    if (input.whitelistOnly !== undefined) updatedFields.whitelistOnly = input.whitelistOnly;
    if (input.isActive !== undefined) updatedFields.isActive = input.isActive;
    if (input.purposeRequired !== undefined) updatedFields.purposeRequired = input.purposeRequired;
    if (input.notes !== undefined) updatedFields.notes = input.notes;

    await db.setSystemAuditLog({
      eventType: "APPOINTMENT_MANAGEMENT",
      actorId: user.id,
      actorType: "Staff",
      targetId: null,
      action: "UPDATE_APPOINTMENT_SCHEDULER",
      details: JSON.stringify(updatedFields),
      changedBy: "Medical",
    });

    const scheduler = result.rows[0];
    scheduler.schedulePerWeek = decodeSchedulingFlags(scheduler.scheduleFlags);
    return scheduler;
  },

  _deleteScheduler: async (_, { schedulerId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the scheduler row to prevent concurrent deletes and appointments
      const schedulerCheck = await client.query(
        `SELECT id FROM "slotScheduler" WHERE id = $1 FOR UPDATE;`,
        [schedulerId]
      );

      if (schedulerCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Scheduler not found").status(404).throw();
      }

      // Check if any appointment records reference this scheduler's date entities
      const slotCheck = await client.query(
        `SELECT 1 FROM "patientSlot" ps
         INNER JOIN "ScheduleDateEntity" sde ON sde.id = ps."slotEntityId"
         WHERE sde."slotId" = $1
         LIMIT 1;`,
        [schedulerId]
      );

      if (slotCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message("Cannot delete scheduler: it has associated appointment records. Deactivate it instead.")
          .status(400)
          .throw();
      }

      // Cascade delete child records in FK-safe order (all within transaction)
      await client.query(`DELETE FROM "schedulerWhitelist" WHERE "slotSchedulerId" = $1;`, [schedulerId]);
      await client.query(`DELETE FROM "scheduleRequirement" WHERE "slotId" = $1;`, [schedulerId]);
      await client.query(`DELETE FROM "SlotCustomDate" WHERE "slotScheduleId" = $1;`, [schedulerId]);
      await client.query(`DELETE FROM "ScheduleDateEntity" WHERE "slotId" = $1;`, [schedulerId]);

      const result = await client.query(
        `DELETE FROM "slotScheduler" WHERE id = $1;`,
        [schedulerId]
      );

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "DELETE_APPOINTMENT_SCHEDULER",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      return result.rowCount > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _deleteScheduler:", err);
      throwGraphQLError(res).message(err.message || "Failed to delete scheduler").status(err.status || 500).throw();
    } finally {
      client.release();
    }
  },

  _updateSchedulerRequirement: async (_, { schedulerId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Check if a requirement with this label already exists for the scheduler
    const existing = await db.query(
      `SELECT id FROM "scheduleRequirement" WHERE "slotId" = $1 AND "label" = $2`,
      [schedulerId, input.label]
    );

    if (existing.rowCount > 0) {
      // Update existing requirement (identified by slotId + label)
      const fields = [];
      const values = [];
      let idx = 1;

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
        // Nothing to update — return existing record
        const full = await db.query(`SELECT * FROM "scheduleRequirement" WHERE id = $1`, [existing.rows[0].id]);
        return full.rows[0];
      }

      values.push(existing.rows[0].id);

      const result = await db.query(
        `UPDATE "scheduleRequirement" SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *;`,
        values
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res).message("Failed to update scheduler requirement").status(500).throw();
      }

      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "UPDATE_SCHEDULER_REQUIREMENT",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          requirementId: existing.rows[0].id,
          label: input.label,
          notes: input.notes,
          isDigital: input.isDigital,
          isActive: input.isActive,
        }),
        changedBy: "Medical",
      });

      return result.rows[0];
    } else {
      // Insert new requirement
      const result = await db.query(
        `INSERT INTO "scheduleRequirement" ("slotId", "label", "notes", "isDigital", "isActive")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`,
        [schedulerId, input.label, input.notes || null, input.isDigital ?? true, input.isActive ?? true]
      );

      if (result.rowCount === 0) {
        throwGraphQLError(res).message("Failed to create scheduler requirement").status(500).throw();
      }

      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "CREATE_SCHEDULER_REQUIREMENT",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          requirementId: result.rows[0].id,
          label: input.label,
          notes: input.notes || null,
          isDigital: input.isDigital ?? true,
          isActive: input.isActive ?? true,
        }),
        changedBy: "Medical",
      });

      return result.rows[0];
    }
  },

  _deleteSchedulerRequirement: async (_, { schedulerId, label }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Find the requirement ID first
    const lookup = await db.query(
      `SELECT id FROM "scheduleRequirement" WHERE "slotId" = $1 AND label = $2;`,
      [schedulerId, label]
    );
    if (lookup.rowCount === 0) return false;

    const reqId = lookup.rows[0].id;

    // Cascade-delete any patient submissions referencing this requirement
    await db.query(
      `DELETE FROM "patientScheduleRequirement" WHERE "scheduleRequirementId" = $1;`,
      [reqId]
    );

    const result = await db.query(
      `DELETE FROM "scheduleRequirement" WHERE id = $1;`,
      [reqId]
    );

    if (result.rowCount > 0) {
      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "DELETE_SCHEDULER_REQUIREMENT",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          requirementId: reqId,
          label,
        }),
        changedBy: "Medical",
      });
    }

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

    // Reject any past dates — staff may only add/edit present or future dates
    const pastDates = dates
      .map(d => (typeof d === 'string' ? d : d.scheduledDate))
      .filter(isPastDate);
    if (pastDates.length > 0) {
      throwGraphQLError(res)
        .message(`Cannot add, create, or change past dates: ${pastDates.join(', ')}`)
        .status(400)
        .throw();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Fetch scheduler defaults for slot count fallback
      const schedulerResult = await client.query(
        `SELECT "morningAllowed", "afternoonAllowed", "containsCustomDates" FROM "slotScheduler" WHERE id = $1;`,
        [schedulerId]
      );
      if (schedulerResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res).message("Scheduler not found").status(404).throw();
      }
      const defaults = schedulerResult.rows[0];

      // Auto-derive type for each date from morningAllowed/afternoonAllowed
      // Both 0 → Exclude, otherwise → Include
      // Insert/upsert SlotCustomDate entries and ScheduleDateEntity entries
      for (const dateEntry of dates) {
        const scheduledDate = typeof dateEntry === 'string' ? dateEntry : dateEntry.scheduledDate;
        const morning = (typeof dateEntry === 'object' && dateEntry.morningAllowed != null)
          ? dateEntry.morningAllowed
          : defaults.morningAllowed;
        const afternoon = (typeof dateEntry === 'object' && dateEntry.afternoonAllowed != null)
          ? dateEntry.afternoonAllowed
          : defaults.afternoonAllowed;
        const derivedType = (morning === 0 && afternoon === 0) ? 'Exclude' : 'Include';

        // Upsert SlotCustomDate (insert or update type if already exists)
        await client.query(
          `INSERT INTO "SlotCustomDate" ("slotScheduleId", "scheduledDate", "type")
           VALUES ($1, $2, $3::"SlotCustomType")
           ON CONFLICT ("slotScheduleId", "scheduledDate")
           DO UPDATE SET "type" = $3::"SlotCustomType";`,
          [schedulerId, scheduledDate, derivedType]
        );

        // Upsert ScheduleDateEntity
        const existing = await client.query(
          `SELECT id FROM "ScheduleDateEntity" WHERE "slotId" = $1 AND "scheduledDate" = $2 LIMIT 1;`,
          [schedulerId, scheduledDate]
        );

        if (existing.rowCount > 0) {
          await client.query(
            `UPDATE "ScheduleDateEntity"
             SET "morningAllowed" = $1, "afternoonAllowed" = $2
             WHERE "slotId" = $3 AND "scheduledDate" = $4;`,
            [morning, afternoon, schedulerId, scheduledDate]
          );
        } else {
          await client.query(
            `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
             VALUES ($1, $2, $3, $4);`,
            [schedulerId, scheduledDate, morning, afternoon]
          );
        }
      }

      // If containsCustomDates is currently false, set it to true
      if (!defaults.containsCustomDates) {
        await client.query(
          `UPDATE "slotScheduler" SET "containsCustomDates" = true WHERE id = $1;`,
          [schedulerId]
        );
      }

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "SET_APPOINTMENT_CUSTOM_DATES",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          datesCount: dates.length,
          dates,
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      // Return full SlotCustomDateEntry objects with slot counts from ScheduleDateEntity
      const scheduledDates = dates.map(d => (typeof d === 'string' ? d : d.scheduledDate));
      const finalResult = await db.query(
        `SELECT
           scd.id,
           scd."slotScheduleId",
           scd."scheduledDate",
           scd."type",
           sde."morningAllowed",
           sde."afternoonAllowed",
           scd.created_at
         FROM "SlotCustomDate" scd
         LEFT JOIN "ScheduleDateEntity" sde
           ON sde."slotId" = scd."slotScheduleId" AND sde."scheduledDate" = scd."scheduledDate"
         WHERE scd."slotScheduleId" = $1
           AND scd."scheduledDate" = ANY($2)
         ORDER BY scd."scheduledDate" ASC;`,
        [schedulerId, scheduledDates]
      );
      return finalResult.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _setCustomDates:", err);
      throwGraphQLError(res)
        .message(`Failed to set custom dates: ${err.message}`)
        .status(500)
        .throw();
    } finally {
      client.release();
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

    // Fetch scheduler defaults and scheduleFlags before opening the transaction
    const schedulerResult = await db.query(
      `SELECT "scheduleFlags", "morningAllowed", "afternoonAllowed" FROM "slotScheduler" WHERE id = $1;`,
      [schedulerId]
    );
    if (schedulerResult.rowCount === 0) {
      throwGraphQLError(res).message("Scheduler not found").status(404).throw();
    }
    const { scheduleFlags, morningAllowed: defMorning, afternoonAllowed: defAfternoon } = schedulerResult.rows[0];

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Normalize dates to plain DATE strings and cast in query to avoid type mismatch
      const normalizedDates = dates.map(d => (typeof d === 'string' ? d.split('T')[0] : d));

      const result = await client.query(
        `DELETE FROM "SlotCustomDate"
         WHERE "slotScheduleId" = $1
         AND "scheduledDate"::date = ANY($2::date[])
         RETURNING "scheduledDate"::date::text AS "scheduledDate";`,
        [schedulerId, normalizedDates]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        throwGraphQLError(res)
          .message("No matching custom dates found to unset")
          .status(404)
          .throw();
      }

      const deletedDates = result.rows.map(r => r.scheduledDate);

      // For each deleted date:
      // - If the day is still in the default weekly schedule (scheduleFlags) → reset ScheduleDateEntity to defaults
      // - If not → delete ScheduleDateEntity (only if no appointments reference it)
      //
      // DOW mapping: Sun=0→64, Mon=1→1, Tue=2→2, Wed=3→4, Thu=4→8, Fri=5→16, Sat=6→32
      for (const dateStr of deletedDates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay(); // 0=Sun
        const flagMap = [64, 1, 2, 4, 8, 16, 32]; // index by DOW
        const dayFlag = flagMap[dow];
        const isDefaultScheduled = (scheduleFlags & dayFlag) > 0;

        if (isDefaultScheduled) {
          // Reset to scheduler defaults rather than deleting
          await client.query(
            `UPDATE "ScheduleDateEntity"
             SET "morningAllowed" = $1, "afternoonAllowed" = $2
             WHERE "slotId" = $3 AND "scheduledDate"::date = $4::date;`,
            [defMorning, defAfternoon, schedulerId, dateStr]
          );
        } else {
          // Delete if no appointments reference this entity
          await client.query(
            `DELETE FROM "ScheduleDateEntity" sde
             WHERE sde."slotId" = $1
               AND sde."scheduledDate"::date = $2::date
               AND NOT EXISTS (
                 SELECT 1 FROM "patientSlot" ps
                 WHERE ps."slotEntityId" = sde.id
               );`,
            [schedulerId, dateStr]
          );
        }
      }

      // Keep containsCustomDates flag in sync (atomic within transaction)
      const remaining = await client.query(
        `SELECT 1 FROM "SlotCustomDate" WHERE "slotScheduleId" = $1 LIMIT 1;`,
        [schedulerId]
      );
      await client.query(
        `UPDATE "slotScheduler" SET "containsCustomDates" = $1 WHERE id = $2;`,
        [remaining.rowCount > 0, schedulerId]
      );

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "UNSET_APPOINTMENT_CUSTOM_DATES",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          removedDatesCount: deletedDates.length,
          removedDates: deletedDates,
          containsCustomDates: remaining.rowCount > 0,
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      return deletedDates;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _unsetCustomDates:", err);
      throwGraphQLError(res)
        .message(`Failed to unset custom dates: ${err.message}`)
        .status(500)
        .throw();
    } finally {
      client.release();
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

      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "ADD_SCHEDULER_WHITELIST",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          addedPatientIds: result.rows.map(r => r.patientId),
          addedCount: result.rowCount,
        }),
        changedBy: "Medical",
      });

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

      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "REMOVE_SCHEDULER_WHITELIST",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          removedPatientIds: result.rows.map(r => r.patientId),
          removedCount: result.rowCount,
        }),
        changedBy: "Medical",
      });

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

    // Reject modifications to past dates
    if (isPastDate(date)) {
      throwGraphQLError(res)
        .message("Cannot add, create, or change past dates")
        .status(400)
        .throw();
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

      let result = await db.query(query, values);

      // If no entity exists yet, create one with scheduler defaults then retry
      if (result.rowCount === 0) {
        const schedulerDefaults = await db.query(
          `SELECT "morningAllowed", "afternoonAllowed" FROM "slotScheduler" WHERE id = $1;`,
          [schedulerId]
        );
        if (schedulerDefaults.rowCount === 0) {
          throwGraphQLError(res).message("Scheduler not found").status(404).throw();
        }
        const { morningAllowed: defMorning, afternoonAllowed: defAfternoon } = schedulerDefaults.rows[0];

        await db.query(
          `INSERT INTO "ScheduleDateEntity" ("slotId", "scheduledDate", "morningAllowed", "afternoonAllowed")
           SELECT $1, $2, $3, $4
           WHERE NOT EXISTS (
             SELECT 1 FROM "ScheduleDateEntity" WHERE "slotId" = $1 AND "scheduledDate" = $2
           );`,
          [schedulerId, date, defMorning, defAfternoon]
        );

        result = await db.query(query, values);
        if (result.rowCount === 0) {
          throwGraphQLError(res)
            .message("Failed to create and update schedule date entity")
            .status(500)
            .throw();
        }
      }

      // Attach computed counts so GraphQL can resolve morningRegistered, etc.
      const updated = result.rows[0];

      const updatedFields = {
        schedulerId: Number(schedulerId),
        originalDate: date,
      };
      if (input.morningAllowed !== undefined) updatedFields.morningAllowed = input.morningAllowed;
      if (input.afternoonAllowed !== undefined) updatedFields.afternoonAllowed = input.afternoonAllowed;
      if (input.allowDuring !== undefined) updatedFields.allowDuring = input.allowDuring;
      if (input.scheduledDate !== undefined) updatedFields.scheduledDate = input.scheduledDate;

      await db.setSystemAuditLog({
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "UPDATE_DATE_IDENTITY",
        details: JSON.stringify(updatedFields),
        changedBy: "Medical",
      });

      const counts = await getAppointmentCounts(schedulerId, updated.scheduledDate);
      return { ...updated, ...counts };
    } catch (err) {
      throwGraphQLError(res)
        .message(`Failed to update schedule date entity: ${err.message}`)
        .status(500)
        .throw();
    }
  },

  // -- Bulk-reject all active appointments for a scheduler + date --
  // Used when staff force-deletes/disables a date with existing bookings.
  _cancelDateAppointments: async (_, { schedulerId, date, reason }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const cancelReason = reason || 'This appointment date is no longer available. We apologize for the inconvenience. Please rebook at your earliest convenience.';

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Reject all Pending/Scheduled/InProgress slots for this date
      const result = await client.query(
        `UPDATE "patientSlot" ps
         SET status = 'Rejected', notes = $1, "approvedBy" = $2
         FROM "ScheduleDateEntity" sde
         WHERE sde.id = ps."slotEntityId"
           AND sde."slotId" = $3
           AND sde."scheduledDate"::date = $4::date
           AND ps.status IN ('Pending', 'Scheduled', 'InProgress')
         RETURNING ps.id, ps."patientId";`,
        [cancelReason, user.id, schedulerId, date]
      );

      await db.setSystemAuditLog({
        client,
        eventType: "APPOINTMENT_MANAGEMENT",
        actorId: user.id,
        actorType: "Staff",
        targetId: null,
        action: "CANCEL_DATE_APPOINTMENTS",
        details: JSON.stringify({
          schedulerId: Number(schedulerId),
          scheduleDate: date,
          reason: cancelReason,
          cancelledCount: result.rowCount,
        }),
        changedBy: "Medical",
      });

      await client.query('COMMIT');

      return result.rowCount;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error("Error in _cancelDateAppointments:", err);
      throwGraphQLError(res)
        .message(`Failed to cancel appointments: ${err.message}`)
        .status(500)
        .throw();
    } finally {
      client.release();
    }
  }

};


module.exports = { Query, Mutation };
