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
  // Derive the weekday name from the given date
  const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "long" });

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
      COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status IN ('Scheduled','Completed') THEN 1 ELSE 0 END), 0) AS "morningRegistered",
      COALESCE(SUM(CASE WHEN ps."session" = 'Morning' AND ps.status = 'Pending' THEN 1 ELSE 0 END), 0) AS "morningPending",
      COALESCE(SUM(CASE WHEN ps."session" = 'Afternoon' AND ps.status IN ('Scheduled','Completed') THEN 1 ELSE 0 END), 0) AS "afternoonRegistered",
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
  const targetDate = new Date(date);

  // Normalize to midnight for consistent comparison
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  // Calculate latest allowed date
  const latestAllowed = new Date(today);
  latestAllowed.setDate(today.getDate() + nDays);

  return targetDate >= today && targetDate <= latestAllowed;
}

async function validateSatisfiedAllRequirements(scheduleId, requirements, res) {
  // Fetch required IDs from DB
  const result = await db.query(
    `SELECT sr.id
     FROM "ScheduleRequirement" sr
     WHERE sr."slotId" = $1;`,
    [scheduleId]
  );

  const requiredIds = result.rows.map(r => r.id);

  // Extract provided IDs from array of patientScheduleRequirement objects
  const providedIds = (requirements || [])
    .map(r => r.scheduleRequirementId)
    .filter(id => id != null);

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

  // Build placeholders like ($1, $2), ($1, $3), ...
  const values = [];
  const placeholders = dates.map((_, i) => {
    const dateParamIndex = i + 2; // slotScheduleId is $1
    values.push(dates[i]);
    return `($1, $${dateParamIndex})`;
  });

  const query = `
    INSERT INTO "SlotCustomDate" (slotScheduleId, scheduledDate)
    VALUES ${placeholders.join(", ")}
    RETURNING *;
  `;

  const result = await db.query(query, [slotScheduleId, ...values]);
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



module.exports = {
  decodeSchedulingFlags,
  encodeSchedulingFlags,
  validateSchedulerDate,
  getAppointmentCounts,
  isWithinFutureTimeframe,
  validateSatisfiedAllRequirements,
  insertSlotCustomDates,
  insertSchedulerWhitelist
};