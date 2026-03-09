/**
 * Patient Appointment Service
 * Handles all GraphQL queries and mutations for the patient appointment endpoint.
 * Endpoint: POST /appointment/patient (JWT guard: patient)
 */

import { sendGraphQLRequest } from '../../utils/graphql-client';

// ── Constants ────────────────────────────────────────────────────────────────

export const STATUS = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'InProgress',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  COMPLETED: 'Completed',
  NO_SHOW: 'NoShow',
  CANCELLED_PATIENT: 'CancelledByPatient',
  CANCELLED_MEDICAL: 'CancelledByMedical',
};

export const SESSION = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
};

// Active statuses that block a new booking
export const ACTIVE_STATUSES = [STATUS.PENDING, STATUS.SCHEDULED, STATUS.IN_PROGRESS];

// ── Internal helper ──────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: '/appointment/patient' });
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Check if the patient currently has an active appointment.
 * @returns {Promise<string|null>} SCHEDULING_STATUS or null
 */
export const getAppointmentStatus = async () => {
  const data = await sendGraphQL(`
    query {
      getAppointmentStatus
    }
  `);
  return data.getAppointmentStatus;
};

/**
 * List open appointment schedulers the patient can book (respects whitelist).
 * @param {number} [offset=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} SlotScheduler[]
 */
export const listOpenAppointments = async (offset = 0, limit = 20) => {
  const data = await sendGraphQL(`
    query ListOpenAppointments($offset: Int, $limit: Int) {
      listOpenAppointments(offset: $offset, limit: $limit) {
        id
        label
        location
        schedulePerWeek
        morningAllowed
        afternoonAllowed
        notes
        isActive
        containsCustomDates
        whitelistOnly
      }
    }
  `, { offset, limit });
  return data.listOpenAppointments;
};

/**
 * Fetch active requirements for a given scheduler.
 * @param {string} schedulerId
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} ScheduleRequirement[]
 */
export const listRequirements = async (schedulerId, offset = 0, limit = 50) => {
  const data = await sendGraphQL(`
    query ListAppointmentRequirements($schedulerId: ID!, $offset: Int, $limit: Int) {
      listAppointmentRequirements(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id
        slotId
        label
        notes
        isDigital
        isActive
      }
    }
  `, { schedulerId, offset, limit });
  return data.listAppointmentRequirements;
};

/**
 * Get custom dates (one-off open dates) for a scheduler.
 * @param {string} schedulerId
 * @param {number} [offset=0]
 * @param {number} [limit=100]
 * @returns {Promise<Array<string>>} Date strings
 */
export const listCustomDates = async (schedulerId, offset = 0, limit = 100) => {
  const data = await sendGraphQL(`
    query ListCustomDates($schedulerId: ID!, $offset: Int, $limit: Int) {
      listCustomDates(schedulerId: $schedulerId, offset: $offset, limit: $limit)
    }
  `, { schedulerId, offset, limit });
  return data.listCustomDates;
};

/**
 * Get slot availability for multiple dates in a single request.
 * @param {string} schedulerId
 * @param {string[]} dates - Array of ISO date strings (YYYY-MM-DD)
 * @returns {Promise<Array>} ScheduleDateEntity[]
 */
export const listScheduleAvailabilityBatch = async (schedulerId, dates) => {
  const data = await sendGraphQL(`
    query ListAppointmentScheduleBatch($schedulerId: ID!, $dates: [Date!]!) {
      listAppointmentScheduleBatch(schedulerId: $schedulerId, dates: $dates) {
        id
        slotId
        morningAllowed
        morningRegistered
        morningPending
        afternoonAllowed
        afternoonRegistered
        afternoonPending
        allowDuring
        scheduledDate
      }
    }
  `, { schedulerId, dates });
  return data.listAppointmentScheduleBatch;
};

/**
 * Get slot availability for a specific scheduler + date.
 * @param {string} schedulerId
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Promise<object>} ScheduleDateEntity with morning/afternoon counts
 */
export const getScheduleAvailability = async (schedulerId, date) => {
  const data = await sendGraphQL(`
    query ListAppointmentSchedule($schedulerId: ID!, $date: Date!) {
      listAppointmentSchedule(schedulerId: $schedulerId, date: $date) {
        id
        slotId
        morningAllowed
        morningRegistered
        morningPending
        afternoonAllowed
        afternoonRegistered
        afternoonPending
        allowDuring
        scheduledDate
      }
    }
  `, { schedulerId, date });
  return data.listAppointmentSchedule;
};

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Submit a new appointment booking.
 * @param {string} schedulerId
 * @param {string} date - ISO date (YYYY-MM-DD)
 * @param {'Morning'|'Afternoon'} session
 * @param {Array<{scheduleRequirementId: string, filename: string}>} requirements
 * @returns {Promise<object>} patientSlot
 */
export const submitAppointment = async (schedulerId, date, session, requirements = []) => {
  const data = await sendGraphQL(`
    mutation SubmitAppointment(
      $schedulerId: ID!,
      $date: Date!,
      $session: SCHEDULE_SESSION!,
      $requirements: [patientScheduleRequirementInput!]!
    ) {
      submitAppointment(
        schedulerId: $schedulerId,
        date: $date,
        session: $session,
        requirements: $requirements
      ) {
        id
        patientId
        slotEntityId
        status
        session
        notes
        created_at
      }
    }
  `, { schedulerId, date, session, requirements });
  return data.submitAppointment;
};

/**
 * Cancel the patient's current active appointment.
 * @returns {Promise<boolean>}
 */
export const cancelAppointment = async () => {
  const data = await sendGraphQL(`
    mutation {
      cancelAppointment
    }
  `);
  return data.cancelAppointment;
};
