const Wrapper = require("../wrapper/wrapper.js");
const path = require("path");
const dotenv = require("dotenv");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { getStudentBranchFromEmail, ValidateBranchbyUserBranch } = require("../../../../utils/validator.js");
const { emitToRoom } = require("../../../../config/sockets");
const logger = require("../../../../utils/logger.js");
const db = require("../../../../config/query.js");
const { getBranchFromShedulerId } = require("../wrapper/helper.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  listOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    return await Wrapper.Query._listOpenAppointments(_, { offset, limit }, { user, res });
  },

  listCustomDates: async (_, { schedulerId, offset, limit }, { user, res }) => {
    await validateUserBranchAccess({ schedulerId, userId: user.id, res });

    return await Wrapper.Query._listCustomDates(_, { schedulerId, offset, limit }, { user, res });
  },

  listAppointmentSchedule: async (_, { schedulerId, date }, { user, res }) => {
    await validateUserBranchAccess({ schedulerId, userId: user.id, res });

    return await Wrapper.Query._listAppointmentSchedule(_, { schedulerId, date }, { user, res });
  },

  listMonthAvailability: async (_, { schedulerId, startDate, endDate }, { user, res }) => {
    await validateUserBranchAccess({ schedulerId, userId: user.id, res });

    return await Wrapper.Query._listMonthAvailability(_, { schedulerId, startDate, endDate }, { user, res });
  },

  listAppointmentRequirements: async (_, { schedulerId, offset, limit }, { user, res }) => {
    await validateUserBranchAccess({ schedulerId, userId: user.id, res });
    
    return await Wrapper.Query._listAllAppointmentRequirements(_, { schedulerId, offset, limit, isActive: true }, { user, res });
  },

  getAppointmentStatus: async (_, __, { user, res }) => {
    const records = await Wrapper.Query._getUserAppointmentRecords(_, { userId: user.id, offset: 0, limit: 1 }, { user, res });
    return records && records.length > 0 ? records[0] : null;
  },
};

const Mutation = {
  submitAppointment: async (_, { schedulerId, date, session, requirements, purpose }, { user, res }) => {
    await validateUserBranchAccess({ schedulerId, userId: user.id, res });

    const userStatus = await Wrapper.Query._getUserAppointmentStatus(_, { userId: user.id }, { user, res });

    if (userStatus && ["Pending", "Scheduled", "InProgress"].includes(userStatus)) {
      throwGraphQLError(res).message("User already has an active appointment").status(400).throw();
    }

    const result = await Wrapper.Mutation._submitAppointment(_, { schedulerId, date, session, requirements, purpose }, { user, res });

    // Notify medical staff in the target branch room for real-time queue visibility.
    try {
      const location = result.location;
      if (location) {
        emitToRoom(`branch:${location}`, "appointment:submitted", {
          slotId: result.id,
          patientId: user.id,
          schedulerId,
          date,
          session,
          location,
        });
      }
    } catch (notifErr) {
      logger.error("Failed to emit appointment submission notification:", notifErr);
    }

    return result;
  },

  cancelAppointment: async (_, __, { user, res }) => {
    const userRecord = await Wrapper.Query._getUserAppointmentRecords(_, { userId: user.id, offset: 0, limit: 1 }, { user, res });

    if (!userRecord || userRecord.length === 0 || !["Pending", "Scheduled", "InProgress"].includes(userRecord[0].status)) {
      throwGraphQLError(res).message("No active appointment found to cancel").status(404).throw();
    }

    const result = await Wrapper.Mutation._cancelAppointment(_, { patientId: user.id, cancelledBy: user.id, slotId: userRecord[0].id }, { user, res });
    return result.success;
  },
};

async function validateUserBranchAccess({ schedulerId, userId, res }) {
  // Run both queries concurrently
  const [scheduleBranch, userBranch] = await Promise.all([
    getBranchFromShedulerId(schedulerId),
    db.getUserBranch(userId)
  ]);

  // Branch validation logic
  if (!ValidateBranchbyUserBranch(userBranch, scheduleBranch)) {
    throwGraphQLError(res).message("Unauthorized").status(401).throw();
  }

  // Return both branches if downstream logic needs them
  return { scheduleBranch, userBranch };
}

module.exports = { Query, Mutation };
