const Wrapper = require("../../wrapper/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const Query = {
  getUserUpdateTicket: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserUpdateTicket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const result = await Wrapper._getUserUpdateTicket(_, { userId: args.userId }, { user, res });
    return result; // return scalar ID
  },

  getUserProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },


  getUserDentalPhotoRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalPhotoRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalPhotoRecord(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserObgynHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserObgynHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserObgynHistory(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserLifestyle: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserLifestyle`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserLifestyle(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserDentalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalHistory(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserDentalRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalRecord(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserVitalSigns: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserVitalSigns`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserVitalSigns(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },
  
  getUserOralApplianceProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOralApplianceProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOralApplianceProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserEmergencyContact: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserEmergencyContact`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserEmergencyContact(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserAllergyProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserAllergyProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserAllergyProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserMedicationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicationProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserDentalProcedureProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalProcedureProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalProcedureProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserImmunizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserImmunizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserImmunizationProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserOperationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOperationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOperationProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserHospitalizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserHospitalizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserHospitalizationProfile(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserMedicalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicalHistory(_, args, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getUserVisualAcuityProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserVisualAcuityProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserVisualAcuityProfile(_, args, { user, res });
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

  getOralFindingCatalogs: async (_, args, { user, res }) => {
    const result = await Wrapper._getOralFindingCatalogs(_, args, { user, res });
    return result;
  },

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

  getStatusUpdateTickets: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_approval);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getStatusUpdateTickets`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getStatusUpdateTickets(_, args, { user, res });
    return result;
  },

  // ─── Patient Search ───────────────────────────────────────────────────────
  getPatientBasicInfo: async (_, args, { user, res }) => {
    if (!permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId)) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }
    return await Wrapper._getPatientBasicInfo(_, args, { user, res });
  },

  searchPatients: async (_, args, { user, res }) => {
    if (!permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view)) {
      logger.warn(`Unauthorized search attempt by user ID ${user.id}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    if (!args.searchTerm || args.searchTerm.trim().length < 2) return [];
    return await Wrapper._searchPatients(_, args, { user, res });
  },
  
};



module.exports = Query;