const db  = require("../../../../config/query.js");
const { notifyUser } = require("../../../../config/sockets");

const { assertActiveUpdateTicket } = require("./helper.js");
const Wrapper = require("../../wrapper/mutation.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const Query = require("./query.js");

function buildStatusNotificationCopy(status, notes) {
  const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
  const hasNotes = trimmedNotes.length > 0;

  switch (status) {
    case 'Approved':
      return {
        title: 'Record Submission Approved',
        message: hasNotes
          ? `Your submitted record has been approved. Staff notes: ${trimmedNotes}`
          : 'Your submitted record has been approved.',
      };
    case 'Revision':
      return {
        title: 'Record Revision Required',
        message: hasNotes
          ? `Your submitted record needs revision. Staff notes: ${trimmedNotes}`
          : 'Your submitted record needs revision. Please review your form and resubmit.',
      };
    case 'Rejected':
      return {
        title: 'Record Submission Rejected',
        message: hasNotes
          ? `Your submitted record was rejected. Reason: ${trimmedNotes}`
          : 'Your submitted record was rejected. Please contact the clinic for guidance.',
      };
    default:
      return {
        title: 'Record Status Updated',
        message: hasNotes
          ? `Your record status has been updated to ${status}. Notes: ${trimmedNotes}`
          : `Your record status has been updated to ${status}.`,
      };
  }
}

const Mutation = {
  staffUpdateTicket: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(
      user.id,
      permit.permissions.emr_allow_approval,
      args.userId
    );
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by user ID ${user.id} to ApproveUpdateTicket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Fetch the ticket record
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res);

    // Update the ticket
    const updateResult = await Wrapper._StaffUpdateTicket(
      _,
      { args, recordId: record.id, scope: record.scope },
      { user, res }
    );

    const newStatus = updateResult;
    const { title, message } = buildStatusNotificationCopy(newStatus, args.notes);

    // Notify patient about the update ticket status change
    try {
      const notification = await notifyUser(
        args.userId,
        "updateTicket:statusChanged",
        {
          recordId: record.id,
          newStatus,
          notes: args.notes || null,
          scope: record.scope || null,
          message,
        },
        {
          title,
          message,
          notes: args.notes || null,
        },
        { forceEmail: true }
      );

      logger.info(`Notification sent to user ${args.userId}: ${notification} (${newStatus})`);
    } catch (error) {
      logger.error(`Failed to send notification for update ticket status change: ${error.message}`);
    }

    // Return the updated ticket record
    return updateResult;
  },



  updateStudentProfile: async (_, args, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, args.userId);
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

  // Catalog mutations

  createDomainCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DomainCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._DomainCatalog(_, args, { user, res });
    return result;
  },

  createAllergenCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DomainCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._AllergenCatalogs(_, args, { user, res });
    return result;
  },

  createOralApplianceCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DomainCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._OralApplianceCatalogs(_, args, { user, res });
    return result;
  },

  updateDomainCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update DomainCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      
    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateDomainCatalogs(_, args, { user, res });
    return result;
  },

  updateAllergenCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update AllergenCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateAllergenCatalog(_, args, { user, res });
    return result;
  },

  updateOralApplianceCatalogs: async (_, args, { user, res }) => {
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.emr_allow_edit_catalogs);
    if (!permitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to update OralApplianceCatalogs`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

    const record = await Query.getUserUpdateTicket(_, args, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._UpdateOralApplianceCatalog(_, args, { user, res });
    return result;
  },

  // Link existing VitalSigns to update ticket
  linkVitalSignsToTicket: async (_, { userId, vitalSignsId }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to link VitalSigns to ticket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Get the active update ticket for the user
    const record = await Query.getUserUpdateTicket(_, { userId }, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");

    // Verify VitalSigns exists and belongs to this user
    const vsCheck = await db.query(
      `SELECT id, "userId" FROM "VitalSigns" WHERE id = $1;`,
      [vitalSignsId]
    );

    if (vsCheck.rows.length === 0) {
      throwGraphQLError(res).status(404).message("VitalSigns not found.").throw();
    }

    if (vsCheck.rows[0].userId !== parseInt(userId)) {
      throwGraphQLError(res)
        .status(403)
        .message("VitalSigns does not belong to this patient.")
        .throw();
    }

    // Check if ticket already has VitalSigns linked
    if (record.vitalSignsId) {
      throwGraphQLError(res)
        .status(403)
        .message("This update ticket already has VitalSigns linked.")
        .throw();
    }

    // Link VitalSigns to the ticket
    await db.query(
      `UPDATE "patientUpdateLog" SET "vitalSignsId" = $1 WHERE id = $2;`,
      [vitalSignsId, record.id]
    );

    logger.info(`Staff ${user.id} linked VitalSigns ${vitalSignsId} to ticket ${record.id}`);
    return true;
  },

  // Link existing DentalRecord to update ticket
  linkDentalRecordToTicket: async (_, { userId, dentalRecordId }, { user, res }) => {
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.emr_allow_edit, userId);
    if (!isPermitted) {
      logger.warn(`Unauthorized access attempt by staff ${user.id} to link DentalRecord to ticket`);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Get the active update ticket for the user
    const record = await Query.getUserUpdateTicket(_, { userId }, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");

    // Verify DentalRecord exists and belongs to this user
    const drCheck = await db.query(
      `SELECT id, "userId" FROM "DentalRecord" WHERE id = $1;`,
      [dentalRecordId]
    );

    if (drCheck.rows.length === 0) {
      throwGraphQLError(res).status(404).message("DentalRecord not found.").throw();
    }

    if (drCheck.rows[0].userId !== parseInt(userId)) {
      throwGraphQLError(res)
        .status(403)
        .message("DentalRecord does not belong to this patient.")
        .throw();
    }

    // Check if ticket already has DentalRecord linked
    if (record.dentalRecordId) {
      throwGraphQLError(res)
        .status(403)
        .message("This update ticket already has a DentalRecord linked.")
        .throw();
    }

    // Link DentalRecord to the ticket
    await db.query(
      `UPDATE "patientUpdateLog" SET "dentalRecordId" = $1 WHERE id = $2;`,
      [dentalRecordId, record.id]
    );

    logger.info(`Staff ${user.id} linked DentalRecord ${dentalRecordId} to ticket ${record.id}`);
    return true;
  },
};

module.exports =  Mutation;