const db  = require("../../../../config/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });


function decodeSchedulingFlags(flags) {
  const daysMap = {
    1: "Monday",
    2: "Tuesday",
    4: "Wednesday",
    8: "Thursday",
    16: "Friday",
    32: "Saturday",
    64: "Sunday"
  };

  const result = [];
  for (const [bit, day] of Object.entries(daysMap)) {
    if (flags & bit) {
      result.push(day);
    }
  }
  return result;
}

function encodeSchedulingFlags(days) {
  const daysMap = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 4,
    Thursday: 8,
    Friday: 16,
    Saturday: 32,
    Sunday: 64
  };

  // Deduplicate and validate
  const uniqueDays = [...new Set(days)];
  const invalidDays = uniqueDays.filter(day => !daysMap[day]);

  if (invalidDays.length > 0) {
    return -1; // Invalid input
  }

  return uniqueDays.reduce((acc, day) => acc | daysMap[day], 0);
}

async function validateSchedulerDate(schedulerId, date) {
  // Parse the date-only string as LOCAL midnight (avoids UTC off-by-one in
  // non-UTC timezones — `new Date("YYYY-MM-DD")` is UTC midnight per spec).
  const [y, m, d] = date.split('-').map(Number);
  // Use getDay() for locale-independent English weekday names.
  // toLocaleDateString("en-US", ...) depends on Node.js ICU build; on servers
  // with limited ICU it may return a non-English name (e.g., "Martes" instead
  // of "Tuesday"), causing the scheduleFlags comparison to always fail.
  const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = DAYS_EN[new Date(y, m - 1, d).getDay()];
  console.log(`Validating scheduler date: Scheduler ID ${schedulerId}, Date ${date} (${dayName})`);
  // First check weekly schedule flags
  const queryScheduler = `
    SELECT "scheduleFlags"
    FROM "slotScheduler"
    WHERE id = $1;
  `;
  const resultScheduler = await db.query(queryScheduler, [schedulerId]);

  if (resultScheduler.rowCount === 0) {
    return false; // scheduler not found
  }

  const dayPerWeek = decodeSchedulingFlags(resultScheduler.rows[0].scheduleFlags); 
  // Example: ["Monday", "Wednesday", "Friday"]
  console.log(`Decoded schedule flags for scheduler ${schedulerId}: ${dayPerWeek.join(", ")}`);

  if (dayPerWeek.includes(dayName)) {
    return true; // matches weekly schedule
  }

  // If not in weekly schedule, check custom dates
  const queryCustomDate = `
    SELECT "scheduledDate"
    FROM "SlotCustomDate"
    WHERE "slotScheduleId" = $1 AND "scheduledDate" = $2;
  `;
  const resultCustomDate = await db.query(queryCustomDate, [schedulerId, date]);

  return resultCustomDate.rowCount > 0;
}

