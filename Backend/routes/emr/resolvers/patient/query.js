const Wrapper = require("../../wrapper/query.js");


const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { getOralFindingCatalogs } = require("../medical/query.js");
dotenv.config({ path: path.resolve(__dirname, "../../env") });


//const BorrowQuery = require("../medical/query.js");

const Query = {
  getUpdateTicket: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserUpdateTicket(_, {userId: user.id}, { user, res });
    console.log("Get Update Ticket:", result);
    return result; // return scalar ID
  },

  getProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },


  getDentalPhotos: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalPhotos(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getObgynHistory: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserObgynHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getLifestyle: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserLifestyle(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalHistory: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalRecord: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalRecord(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getVitalSigns: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserVitalSigns(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },
  
  getOralApplianceProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserOralApplianceProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getEmergencyContact: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserEmergencyContact(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getAllergyProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserAllergyProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getMedicationProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserMedicationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalProcedureProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserDentalProcedureProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getImmunizationProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserImmunizationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getOperationProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserOperationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getHospitalizationProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserHospitalizationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getMedicalHistory: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserMedicalHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getVisualAcuityProfile: async (_, __, { user, res }) => {
    const result = await Wrapper._getUserVisualAcuityProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

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


};


module.exports = Query;