/**
 * Staff (Medical) Appointment Service
 * Handles all GraphQL queries and mutations for the medical appointment endpoint.
 * Endpoint: POST /appointment/medical (JWT guard: medical)
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * Fetch a submitted appointment requirement file as a blob object URL.
 * Endpoint: GET /media/record/appointmentRequirement/:uuid  (JWT: medical)
 * @param {string} uuid - The filename UUID from patientScheduleRequirement
 * @returns {Promise<{ blobUrl: string, contentType: string }>}
 */
export const fetchRequirementFile = async (uuid) => {
  const response = await axiosRequest.get(`/media/record/appointmentRequirement/${uuid}`, {
    responseType: 'blob',
  });
  const contentType = response.headers?.['content-type'] || '';
  const blobUrl = URL.createObjectURL(response.data);
  return { blobUrl, contentType };
};

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

export const LOCATION = {
  ARLEGUI: 'Arlegui',
  CASAL: 'Casal',
  QC: 'QuezonCity',
};

export const ALL_STATUSES = Object.values(STATUS);
export const ALL_LOCATIONS = Object.values(LOCATION);

// ── Internal helper ──────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/appointment/medical', {
    query,
    variables,
  });

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }

  return response.data.data;
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Search appointments by status (paginated).
 * @param {string} status - SCHEDULING_STATUS value
 * @param {number} [offset=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} patientSlot[]
 */
export const searchByStatus = async (status, offset = 0, limit = 20, { date, schedulerId } = {}) => {
  const data = await sendGraphQL(`
    query SearchAppointmentStatuses($status: SCHEDULING_STATUS!, $offset: Int, $limit: Int, $date: Date, $schedulerId: ID) {
      searchAppointmentStatuses(status: $status, offset: $offset, limit: $limit, date: $date, schedulerId: $schedulerId) {
        id
        patientId
        patientIdentifier
        patientName
        patientEmail
        slotEntityId
        status
        session
        scheduledDate
        schedulerLabel
        approvedBy
        purpose
        notes
        arrived_at
        created_at
        requirements {
          id
          scheduleRequirementId
          filename
          created_at
        }
      }
    }
  `, { status, offset, limit, date: date || null, schedulerId: schedulerId || null });
  return data.searchAppointmentStatuses;
};

/**
 * Get appointment counts grouped by status, optionally filtered.
 * @param {{ schedulerId?: string, date?: string }} [filters]
 * @returns {Promise<Object>} e.g. { Pending: 5, Scheduled: 10, ... }
 */
export const getStatusCounts = async ({ schedulerId, date } = {}) => {
  const data = await sendGraphQL(`
    query GetAppointmentStatusCounts($schedulerId: ID, $date: Date) {
      getAppointmentStatusCounts(schedulerId: $schedulerId, date: $date) {
        status
        count
      }
    }
  `, { schedulerId: schedulerId || null, date: date || null });
  const counts = {};
  for (const { status, count } of data.getAppointmentStatusCounts) {
    counts[status] = count;
  }
  return counts;
};

/**
 * Get a specific patient's current appointment status.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
/**
 * Resolve a patient's internal userId from their student/employee identifier.
 * @param {number} identifier - Student or employee ID number
 * @returns {Promise<string|null>}
 */
export const resolvePatientByIdentifier = async (identifier) => {
  const data = await sendGraphQL(`
    query ResolvePatientByIdentifier($identifier: Int!) {
      resolvePatientByIdentifier(identifier: $identifier)
    }
  `, { identifier: Number(identifier) });
  return data.resolvePatientByIdentifier;
};

export const getPatientStatus = async (userId) => {
  const data = await sendGraphQL(`
    query GetUserAppointmentStatus($userId: ID!) {
      getUserAppointmentStatus(userId: $userId)
    }
  `, { userId });
  return data.getUserAppointmentStatus;
};

/**
 * Get all appointment records for a patient.
 * @param {string} userId
 * @param {number} [offset=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} patientSlot[]
 */
export const getPatientRecords = async (userId, offset = 0, limit = 20) => {
  const data = await sendGraphQL(`
    query GetUserAppointmentRecords($userId: ID!, $offset: Int, $limit: Int) {
      getUserAppointmentRecords(userId: $userId, offset: $offset, limit: $limit) {
        id
        patientId
        patientIdentifier
        patientName
        slotEntityId
        status
        session
        approvedBy
        purpose
        notes
        arrived_at
        created_at
        requirements {
          id
          scheduleRequirementId
          filename
          created_at
        }
      }
    }
  `, { userId, offset, limit });
  return data.getUserAppointmentRecords;
};

/**
 * List all schedulers (no whitelist filter).
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} SlotScheduler[]
 */
