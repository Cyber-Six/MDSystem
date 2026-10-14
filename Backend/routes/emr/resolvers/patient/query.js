const Wrapper = require("../../wrapper/query.js");


const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

const getPatientRecord = async (resolver, _, { pending = false }, { user, res }) => {
  const statuses = pending ? ["Pending"] : null;
  const result = await Wrapper[resolver](_, {
    userId: user.id, offset: 0, limit: 1, statuses,
  }, { user, res });
  if (result.length === 0) return null;

  const row = result[0];
  const allowedStatuses = pending ? ["Pending"] : ["InProgress", "Revision"];
  if (allowedStatuses.includes(row.status)) return row;

  throwGraphQLError(res).message("No active profile found.").status(404).throw();
};


//const BorrowQuery = require("../medical/query.js");

const Query = {
  getUpdateTicket: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserUpdateTicket(_, {userId: user.id}, { user, res });
    if (!(result?.id)) return null; // No ticket found at all
    return result; // return scalar ID
  },

  getProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserProfile(_, {userId: user.id, offset: 0, limit: 1, statuses: null }, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  // Returns the most recent profile record of any status — used by profile display components
  // to show the patient's year level / program / department without requiring an active form.
  getMyProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserProfile(_, { userId: user.id, offset: 0, limit: 1, statuses: null }, { user, res });
    if (result.length === 0) return null;
    return result[0];
  },


  getDentalPhotoRecord: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalPhotoRecord(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getObgynHistory: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserObgynHistory(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getLifestyle: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserLifestyle(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalHistory: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalHistory(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },
  
  getOralApplianceProfile: (_, args, context) => getPatientRecord("_getUserOralApplianceProfile", _, args, context),

  getEmergencyContact: async (_,  { approved }, { user, res }) => {
    const statuses = approved ? ["Approved"] : null;
    const result = await Wrapper._getUserEmergencyContact(_, {userId: user.id, offset: 0, limit: 1, statuses}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision" || result[0].status === "Approved") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getAllergyProfile: (_, args, context) => getPatientRecord("_getUserAllergyProfile", _, args, context),

  getMedicationProfile: (_, args, context) => getPatientRecord("_getUserMedicationProfile", _, args, context),

  getDentalProcedureProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalProcedureProfile(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getImmunizationProfile: (_, args, context) => getPatientRecord("_getUserImmunizationProfile", _, args, context),

  getOperationProfile: (_, args, context) => getPatientRecord("_getUserOperationProfile", _, args, context),

  getHospitalizationProfile: (_, args, context) => getPatientRecord("_getUserHospitalizationProfile", _, args, context),

  getMedicalHistory: (_, args, context) => getPatientRecord("_getUserMedicalHistory", _, args, context),

  getVisualAcuityProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserVisualAcuityProfile(_, {userId: user.id, offset: 0, limit: 1, statuses: null}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress" || result[0].status === "Revision") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getProcedureDomain: async (_, __, { user, res }) => {
    const result = await Wrapper._getProcedureDomain(_, {}, { user, res });
    return result;
  },

  getDomainCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._getDomainCatalogs(_, args, { user, res });
    return result;
  },

  getAllergenCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._getAllergenCatalogs(_, args, { user, res });
    return result;
  },

  getOralApplianceCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._getOralApplianceCatalogs(_, args, { user, res });
    return result;
  },

  // search
  searchDomainCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._searchDomainCatalogs(_, args, { user, res });
    return result;
  },

  searchAllergenCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._searchAllergenCatalogs(_, args, { user, res });
    return result;
  },

  searchOralApplianceCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._searchOralApplianceCatalogs(_, args, { user, res });
    return result;
  },

  searchStudentProgram: async (_, args, { user, res }) => {
    const result = await Wrapper._searchStudentProgram(_, args, { user, res });
    return result;
  },

  getPatientBasicInfo: async (_, __, { user, res }) => {
    const row = await Wrapper._getPatientBasicInfo(_, { userId: user.id }, { user, res });
    return row || null;
  },


};


module.exports = Query;
