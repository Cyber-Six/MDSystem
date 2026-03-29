const Wrapper = require("../../wrapper/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// Medical staff can view records in any active status (Approved = current live data)
const reviewable_statuses = ["InProgress", "Pending", "RevisionSubmitted", "Revision", "Approved"];

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

    const result = await Wrapper._getUserProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    else if (reviewable_statuses.includes(result[0].status)) return [result[0]];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },


  getUserDentalPhotoRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalPhotoRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalPhotoRecord(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserObgynHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserObgynHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserObgynHistory(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result; 
  },

  getUserLifestyle: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserLifestyle`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserLifestyle(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserDentalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalHistory(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserDentalRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalRecord(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  

    return result;
  },

  getUserVitalSigns: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserVitalSigns`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserVitalSigns(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },
  
  getUserOralApplianceProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOralApplianceProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOralApplianceProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserEmergencyContact: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserEmergencyContact`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserEmergencyContact(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserAllergyProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserAllergyProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserAllergyProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserMedicationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicationProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserDentalProcedureProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalProcedureProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalProcedureProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result
  },

  getUserImmunizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserImmunizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserImmunizationProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserOperationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOperationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOperationProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserHospitalizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserHospitalizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserHospitalizationProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserMedicalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicalHistory(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserVisualAcuityProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserVisualAcuityProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserVisualAcuityProfile(_, {...args, statuses: ["Approved"]}, { user, res });
    if (result.length === 0) return null;  
    return result;
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
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }
    return await Wrapper._getPatientBasicInfo(_, args, { user, res });
  },

  searchPatients: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view);
    if (!isPermitted) {
      logger.warn(`Unauthorized search attempt by user ID ${user.id}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    if (!args.searchTerm || args.searchTerm.trim().length < 2) return [];
    return await Wrapper._searchPatients(_, args, { user, res });
  },
  
};



module.exports = Query;