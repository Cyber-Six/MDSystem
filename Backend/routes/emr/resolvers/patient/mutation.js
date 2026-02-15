const db  = require("../../../../config/query.js");

const { upsertEmergencyNumber } = require("../../query/upsert.js");

const { assertActiveUpdateTicket } = require("./helper.js");
const Wrapper = require("../../wrapper/mutation.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");

const { validateUpdateTicket } = require("../record-validator.js");
const Query = require("./query.js");

const Mutation = {
  createUpdateTicket: async (_, { scope }, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    if (record?.status === "InProgress" || record?.status === "Pending" || record?.status === "Revision") {
      throwGraphQLError(res).message("An update ticket is already in progress.").status(400).throw();  
      }
    if (scope !== "Both"){
      const isverified = await db.isUserValidated(user.id);
      if (!isverified){
        throwGraphQLError(res).message(
        "Creating update tickets for partial scopes is not allowed without an existing ticket.").status(400).throw();
        }
      }
    const result = await db.query(
    `INSERT INTO "patientUpdateLog" ("patientId", "status", "scope")
     VALUES ($1, 'InProgress', $2)
     RETURNING "id";
    `,
    [user.id, scope]
    );
    return result.rows[0].id;
  },

  submitUpdateTicket: async (_, {}, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    
    const missingRecords = await validateUpdateTicket(record.id, record.scope);
    if (missingRecords.length > 0) {
      throwGraphQLError(res)
        .status(400)
        .message(`Cannot submit update ticket. Required records are missing or incomplete: ${missingRecords.join(", ")}`)
        .throw();
      }

    let newStatus = "Pending";
    if (record.status !== "InProgress") newStatus = "RevisionSubmitted";
    await db.query(`UPDATE "patientUpdateLog" SET status = $1 WHERE id = $2;`,
      [newStatus, record.id]
    );
    return newStatus;
  },

  cancelUpdateTicket: async (_, {}, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    let newStatus = "Cancelled";
    await db.query(`UPDATE "patientUpdateLog" SET status = $1 WHERE id = $2;`,
      [newStatus, record.id]
    );
    return newStatus;
  },

  createStudentProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    //console.log(args.input);
    const result = await Wrapper._StudentProfile(_, {args, recordId: record.id}, { user, res });
    result.status = record.status;
    return result;
  },

  createEmployeeProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    //console.log(args.input);
    const result = await Wrapper._EmployeeProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createDentalHistory: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);
    const result = await Wrapper._DentalHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createObgynHistory: async (_, args, { user, res }) => { // test start here
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._ObgynHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createLifestyle: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._Lifestyle(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createDentalPhotoRecord: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");

    const result = await Wrapper._DentalPhotoRecord(_, {args, recordId: record.id}, { user, res });
    console.log("result", result);  
    return result;
  },

  createOralApplianceProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);
    
    const result = await Wrapper._OralApplianceProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createEmergencyContact: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Both");
    console.log(args.input);

    const result = await Wrapper._EmergencyContact(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  createVisualAcuityProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");

    const result = await Wrapper._VisualAcuityProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createMedicalHistory: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._MedicalHistory(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createHospitalizationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._HospitalizationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createOperationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._OperationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createImmunizationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._ImmunizationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createDentalProcedureProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");
    console.log(args.input);

    const result = await Wrapper._DentalProcedureProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createAllergyProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);
    
    const result = await Wrapper._AllergyProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },


  createMedicationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");
    console.log(args.input);

    const result = await Wrapper._MedicationProfile(_, {args, recordId: record.id}, { user, res });
    return result;
  },

  createDomainCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");

    const result = await Wrapper._DomainCatalog(_, args, { user, res });
    return result;
  },

  createAllergenCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Medical");

    const result = await Wrapper._AllergenCatalogs(_, args, { user, res });
    return result;
  },

  createOralApplianceCatalogs: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res, allowedScope="Dental");

    const result = await Wrapper._OralApplianceCatalogs(_, args, { user, res });
    return result;
  },

};

module.exports =  Mutation;