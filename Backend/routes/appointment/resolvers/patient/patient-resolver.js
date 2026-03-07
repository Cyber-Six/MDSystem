const Wrapper = require("../wrapper/wrapper.js");
const path = require("path");
const dotenv = require("dotenv");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { getStudentBranchFromEmail } = require("../../../../utils/validator.js");
const db = require("../../../../config/query.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  listOpenAppointments: async (_, { offset, limit }, { user, res }) => {
    return await Wrapper.Query._listOpenAppointments(_, { offset, limit }, { user, res });
  },

  listCustomDates: async (_, { schedulerId, offset, limit }, { user, res }) => {
    return await Wrapper.Query._listCustomDates(_, { schedulerId, offset, limit }, { user, res });
  },

  listAppointmentSchedule: async (_, { schedulerId, date }, { user, res }) => {
    return await Wrapper.Query._listAppointmentSchedule(_, { schedulerId, date }, { user, res });
  },

  listAppointmentRequirements: async (_, { schedulerId, offset, limit }, { user, res }) => {
    return await Wrapper.Query._listAllAppointmentRequirements(_, { schedulerId, offset, limit, isActive: true }, { user, res });
  },

  getAppointmentStatus: async (_, __, { user, res }) => {
  return await Wrapper.Query._getUserAppointmentStatus(_, { userId: user.id, }, { user, res });
  }
};

const Mutation = {
  submitAppointment: async (_, { schedulerId, date, session, requirements }, { user, res }) => {
    const userStatus = await Wrapper.Query._getUserAppointmentStatus(_, { userId: user.id }, { user, res });

    if (userStatus && ["Pending", "Scheduled", "InProgress"].includes(userStatus)) {
      throwGraphQLError(res).message("User already has an active appointment").status(400).throw();
    }

    const result = await Wrapper.Mutation._submitAppointment(_, { schedulerId, date, session, requirements }, { user, res });
    return result;
  },

  cancelAppointment: async (_, __, { user, res }) => {
    const userRecord = await Wrapper.Query._getUserAppointmentRecords(_, { userId: user.id, offset: 0, limit: 1 }, { user, res });

    if (!userRecord || !["Pending", "Scheduled", "InProgress"].includes(userRecord[0].status)) {
      throwGraphQLError(res).message("No active appointment found to cancel").status(404).throw();
    }

    const result = await Wrapper.Mutation._cancelAppointment(_, { patientId: user.id, cancelledBy: user.id, slotId: userRecord[0].id }, { user, res });
    return result.success;
  },
};




module.exports = { Query, Mutation };
