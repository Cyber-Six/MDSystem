const path = require("path");
const dotenv = require("dotenv");
const Mutation = require("../../../emr/wrapper/mutation");
const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { get } = require("http");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires


const UserProfile = {
  __resolveType(obj) {
    if (obj.program) return "StudentProfile";
    if (obj.department) return "EmployeeProfile";
    return null;
  },
};

Query = {
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
    return await Wrapper.Query._getUserPersonalRecord(_, { userId }, { user, res });
  },

  getUserPersonalRecordLogStatus: async (_, { userId }, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId }, { user, res });
    return result?.status;
   },

  getUserPersonalRecordLog: async (_, { userId, from, offset, limit }, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Query._getUserPersonalRecordLog(_, { userId, from, offset, limit }, { user, res });
    return result;
   },

  getBranchIdentifier: async (_, { userId }, { user, res }) => { // getting the identifier and the branch of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getBranchIdentifier(_, { userId }, { user, res }); 
  },
};

Mutation = {
  updatePersonalRecordLog: async (_, { userId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId }, { user, res });
    const result = await Wrapper.Mutation._StaffUpdatePersonalRecordLog(_, { userId, id: latest.id, input }, { user, res });
    return result;
   },

  updateUserBranchIdentifier: async (_, { userId, input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Mutation._UserBranchIdentifier(_, { userId, input }, { user, res });
    return result;
   },
  
  setPersonalRecordLog: async (_, { userId, status }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Mutation._setPersonalRecordLog(_, { userId, status }, { user, res });
    return result;
  },

  reloadUserCredentialStatus: async (_, { userId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Mutation._reloadCredentialStatus(_, { userId }, { user, res });
    return result;
  }
};

module.exports = { Query, Mutation, UserProfile };
