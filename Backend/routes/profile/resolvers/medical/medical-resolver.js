const path = require("path");
const dotenv = require("dotenv");
const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const permit = require("../../../../services/permit.js");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  getUserCredentialStatus: async (_, { userId }, { user, res }) => { // getting the credential status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const result = await Wrapper.Query._getUserCredentialStatus(_, { userId }, { user, res });
    return result;
   },

  getUserPersonalRecord: async (_, { userId }, { user, res }) => { // getting the main account record of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_view, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to view personal record of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserPersonalRecord(_, { userId }, { user, res });
  },

  getUserPersonalRecordLogStatus: async (_, { userId }, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_view, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to view personal record log status of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId }, { user, res });
    return result?.status;
   },

  getUserPersonalRecordLog: async (_, { userId, from, offset, limit }, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_view, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to view personal record log of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await Wrapper.Query._getUserPersonalRecordLog(_, { userId, from, offset, limit }, { user, res });
    return result;
   },

  getUserLoginCredentials: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_view, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to view login credentials of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await Wrapper.Query._getUserLoginCredentials(_, { userId }, { user, res });
    return result || null;
  },
};

const Mutation = {
  createPersonalRecordLog: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    throwGraphQLError(res).message("This endpoint is deprecated, please use updatePersonalRecordLog instead").status(400).throw();

    // record self update is allowed for staff
    await Wrapper.Mutation._PersonalRecordLog(_, { userId: user.id, input }, { user, res });
    return await Mutation.setPersonalRecordLog(_, { userId: user.id, status: "Approved" }, { user, res });
  },

  updatePersonalRecordLog: async (_, { userId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_edit, userId);  
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update personal record log of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId }, { user, res });
    if (latest.status !== "Pending" && latest.status !== "Revision") {
      throwGraphQLError(res).message("Not in Pending nor Revision log state.").status(400).throw();
    }

    const result = await Wrapper.Mutation._StaffUpdatePersonalRecordLog(_, { userId, id: latest.id, input }, { user, res });
    return result;
   },
  
  setPersonalRecordLog: async (_, { userId, status }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_approval, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to set personal record log of user ${userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const validStatuses = ["Revision", "Approved", "Rejected"];
    if (!validStatuses.includes(status)) {
      throwGraphQLError(res).message("Invalid status").status(400).throw();
    }

    const result = await Wrapper.Mutation._setPersonalRecordLog(_, { userId, status }, { user, res });
    await Wrapper.Mutation._reloadCredentialStatus(_, { userId }, { user, res }); // reload credential status after approval
    return result;
  },

  reloadUserCredentialStatus: async (_, { userId }, { user, res }) => {
    if (!user) { // totally safe unction no need to set roles
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Mutation._reloadCredentialStatus(_, { userId }, { user, res });
    return result;
  },

  staffSetBranchIdentifier: async (_, { userId, identifier, branch }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.profile_allow_edit, userId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    await Wrapper.Mutation._UserBranchIdentifier(_, { userId, input: { identifier, branch } }, { user, res });
    return true;
  },
};

module.exports = { Query, Mutation };
