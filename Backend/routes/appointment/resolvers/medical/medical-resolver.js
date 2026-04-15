const path = require("path");
const dotenv = require("dotenv");
const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const permit = require("../../../../services/permit.js");
const { notifyUser } = require('../../../../config/sockets/socket-emitter');
const { getBranchFromShedulerId, getPatientIdFromSlotId, getUserIDViaIdentifier } = require("../wrapper/helper.js");
const db = require("../../../../config/query.js");

/** Returns true when the given LOCATION_DESIGNATION is accessible from the given staff branch. */
function isLocationInBranch(staffBranch, location) {
  if (staffBranch === 'Both') return true;
  if (staffBranch === 'Manila') return ['Arlegui', 'Casal'].includes(location);
  if (staffBranch === 'QuezonCity') return location === 'QuezonCity';
  return false;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

async function getPatientIdFromSlotIdOrThrow(slotId, res) {
  try {
    return await getPatientIdFromSlotId(slotId);
  } catch (err) {
    const message = err?.message === 'Slot not found' ? 'Slot not found' : 'Failed to resolve slot';
    const statusCode = err?.message === 'Slot not found' ? 404 : 500;
    throwGraphQLError(res).message(message).status(statusCode).throw();
  }
}

async function resolvePatientId({ userId, patientIdentifier, getStaffBranch, res }) {
  if (hasValue(userId)) {
    return String(userId);
  }

  if (!hasValue(patientIdentifier)) {
    throwGraphQLError(res).message("Either userId or patientIdentifier is required").status(400).throw();
  }

  const staffBranch = await getStaffBranch();
  const users = await getUserIDViaIdentifier(String(patientIdentifier).trim(), staffBranch);
  if (!users || users.length === 0) {
    throwGraphQLError(res).message("No user found for the provided identifier").status(404).throw();
  }

  if (users.length > 1) {
    throwGraphQLError(res).message("Multiple users matched the provided identifier").status(409).throw();
  }

  return String(users[0].userId);
}

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  getUserAppointmentStatus: async (_, { userId, patientIdentifier }, { user, res }) => {
    const resolvedUserId = await resolvePatientId({
      userId,
      patientIdentifier,
      getStaffBranch: () => permit.getStaffBranch(user.id),
      res,
    });
    const permitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.appointment_allow_view_records, resolvedUserId, false);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserAppointmentStatus(_, { userId: resolvedUserId }, { user, res });
  },

  getUserAppointmentRecords: async (_, { userId, patientIdentifier, offset, limit }, { user, res }) => {
    const resolvedUserId = await resolvePatientId({
      userId,
      patientIdentifier,
      getStaffBranch: () => permit.getStaffBranch(user.id),
      res,
    });
    const permitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.appointment_allow_view_records, resolvedUserId, false);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserAppointmentRecords(_, { userId: resolvedUserId, offset, limit }, { user, res });
  },

  listAllOpenAppointments: async (_, { location, offset, limit }, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const staffBranch = await permit.getStaffBranch(user.id);
    // Reject if an explicit location is requested that falls outside the staff's branch
    if (location && !isLocationInBranch(staffBranch, location)) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAllOpenAppointments(_, { location, staffBranch, offset, limit }, { user, res });
  },

  listCustomDates: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listCustomDates(_, { schedulerId, offset, limit }, { user, res });
  },

  listAllAppointmentRequirements: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAllAppointmentRequirements(_, { schedulerId, offset, limit, isActive: null }, { user, res });
  },

  searchAppointmentStatuses: async (_, { status, location, date, schedulerId, offset, limit }, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const staffBranch = await permit.getStaffBranch(user.id);
    // Reject if an explicit cross-branch location is requested
    if (location && !isLocationInBranch(staffBranch, location)) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._searchAppointmentStatuses(_, { status, location, staffBranch, date, schedulerId, offset, limit }, { user, res });
  },

  getAppointmentStatusCounts: async (_, { location, schedulerId, date }, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const staffBranch = await permit.getStaffBranch(user.id);
    // Reject if an explicit cross-branch location is requested
    if (location && !isLocationInBranch(staffBranch, location)) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getAppointmentStatusCounts(_, { location, staffBranch, schedulerId, date }, { user, res });
  },

  listAppointmentSchedule: async (_, { schedulerId, date }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAppointmentSchedule(_, { schedulerId, date, skipTimeframe: true }, { user, res });
  },

  listMonthAvailability: async (_, { schedulerId, startDate, endDate }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listMonthAvailability(_, { schedulerId, startDate, endDate }, { user, res });
  },

  listSchedulerWhitelist: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listSchedulerWhitelist(_, { schedulerId, offset, limit }, { user, res });
  },

  checkDateOccupancy: async (_, { schedulerId, date }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_view_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._checkDateOccupancy(_, { schedulerId, date }, { user, res });
  },
};

