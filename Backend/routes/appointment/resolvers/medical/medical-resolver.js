const path = require("path");
const dotenv = require("dotenv");
const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const permit = require("../../../../services/permit.js");
const { notifyUser } = require('../../../../config/sockets/socket-emitter');

const db = require("../../../../config/query.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  getUserAppointmentStatus: async (_, { userId }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records, userId);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserAppointmentStatus(_, { userId }, { user, res });
  },

  getUserAppointmentRecords: async (_, { userId, offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records, userId);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserAppointmentRecords(_, { userId, offset, limit }, { user, res });
  },

  resolvePatientByIdentifier: async (_, { identifier }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._resolvePatientByIdentifier(_, { identifier }, { user, res });
  },

  listAllOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAllOpenAppointments(_, { offset, limit }, { user, res });
  },

  listCustomDates: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listCustomDates(_, { schedulerId, offset, limit }, { user, res });
  },

  listAllAppointmentRequirements: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAllAppointmentRequirements(_, { schedulerId, offset, limit, isActive: null }, { user, res });
  },

  searchAppointmentStatuses: async (_, { status, offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._searchAppointmentStatuses(_, { status, offset, limit }, { user, res });
  },

  getAppointmentStatusCounts: async (_, _args, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_records, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getAppointmentStatusCounts(_, _args, { user, res });
  },

  listAppointmentSchedule: async (_, { schedulerId, date }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listAppointmentSchedule(_, { schedulerId, date, skipTimeframe: true }, { user, res });
  },

  listMonthAvailability: async (_, { schedulerId, startDate, endDate }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listMonthAvailability(_, { schedulerId, startDate, endDate }, { user, res });
  },

  listSchedulerWhitelist: async (_, { schedulerId, offset, limit }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_view_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._listSchedulerWhitelist(_, { schedulerId, offset, limit }, { user, res });
  },
};

const Mutation = {
  respondAppointment: async (_, { userId, slotId, status, notes }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_approval, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let targetSlotId = slotId;

    if (!targetSlotId) {
      // Fall back to finding the latest slot by userId when slotId is not provided
      const record = await Wrapper.Query._getUserAppointmentRecords(_, { userId, offset: 0, limit: 1 }, { user, res });
      if (!record || record.length === 0) {
        throwGraphQLError(res).message("No appointment record found for the user").status(404).throw();
      }
      targetSlotId = record[0].id;
    }

    const result = await Wrapper.Mutation._respondAppointment(_, { slotId: targetSlotId, status, notes }, { user, res });

    // Notify the patient of the appointment response
    const notifyUserId = userId || result.patientId;
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
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_approval, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await Wrapper.Mutation._recordAppointmentAttendance(_, { slotId, arrived_at }, { user, res });
    
    // Notify user of attendance record
    await notifyUser(
      result.userId,
      'appointment:attendance-recorded',
      { slotId, arrived_at },
      {
        email: await db.findEmailByUserId(result.userId),
        title: 'Attendance Recorded',
        message: 'Your appointment attendance has been recorded.',
      }
    );
    
    return result;
  },

  createScheduler: async (_, { input }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._createScheduler(_, { input }, { user, res });
  },

  updateScheduler: async (_, { schedulerId, input }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._updateScheduler(_, { schedulerId, input }, { user, res });
  },

  deleteScheduler: async (_, { schedulerId }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._deleteScheduler(_, { schedulerId }, { user, res });
  },

  updateSchedulerRequirement: async (_, { schedulerId, input }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._updateSchedulerRequirement(_, { schedulerId, input }, { user, res });
  },

  deleteSchedulerRequirement: async (_, { schedulerId, label }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._deleteSchedulerRequirement(_, { schedulerId, label }, { user, res });
  },

  setCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._setCustomDates(_, { schedulerId, dates }, { user, res });
  },

  unsetCustomDates: async (_, { schedulerId, dates }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._unsetCustomDates(_, { schedulerId, dates }, { user, res });
  },

  addEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._addEntryWhitelist(_, { schedulerId, patientIds }, { user, res });
  },

  removeEntryWhitelist: async (_, { schedulerId, patientIds }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._removeEntryWhitelist(_, { schedulerId, patientIds }, { user, res });
  },

  updateDateIdentity: async (_, { schedulerId, date, input }, { user, res }) => {
    const permitted = await permit.isMedicalPermitted(user.id, permit.permissions.appointment_allow_edit_configuration, null);
    if (!permitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    return await Wrapper.Mutation._updateDateIdentity(_, { schedulerId, date, input }, { user, res });
  }
};

module.exports = { Query, Mutation };
