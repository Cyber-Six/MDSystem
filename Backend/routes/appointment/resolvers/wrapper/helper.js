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
    FROM "SlotScheduler"
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
    WHERE "slotSchedulerId" = $1 AND "scheduledDate" = $2;
  `;
  const resultCustomDate = await db.query(queryCustomDate, [schedulerId, date]);

  return resultCustomDate.rowCount > 0;
}

async function getAppointmentCounts(schedulerId, date) {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN "session" = 'Morning' AND status IN ('Scheduled','Completed') THEN 1 ELSE 0 END), 0) AS "morningRegistered",
      COALESCE(SUM(CASE WHEN "session" = 'Morning' AND status = 'Pending' THEN 1 ELSE 0 END), 0) AS "morningPending",
      COALESCE(SUM(CASE WHEN "session" = 'Afternoon' AND status IN ('Scheduled','Completed') THEN 1 ELSE 0 END), 0) AS "afternoonRegistered",
      COALESCE(SUM(CASE WHEN "session" = 'Afternoon' AND status = 'Pending' THEN 1 ELSE 0 END), 0) AS "afternoonPending"
    FROM "patientSlot"
    WHERE "slotSchedulerId" = $1 AND "scheduledDate" = $2
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


module.exports = {
  decodeSchedulingFlags,
  encodeSchedulingFlags,
  validateSchedulerDate,
  getAppointmentCounts,
  isWithinFutureTimeframe
};