const Mutation = {
  respondAppointment: async (_, { userId, patientIdentifier, slotId, status, notes }, { user, res }) => {
    let resolvedUserId = null;
    if (hasValue(userId) || hasValue(patientIdentifier)) {
      resolvedUserId = await resolvePatientId({
        userId,
        patientIdentifier,
        getStaffBranch: () => permit.getStaffBranch(user.id),
        res,
      });
    }

    const slotPatientId = slotId ? await getPatientIdFromSlotIdOrThrow(slotId, res) : null;

    if (
      resolvedUserId &&
      slotPatientId &&
      Number.parseInt(String(resolvedUserId), 10) !== Number.parseInt(String(slotPatientId), 10)
    ) {
      throwGraphQLError(res)
        .message("Provided slotId does not belong to the specified user")
        .status(400)
        .throw();
    }

    const patientId = resolvedUserId || slotPatientId;
    if (!patientId) {
      throwGraphQLError(res).message("Either slotId or userId/patientIdentifier is required").status(400).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.appointment_allow_approval, patientId, false);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let targetSlotId = slotId;

    if (!targetSlotId) {
      // Fall back to finding the latest slot by userId when slotId is not provided
      if (!resolvedUserId) {
        throwGraphQLError(res)
          .message("Either userId or patientIdentifier is required when slotId is not provided")
          .status(400)
          .throw();
      }

      const record = await Wrapper.Query._getUserAppointmentRecords(_, { userId: resolvedUserId, offset: 0, limit: 1 }, { user, res });
      if (!record || record.length === 0) {
        throwGraphQLError(res).message("No appointment record found for the user").status(404).throw();
      }
      targetSlotId = record[0].id;
    }

    const result = await Wrapper.Mutation._respondAppointment(_, { slotId: targetSlotId, status, notes }, { user, res });

    // Notify the patient of the appointment response
    const notifyUserId = resolvedUserId || result.patientId;
    await notifyUser(
      notifyUserId,
      'appointment:responded',
      { status, notes, slotId: targetSlotId },
      {
        email: await db.findEmailByUserId(result.patientId),
        title: 'Appointment Response',
        message: `Your appointment request has been ${status}.`,
        notes: notes || null,
      }
    );

    return result;
  },

  recordAppointmentAttendance: async (_, { slotId, arrived_at }, { user, res }) => {
    const patientId = await getPatientIdFromSlotIdOrThrow(slotId, res);
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.appointment_allow_approval, patientId, false);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await Wrapper.Mutation._recordAppointmentAttendance(_, { slotId, arrived_at }, { user, res });
    
    // Notify user of attendance record
    await notifyUser(
      result.patientId,
      'appointment:attendance-recorded',
      { slotId, arrived_at },
      {
        email: await db.findEmailByUserId(result.patientId),
        title: 'Attendance Recorded',
        message: 'Your appointment attendance has been recorded.',
      }
    );
    
    return result;
  },

  createScheduler: async (_, { input }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, input.location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._createScheduler(_, { input }, { user, res });
  },

  updateScheduler: async (_, { schedulerId, input }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._updateScheduler(_, { schedulerId, input }, { user, res });
  },

  deleteScheduler: async (_, { schedulerId }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._deleteScheduler(_, { schedulerId }, { user, res });
  },

  updateSchedulerRequirement: async (_, { schedulerId, input }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._updateSchedulerRequirement(_, { schedulerId, input }, { user, res });
  },

  deleteSchedulerRequirement: async (_, { schedulerId, label }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._deleteSchedulerRequirement(_, { schedulerId, label }, { user, res });
  },

  setCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._setCustomDates(_, { schedulerId, dates }, { user, res });
  },

  unsetCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._unsetCustomDates(_, { schedulerId, dates }, { user, res });
  },

  addEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._addEntryWhitelist(_, { schedulerId, patientIds }, { user, res });
  },

  removeEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._removeEntryWhitelist(_, { schedulerId, patientIds }, { user, res });
  },

  updateDateIdentity: async (_, { schedulerId, date, input }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    return await Wrapper.Mutation._updateDateIdentity(_, { schedulerId, date, input }, { user, res });
  },

  cancelDateAppointments: async (_, { schedulerId, date, reason }, { user, res }) => {
    const scheduleBranch = await getBranchFromShedulerId(schedulerId);
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.appointment_allow_edit_configuration, scheduleBranch);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._cancelDateAppointments(_, { schedulerId, date, reason }, { user, res });
  }
};

module.exports = { Query, Mutation };
