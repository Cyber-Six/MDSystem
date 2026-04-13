const Wrapper = require("../../wrapper/query.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

// Medical staff can view records in any active status (Approved = current live data)
const reviewable_statuses = ["InProgress", "Pending", "RevisionSubmitted", "Revision", "Approved"];

function maskRestrictedSuperiorBasicInfo(row) {
  return {
    ...row,
    // Keep only list-safe metadata for restricted Superior records.
    sex: null,
    program: null,
    year: null,
    department: null,
    role: null,
    credentials_status: null,
    latest_ticket_id: null,
    latest_status: null,
    latest_scope: null,
    latest_updated_at: null,
    medical_status: null,
    appointment_status: null,
    medicine_status: null,
    healthchat_status: null,
    document_status: null,
    access_denied: true,
  };
}

function attachAccessState(row, canViewSuperiorDetails) {
  if (!row) return row;
  if (row.profile_type !== 'Superior') {
    return { ...row, access_denied: false };
  }

  if (canViewSuperiorDetails) {
    return { ...row, access_denied: false };
  }

  return maskRestrictedSuperiorBasicInfo(row);
}

const Query = {
  getUserUpdateTicket: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserUpdateTicket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const result = await Wrapper._getUserUpdateTicket(_, { userId: args.userId }, { user, res });
    return result; // return scalar ID
  },

  getUserProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    else if (reviewable_statuses.includes(result[0].status)) return [result[0]];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },


  getUserDentalPhotoRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalPhotoRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalPhotoRecord(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserObgynHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserObgynHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserObgynHistory(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result; 
  },

  getUserLifestyle: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserLifestyle`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserLifestyle(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserDentalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalHistory(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },
  
  getUserOralApplianceProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOralApplianceProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOralApplianceProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserEmergencyContact: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserEmergencyContact`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserEmergencyContact(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserAllergyProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserAllergyProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserAllergyProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserMedicationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicationProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserDentalProcedureProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserDentalProcedureProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserDentalProcedureProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result
  },

  getUserImmunizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserImmunizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserImmunizationProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserOperationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserOperationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserOperationProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserHospitalizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserHospitalizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserHospitalizationProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserMedicalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserMedicalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserMedicalHistory(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  getUserVisualAcuityProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserVisualAcuityProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const result = await Wrapper._getUserVisualAcuityProfile(_, {...args, statuses: reviewable_statuses}, { user, res });
    if (result.length === 0) return null;  
    return result;
  },

  // staff queries for specific records by ID (with permission checks)
  getTicketVitalSignsId: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getTicketVitalSignsId`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper._getTicketVitalSignsId(_, args, { user, res });
  },

  getTicketDentalRecordId: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_view);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getTicketDentalRecordId`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper._getTicketDentalRecordId(_, args, { user, res });
  },

  getUserTicketIds: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_view, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getUserTicketIds for user ${args.userId}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper._getUserTicketIds(_, {...args, statuses: ["Approved"]}, { user, res });
  },

  // miscellaneous queries

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

  getStatusUpdateTickets: async (_, args, { user, res }) => {
    const { permitted, branch: permBranch } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_approval);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getStatusUpdateTickets`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Clamp the requested branch to the staff member's permitted branch.
    // If staff has a specific branch (Manila/QuezonCity), they cannot escalate to 'Both'.
    const effectiveBranch = (permBranch && permBranch !== 'Both')
      ? permBranch
      : (args.branch || 'Both');

    const result = await Wrapper._getStatusUpdateTickets(_, { ...args, branch: effectiveBranch }, { user, res });
    return result;
  },

  // ─── Patient Search ───────────────────────────────────────────────────────
  getPatientBasicInfo: async (_, args, { user, res }) => {
    // Step 1: check baseline view permission/branch without Superior strictness.
    const isBasePermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_view,
      args.userId,
      false
    );

    if (!isBasePermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to getPatientBasicInfo for patient ${args.userId}`);
      throwGraphQLError(res).message('Unauthorized').status(401).throw();
    }

    const row = await Wrapper._getPatientBasicInfo(_, args, { user, res });
    if (!row) return null;

    // Step 2: if target is Superior, return masked metadata when privilege is missing.
    let canViewSuperiorDetails = true;
    if (row.profile_type === 'Superior') {
      const superiorPermit = await permit.isMedicalPermitted(
        user.id,
        permit.permissions.privileged_to_perform_on_superior
      );
      canViewSuperiorDetails = superiorPermit.permitted;
    }

    const response = attachAccessState(row, canViewSuperiorDetails);
    if (response?.access_denied) {
      const auditTs = new Date().toISOString();
      logger.warn(
        `Restricted Superior details for user ID ${user.id} on patient ${args.userId} at ${auditTs}: access_denied=true`
      );
    } else {
      // Audit-oriented snapshot of module statuses shown in the patient header.
      logger.info('Patient module statuses resolved', {
        staffId: String(user.id),
        patientId: String(args.userId),
        medical_status: response?.medical_status || null,
        appointment_status: response?.appointment_status || null,
        medicine_status: response?.medicine_status || null,
        healthchat_status: response?.healthchat_status || null,
        document_status: response?.document_status || null,
      });
    }

    return response;
  },

  searchPatients: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedLocationBased(user.id, permit.permissions.emr_allow_view, args.branch);
    if (!isPermitted) {
      logger.warn(`Unauthorized search attempt by user ID ${user.id}`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!args.searchTerm || args.searchTerm.trim().length < 2) return [];

    const rows = await Wrapper._searchPatients(_, { ...args }, { user, res });
    const { permitted: canViewSuperiorDetails } = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.privileged_to_perform_on_superior
    );

    const mappedRows = rows.map((row) => attachAccessState(row, canViewSuperiorDetails));
    const restrictedSuperiorIds = mappedRows.filter((row) => row?.access_denied).map((row) => row.id);

    if (restrictedSuperiorIds.length > 0) {
      logger.info(
        `Superior details masked in search for user ID ${user.id}; patientIds=[${restrictedSuperiorIds.join(',')}]`
      );
    }

    return mappedRows;
  },

};



module.exports = Query;