export const listAllSchedulers = async (offset = 0, limit = 50) => {
  const data = await sendGraphQL(`
    query ListAllOpenAppointments($offset: Int, $limit: Int) {
      listAllOpenAppointments(offset: $offset, limit: $limit) {
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
        created_at
      }
    }
  `, { offset, limit });
  return data.listAllOpenAppointments;
};

/**
 * List all requirements for a scheduler (active + inactive).
 * @param {string} schedulerId
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} ScheduleRequirement[]
 */
export const listAllRequirements = async (schedulerId, offset = 0, limit = 50) => {
  const data = await sendGraphQL(`
    query ListAllAppointmentRequirements($schedulerId: ID!, $offset: Int, $limit: Int) {
      listAllAppointmentRequirements(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id
        slotId
        label
        notes
        isDigital
        isActive
      }
    }
  `, { schedulerId, offset, limit });
  return data.listAllAppointmentRequirements;
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

/**
 * List custom dates for a scheduler (with slot info).
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
        slotScheduleId
        scheduledDate
        morningAllowed
        afternoonAllowed
        created_at
      }
    }
  `, { schedulerId, offset, limit });
  return data.listCustomDates;
};

// ── Mutations — Appointment Responses ────────────────────────────────────────

/**
 * Approve or reject a pending appointment.
 * @param {string} userId
 * @param {'Scheduled'|'Rejected'|'CancelledByMedical'|'Completed'} status
 * @param {string} [notes]
 * @param {string} [slotId] - Preferred: pass the slot ID directly to avoid stale-lookup bugs
 * @returns {Promise<object>} patientSlot
 */
export const respondToAppointment = async (userId, status, notes, slotId = null) => {
  const data = await sendGraphQL(`
    mutation RespondAppointment($userId: ID!, $slotId: ID, $status: SCHEDULING_STATUS!, $notes: String) {
      respondAppointment(userId: $userId, slotId: $slotId, status: $status, notes: $notes) {
        id
        patientId
        status
        session
        notes
      }
    }
  `, { userId, slotId, status, notes });
  return data.respondAppointment;
};

/**
 * Record patient arrival (Scheduled → InProgress).
 * @param {string} slotId
 * @param {string} arrivedAt - ISO timestamp
 * @returns {Promise<object>} patientSlot
 */
export const recordAttendance = async (slotId, arrivedAt) => {
  const data = await sendGraphQL(`
    mutation RecordAppointmentAttendance($slotId: ID!, $arrived_at: Date!) {
      recordAppointmentAttendance(slotId: $slotId, arrived_at: $arrived_at) {
        id
        patientId
        status
        arrived_at
      }
    }
  `, { slotId, arrived_at: arrivedAt });
  return data.recordAppointmentAttendance;
};

// ── Mutations — Scheduler CRUD ───────────────────────────────────────────────

/**
 * Create a new scheduler.
 * @param {object} input - SlotSchedulerInput
 * @returns {Promise<object>} SlotScheduler
 */
export const createScheduler = async (input) => {
  const data = await sendGraphQL(`
    mutation CreateScheduler($input: SlotSchedulerInput!) {
      createScheduler(input: $input) {
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
        created_at
      }
    }
  `, { input });
  return data.createScheduler;
};

/**
 * Update an existing scheduler.
 * @param {string} schedulerId
 * @param {object} input - SlotSchedulerUpdateInput
 * @returns {Promise<object>} SlotScheduler
 */
export const updateScheduler = async (schedulerId, input) => {
  const data = await sendGraphQL(`
    mutation UpdateScheduler($schedulerId: ID!, $input: SlotSchedulerUpdateInput!) {
      updateScheduler(schedulerId: $schedulerId, input: $input) {
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
  `, { schedulerId, input });
  return data.updateScheduler;
};

/**
 * Delete a scheduler.
 * @param {string} schedulerId
 * @returns {Promise<boolean>}
 */
export const deleteScheduler = async (schedulerId) => {
  const data = await sendGraphQL(`
    mutation DeleteScheduler($schedulerId: ID!) {
      deleteScheduler(schedulerId: $schedulerId)
    }
  `, { schedulerId });
  return data.deleteScheduler;
};

// ── Mutations — Requirements ─────────────────────────────────────────────────

/**
 * Add or update a requirement for a scheduler.
 * @param {string} schedulerId
 * @param {object} input - ScheduleRequirementInput
 * @returns {Promise<object>} ScheduleRequirement
 */
export const updateRequirement = async (schedulerId, input) => {
  const data = await sendGraphQL(`
    mutation UpdateSchedulerRequirement($schedulerId: ID!, $input: ScheduleRequirementInput!) {
      updateSchedulerRequirement(schedulerId: $schedulerId, input: $input) {
        id
        slotId
        label
        notes
        isDigital
        isActive
      }
    }
  `, { schedulerId, input });
  return data.updateSchedulerRequirement;
};

/**
 * Delete a requirement by label.
 * @param {string} schedulerId
 * @param {string} label
 * @returns {Promise<boolean>}
 */
export const deleteRequirement = async (schedulerId, label) => {
  const data = await sendGraphQL(`
    mutation DeleteSchedulerRequirement($schedulerId: ID!, $label: String!) {
      deleteSchedulerRequirement(schedulerId: $schedulerId, label: $label)
    }
  `, { schedulerId, label });
  return data.deleteSchedulerRequirement;
};

// ── Mutations — Custom Dates ─────────────────────────────────────────────────

/**
 * Add custom open dates to a scheduler with optional slot configuration.
 * @param {string} schedulerId
 * @param {Array<{scheduledDate: string, morningAllowed?: number, afternoonAllowed?: number}>} dates
 * @returns {Promise<Array>} SlotCustomDateEntry[]
 */
export const setCustomDates = async (schedulerId, dates) => {
  const data = await sendGraphQL(`
    mutation SetCustomDates($schedulerId: ID!, $dates: [SlotCustomDateInput!]!) {
      setCustomDates(schedulerId: $schedulerId, dates: $dates) {
        id
        slotScheduleId
        scheduledDate
        morningAllowed
        afternoonAllowed
        created_at
      }
    }
  `, { schedulerId, dates });
  return data.setCustomDates;
};

/**
 * Remove custom dates from a scheduler.
 * @param {string} schedulerId
 * @param {string[]} dates
 * @returns {Promise<string[]>}
 */
export const unsetCustomDates = async (schedulerId, dates) => {
  const data = await sendGraphQL(`
    mutation UnsetCustomDates($schedulerId: ID!, $dates: [Date!]!) {
      unsetCustomDates(schedulerId: $schedulerId, dates: $dates)
    }
  `, { schedulerId, dates });
  return data.unsetCustomDates;
};

// ── Mutations — Whitelist ────────────────────────────────────────────────────

/**
 * Add patients to a scheduler's whitelist.
 * @param {string} schedulerId
 * @param {string[]} patientIds
 * @returns {Promise<string[]>}
 */
export const addWhitelist = async (schedulerId, patientIds) => {
  const data = await sendGraphQL(`
    mutation AddEntryWhitelist($schedulerId: ID!, $patientIds: [ID!]!) {
      addEntryWhitelist(schedulerId: $schedulerId, patientIds: $patientIds)
    }
  `, { schedulerId, patientIds });
  return data.addEntryWhitelist;
};

/**
 * Remove patients from a scheduler's whitelist.
 * @param {string} schedulerId
 * @param {string[]} patientIds
 * @returns {Promise<string[]>}
 */
export const removeWhitelist = async (schedulerId, patientIds) => {
  const data = await sendGraphQL(`
    mutation RemoveEntryWhitelist($schedulerId: ID!, $patientIds: [ID!]!) {
      removeEntryWhitelist(schedulerId: $schedulerId, patientIds: $patientIds)
    }
  `, { schedulerId, patientIds });
  return data.removeEntryWhitelist;
};

/**
 * List all patients in a scheduler's whitelist.
 * @param {string} schedulerId
 * @param {number} [offset=0]
 * @param {number} [limit=50]
 * @returns {Promise<Array>} WhitelistEntry[]
 */
export const listWhitelist = async (schedulerId, offset = 0, limit = 50) => {
  const data = await sendGraphQL(`
    query ListSchedulerWhitelist($schedulerId: ID!, $offset: Int, $limit: Int) {
      listSchedulerWhitelist(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id
        slotSchedulerId
        patientId
        patientIdentifier
        patientName
      }
    }
  `, { schedulerId, offset, limit });
  return data.listSchedulerWhitelist;
};

// ── Mutations — Date Identity ────────────────────────────────────────────────

/**
 * Override slot counts for a specific calendar date.
 * @param {string} schedulerId
 * @param {string} date
 * @param {object} input - ScheduleDateEntityUpdate
 * @returns {Promise<object>} ScheduleDateEntity
 */
export const updateDateIdentity = async (schedulerId, date, input) => {
  const data = await sendGraphQL(`
    mutation UpdateDateIdentity($schedulerId: ID!, $date: Date!, $input: ScheduleDateEntityUpdate!) {
      updateDateIdentity(schedulerId: $schedulerId, date: $date, input: $input) {
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
  `, { schedulerId, date, input });
  return data.updateDateIdentity;
};