async function getAppointmentCounts(schedulerId, date) {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status IN ('Scheduled','InProgress','Completed') THEN 1 ELSE 0 END), 0) AS "morningRegistered",
      COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status = 'Pending' THEN 1 ELSE 0 END), 0) AS "morningPending",
      COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status IN ('Scheduled','InProgress','Completed') THEN 1 ELSE 0 END), 0) AS "afternoonRegistered",
      COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status = 'Pending' THEN 1 ELSE 0 END), 0) AS "afternoonPending"
    FROM "patientSlot" ps
    JOIN "ScheduleDateEntity" sde
      ON ps."slotEntityId" = sde."id"
    WHERE sde."slotId" = $1
      AND sde."scheduledDate" = $2
  `;

  const result = await db.query(query, [schedulerId, date]);
  return result.rows[0];
}

function isWithinFutureTimeframe(date, nDays) {
  const today = new Date();
  // Parse date-only string as local midnight to avoid UTC off-by-one.
  const [y, m, d] = date.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);

  // Normalize today to local midnight for consistent comparison
  today.setHours(0, 0, 0, 0);

  // Calculate latest allowed date
  const latestAllowed = new Date(today);
  latestAllowed.setDate(today.getDate() + nDays);

  return targetDate >= today && targetDate <= latestAllowed;
}

async function validateSatisfiedAllRequirements(scheduleId, requirements, res) {
  // Fetch required IDs from DB
  const result = await db.query(
    `SELECT sr.id
     FROM "scheduleRequirement" sr
     WHERE sr."slotId" = $1;`,
    [scheduleId]
  );

  const requiredIds = result.rows.map(r => String(r.id));

  // Extract provided IDs from array of patientScheduleRequirement objects
  const providedIds = (requirements || [])
    .map(r => r.scheduleRequirementId)
    .filter(id => id != null)
    .map(id => String(id));

  // Case: no requirements defined in DB
  if (requiredIds.length === 0) {
    if (providedIds.length === 0) {
      return true;
    } else {
      throwGraphQLError(res)
        .message(`No requirements expected for this scheduler, but received: ${providedIds.join(", ")}`)
        .status(400)
        .throw();
    }
  }

  // Convert to sets for comparison
  const requiredSet = new Set(requiredIds);
  const providedSet = new Set(providedIds);

  // Find missing and extra IDs
  const missing = [...requiredSet].filter(req => !providedSet.has(req));
  const extras = [...providedSet].filter(id => !requiredSet.has(id));

  if (missing.length > 0){
      throwGraphQLError(res)
        .message(`Missing required IDs: ${missing.join(", ")}`)
        .status(400)
        .throw();
    }
  else if (extras.length > 0) {
      throwGraphQLError(res)
        .message(`Unexpected IDs provided: ${extras.join(", ")}`)
        .status(400)
        .throw();
    }

  return true; // All requirements satisfied
}

async function insertSlotCustomDates(slotScheduleId, dates, db) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new Error("Dates array must not be empty");
  }

  // Same WHERE NOT EXISTS approach to avoid needing a unique constraint on (slotScheduleId, scheduledDate)
  const values = [];
  const selectParts = dates.map((dateEntry, i) => {
    const offset = i * 2;
    const scheduledDate = typeof dateEntry === 'string' ? dateEntry : dateEntry.scheduledDate;
    values.push(slotScheduleId, scheduledDate);
    return `($${offset + 1}::integer, $${offset + 2}::date)`;
  });

  const query = `
    INSERT INTO "SlotCustomDate" ("slotScheduleId", "scheduledDate")
    SELECT v."slotScheduleId", v."scheduledDate"
    FROM (VALUES ${selectParts.join(", ")}) AS v("slotScheduleId", "scheduledDate")
    WHERE NOT EXISTS (
      SELECT 1 FROM "SlotCustomDate" scd
      WHERE scd."slotScheduleId" = v."slotScheduleId"
        AND scd."scheduledDate" = v."scheduledDate"
    )
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows;
}

async function insertSchedulerWhitelist(slotSchedulerId, patientIds, db) {
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    throw new Error("patientIds array must not be empty");
  }

  // Build placeholders like ($1, $2), ($1, $3), ...
  const values = [];
  const placeholders = patientIds.map((_, i) => {
    const patientParamIndex = i + 2; // slotSchedulerId is $1
    values.push(patientIds[i]);
    return `($1, $${patientParamIndex})`;
  });

  const query = `
    INSERT INTO "schedulerWhitelist" (slotSchedulerId, patientId)
    VALUES ${placeholders.join(", ")}
    RETURNING *;
  `;

  const result = await db.query(query, [slotSchedulerId, ...values]);
  return result.rows;
}

async function getBranchFromShedulerId(schedulerId) {
  const query = `
    SELECT location
    FROM "slotScheduler"
    WHERE id = $1;
  `;

  const result = await db.query(query, [schedulerId]);
  if (result.rowCount === 0) {
    throw new Error("Scheduler not found");
  }
  return result.rows[0].location;
}

async function getPatientIdFromSlotId(slotId) {
  const query = `
    SELECT ps."patientId"
    FROM "patientSlot" ps
    WHERE ps.id = $1
    LIMIT 1;
  `;

  const result = await db.query(query, [slotId]);
  if (result.rowCount === 0) {
    throw new Error("Slot not found");
  }
  return result.rows[0].patientId;
}

// Helper function to get user ID via identifier
async function getUserIDViaIdentifier(identifier, branch) {
  const query = `
    SELECT uc.id as "userId"
    FROM "UserCredentials" uc
    INNER JOIN "UsersPersonal" up ON uc.id = up.id
    WHERE up.identifier = $1 AND
    (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both')
  `;
  const result = await db.query(query, [identifier, branch]);
  return result.rows;
}

module.exports = {
  decodeSchedulingFlags,
  encodeSchedulingFlags,
  validateSchedulerDate,
  getAppointmentCounts,
  isWithinFutureTimeframe,
  validateSatisfiedAllRequirements,
  insertSlotCustomDates,
  insertSchedulerWhitelist,
  getBranchFromShedulerId,
  getPatientIdFromSlotId,
  getUserIDViaIdentifier
};