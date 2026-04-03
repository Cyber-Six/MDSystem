/**
 * Patient Appointment Service
 * Handles all GraphQL queries and mutations for the patient appointment endpoint.
 * Endpoint: POST /appointment/patient (JWT guard: patient)
 */

import { sendGraphQLRequest } from '../../utils/graphql-client';
import { axiosRequest } from '../../packages-core-adapter';

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
      getAppointmentStatus {
        id
        status
        session
        purpose
        notes
        created_at
        schedulerLabel
      }
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
        patientType
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
 * @returns {Promise<Array>} SlotCustomDateEntry[]
 */
export const listCustomDates = async (schedulerId, offset = 0, limit = 100) => {
  const data = await sendGraphQL(`
    query ListCustomDates($schedulerId: ID!, $offset: Int, $limit: Int) {
      listCustomDates(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id
        scheduledDate
        morningAllowed
        afternoonAllowed
      }
    }
  `, { schedulerId, offset, limit });
  return data.listCustomDates;
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

/**
 * Get month availability for a scheduler (batch read-only).
 * Returns existing ScheduleDateEntity records with booking counts.
 * @param {string} schedulerId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array>} ScheduleDateEntity[]
 */
export const getMonthAvailability = async (schedulerId, startDate, endDate) => {
  const data = await sendGraphQL(`
    query ListMonthAvailability($schedulerId: ID!, $startDate: Date!, $endDate: Date!) {
      listMonthAvailability(schedulerId: $schedulerId, startDate: $startDate, endDate: $endDate) {
        id
        slotId
        morningAllowed
        morningRegistered
        morningPending
        afternoonAllowed
        afternoonRegistered
        afternoonPending
        scheduledDate
      }
    }
  `, { schedulerId, startDate, endDate });
  return data.listMonthAvailability;
};

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Submit a new appointment booking.
 * @param {string} schedulerId
 * @param {string} date - ISO date (YYYY-MM-DD)
 * @param {'Morning'|'Afternoon'} session
 * @param {Array<{scheduleRequirementId: string, filename: string}>} requirements
 * @param {string} [purpose]
 * @returns {Promise<object>} patientSlot
 */
export const submitAppointment = async (schedulerId, date, session, requirements = [], purpose) => {
  const data = await sendGraphQL(`
    mutation SubmitAppointment(
      $schedulerId: ID!,
      $date: Date!,
      $session: SCHEDULE_SESSION!,
      $requirements: [patientScheduleRequirementInput!]!,
      $purpose: String
    ) {
      submitAppointment(
        schedulerId: $schedulerId,
        date: $date,
        session: $session,
        requirements: $requirements,
        purpose: $purpose
      ) {
        id
        patientId
        slotEntityId
        status
        session
        purpose
        notes
        created_at
      }
    }
  `, { schedulerId, date, session, requirements, purpose: purpose || null });
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

// ── Media Staging ────────────────────────────────────────────────────────────

/**
 * Upload a file to the media staging area.
 * @param {File} file - Browser File object
 * @returns {Promise<string>} fileId (UUID) from the staging server
 */
export const stageFile = async (file) => {
  const body = new FormData();
  body.append('file', file);
  const response = await axiosRequest.post('/media/stage/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.fileId;
};

/**
 * Remove a previously staged file.
 * @param {string} fileId - UUID returned by stageFile
 */
export const unstageFile = async (fileId) => {
  if (!fileId) return;
  await axiosRequest.delete(`/media/unstage/${fileId}`);
};


