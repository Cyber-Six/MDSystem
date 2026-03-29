const Wrapper = require("../wrapper/wrapper.js");
const path = require("path");
const dotenv = require("dotenv");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { getStudentBranchFromEmail, isStudentEmail, isEmployeeEmail, isMedicalEmail } = require("../../../../utils/validator.js");
const db = require("../../../../config/query.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });
const logger = require("../../../../utils/logger.js");
const { get } = require("http");
// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

Query = {

  getCredentialStatus: async (_, __, { user, res }) => { // getting the credential status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Query._getUserCredentialStatus(_, { userId: user.id }, { user, res });
    return result;
  },

  getPersonalRecord: async (_, __, { user, res }) => { // getting the main account record of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getUserPersonalRecord(_, { userId: user.id }, { user, res });
  },

  getPersonalRecordLog: async (_, __, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const rows = await Wrapper.Query._getUserPersonalRecordLog(_, { userId: user.id, offset: 0, limit: 1 }, { user, res });
    return rows?.[0] || null;
  },

  getPersonalRecordLogStatus: async (_, __, { user, res }) => { // getting the update status of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId: user.id }, { user, res });
    return result?.status;
  },

  getBranchIdentifier: async (_, __, { user, res }) => { // getting the identifier and the branch of the logged in user
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getBranchIdentifier(_, { userId: user.id }, { user, res });
  },

  getLoginEmail: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    // Queries UserCredentials directly — reliable for all users including unverified
    const email = await db.findEmailByUserId(user.id);
    return email || null;
  },
};

Mutation = {
  createInitialPersonalRecord: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const credentialStatus = await Wrapper.Query._getUserCredentialStatus(_, { userId: user.id }, { user, res });
    if (credentialStatus !== "Unverified") {
      throwGraphQLError(res).message("Initial profile can only be created for unverified users.").status(400).throw();
      }

    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId: user.id }, { user, res });
    if (latest?.status === "Pending" || latest?.status === "InProgress") {
      throwGraphQLError(res).message("An update is already in progress. Please wait for it to complete before creating a new one.").status(400).throw();
      }
    if (latest?.status === "Revision" || latest?.status === "RevisionSubmitted"){
      throwGraphQLError(res).message("Revision still pending. Please complete the revision before creating a new update.").status(400).throw();
    }

    // added the branch auto-detection based on email domain and prefix for students, employees, and medical staff
    const getEmail = await db.findEmailByUserId(user.id);
    if (!getEmail) {
      throwGraphQLError(res).message("Email not found for the user.").status(400).throw();
    }
    
    if (isStudentEmail(getEmail)) { // derive Manila/QuezonCity from the student email prefix
      input.branch = getStudentBranchFromEmail(getEmail);
      if (!input.branch) {
        throwGraphQLError(res).message("Unable to determine branch from email. Please provide a valid student email.").status(400).throw();
      }
    } else {
      // Use user-supplied branch if provided; fall back to 'Both'
      if (!input.branch) input.branch = 'Both';
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");
      const personalResult = await Wrapper.Mutation._PersonalRecordLog(_, { client, userId: user.id, input }, { user, res });
      const identifierResult = await Wrapper.Mutation._UserBranchIdentifier(_, { client, userId: user.id, input }, { user, res });
      await client.query("COMMIT");
      return { ...identifierResult, ...personalResult };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Error creating initial personal record:", error);
      throwGraphQLError(res).message("Failed to create initial personal record. Please try again later.").status(500).throw();
    } finally {
      client.release();
    }
  },

  createPersonalRecordLog: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const credential_status = await Wrapper.Query._getUserCredentialStatus(_, { userId: user.id }, { user, res });
    if (!["Active", "Inactive"].includes(credential_status)) {
      throwGraphQLError(res).message("Only active or inactive users can create update tickets. Please contact support.").status(403).throw();
    }

    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId: user.id }, { user, res });
    if (latest?.status === "Pending" || latest?.status === "InProgress") {
      throwGraphQLError(res).message("An update is already in progress. Please wait for it to complete before creating a new one.").status(400).throw();
      }
    if (latest?.status === "Revision" || latest?.status === "RevisionSubmitted"){
      throwGraphQLError(res).message("Revision still pending. Please complete the revision before creating a new update.").status(400).throw();
    }
    return await Wrapper.Mutation._PersonalRecordLog(_, { userId: user.id, input }, { user, res });
  },
  
  updatePatientPersonalRecordLog: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId: user.id }, { user, res });
    if (latest?.status === "Pending" || latest?.status === "InProgress") {
      throwGraphQLError(res).message("An update is already in progress. Please wait for it to complete before creating a new one.").status(400).throw();
      }
    if (latest?.status === "Revision" || latest?.status === "RevisionSubmitted"){
      throwGraphQLError(res).message("Revision still pending. Please complete the revision before creating a new update.").status(400).throw();
    }
    return await Wrapper.Mutation._PersonalRecordLog(_, { userId: user.id, input }, { user, res });
  },
  
  cancelPersonalRecordLog: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const latest = await Wrapper.Query._getUserPersonalRecordLogStatus(_, { userId: user.id }, { user, res });
    if (latest?.status !== "Pending" && latest?.status !== "InProgress") {
      throwGraphQLError(res).message("No active update found to cancel.").status(400).throw();
      }
    return await Wrapper.Mutation._cancelPersonalRecordLog(_, { userId: user.id }, { user, res });
  },

  reloadCredentialStatus: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    const result = await Wrapper.Mutation._reloadCredentialStatus(_, { userId: user.id }, { user, res });
    return result;
  }
};




module.exports = { Query, Mutation };
