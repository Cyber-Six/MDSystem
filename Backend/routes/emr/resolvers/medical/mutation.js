const db  = require("../../../../config/query.js");
const { findEmailByUserId } = require("../../../../config/query.js");
const { isConnectedAnywhere, emitToUserWithAck } = require("../../../../config/sockets");
const { enqueueNotificationEmail } = require("../../../../services/emailservice.js");

const { assertActiveUpdateTicket } = require("./helper.js");
const Wrapper = require("../../wrapper/mutation.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const Query = require("./query.js");

const Mutation = {
  staffUpdateTicket: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_approval, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to ApproveUpdateTicket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res);
    
    const result = await Wrapper._StaffUpdateTicket(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  updateStudentProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update StudentProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    //console.log(args.input);
    const result = await Wrapper._StudentProfile(_, {args, recordId: record.id}, { user, res });

    return result;
  },

  updateEmployeeProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update EmployeeProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    //console.log(args.input);
    const result = await Wrapper._EmployeeProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateDentalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DentalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);
    const result = await Wrapper._DentalHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateObgynHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update ObgynHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._ObgynHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateLifestyle: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update Lifestyle`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._Lifestyle(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateDentalPhotoRecord: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DentalPhotoRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);

    const result = await Wrapper._DentalPhotoRecord(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateOralApplianceProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update OralApplianceProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);
    
    const result = await Wrapper._OralApplianceProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateEmergencyContact: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update EmergencyContact`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._EmergencyContact(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  updateVisualAcuityProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update VisualAcuityProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._VisualAcuityProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateMedicalHistory: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update MedicalHistory`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._MedicalHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateHospitalizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update HospitalizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._HospitalizationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateOperationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update OperationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._OperationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateImmunizationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update ImmunizationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._ImmunizationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateDentalProcedureProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DentalProcedureProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);

    const result = await Wrapper._DentalProcedureProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateAllergyProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update AllergyProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._AllergyProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  updateMedicationProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update MedicationProfile`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._MedicationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  updateDentalRecord: async (_, args, { user, res }) => { // only available for medical scope
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_set_dental_record, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to create DentalRecord`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);

    const result = await Wrapper._DentalRecord(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  updateVitalSigns: async (_, args, { user, res }) => { // only available for medical scope
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update VitalSigns`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._VitalSigns(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  // Catalog mutations
  
  createDomainCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._DomainCatalog(_, args, { user, res });
    return result;
  },

  createAllergenCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._AllergenCatalogs(_, args, { user, res });
    return result;
  },

  createOralApplianceCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._OralApplianceCatalogs(_, args, { user, res });
    return result;
  },

  updateDomainCatalogs: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DomainCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateDomainCatalogs(_, args, { user, res });
    return result;
  },

  updateAllergenCatalogs: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update AllergenCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateAllergenCatalog(_, args, { user, res });
    return result;
  },

  updateOralApplianceCatalogs: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs, args.userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update OralApplianceCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateOralApplianceCatalog(_, args, { user, res });
    return result;
  },
};

module.exports =  Mutation;