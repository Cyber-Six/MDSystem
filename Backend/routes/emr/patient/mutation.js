const db  = require("../../../config/query.js");

const { upsertEmergencyNumber } = require("../query/upsert.js");

const anchor = require("../query/anchor.js");
const remove = require("../query/delete.js");
const { assertActiveUpdateTicket } = require("./helper.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");

const Query = require("./query.js");

const Mutation = {
  createUpdateTicket: async (_, { scope }, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    if (record.status === "In-progress" || record.status === "Pending") {
      throwGraphQLError(res).message("An update ticket is already in progress.").status(400).throw();  
      }
    if (scope !== "Both"){
      const isverified = await db.isPatientValidated(user.id);
      if (!isverified){
        throwGraphQLError(res).message(
        "Creating update tickets for partial scopes is not allowed without an existing ticket.").status(400).throw();
        }
      }
    const result = await db.query(
    `INSERT INTO "patientUpdateLog" ("patientId", "status", "scope")
     VALUES ($1, 'In-progress', $2)
     RETURNING "id";
    `,
    [user.id, scope]
    );
    return result.rows[0].id;
  },

  createStudentProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    //console.log(args.input);

    let identity = await db.getUserIdentity(user.id);
    if (identity !== "Student") {
      throwGraphQLError(res)
        .status(400)
        .message("User identity mismatch. Only students can create student profiles.")
        .throw();
      }
    
    await db.query(
      `INSERT INTO "profileRecord" (id, profile_type) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET profile_type = EXCLUDED.profile_type;`,
      [record.id, identity]
    );

    const result = await db.query(
      `INSERT INTO "student_profile" 
        (id, program, year, guardian_name, guardian_relation, guardian_contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET program = EXCLUDED.program,
             year = EXCLUDED.year,
             guardian_name = EXCLUDED.guardian_name,
             guardian_relation = EXCLUDED.guardian_relation,
             guardian_contact = EXCLUDED.guardian_contact
             RETURNING *;`,
      [
        record.id,
        args.input.program,
        args.input.year,
        args.input.guardian_name,
        args.input.guardian_relation,
        args.input.guardian_contact
      ]
    );

    //return result.rows[0];
    return {...(args.input), id: record.id, archived_at: null};
  },

  createEmployeeProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    //console.log(args.input);

    let identity = await db.getUserIdentity(user.id);
    if (identity !== "Employee") {
      throwGraphQLError(res)
        .status(400)
        .message("User identity mismatch. Only employees can create employee profiles.")
        .throw();
      }
    
    await db.query(
      `INSERT INTO "profileRecord" (id, profile_type) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET profile_type = EXCLUDED.profile_type;`,
      [record.id, identity]
    );

    const result = await db.query(
      `INSERT INTO "employee_profile" 
        (id, department, role, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET department = EXCLUDED.department,
             role = EXCLUDED.role,
             position = EXCLUDED.position
             RETURNING *;`,
      [
        record.id,
        args.input.department,
        args.input.role,
        args.input.position
      ]
    );

    //return result.rows[0];
    return {...(args.input), id: record.id, archived_at: null};
  },

  createDentalHistory: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    const result = await db.query(
      `INSERT INTO "DentalHistory" 
        ("id","seenByDentist", "lastDentalCleaning", "purpose", "lastVisitDate")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET "seenByDentist" = EXCLUDED."seenByDentist",
             "lastDentalCleaning" = EXCLUDED."lastDentalCleaning",
             "purpose" = EXCLUDED."purpose",
             "lastVisitDate" = EXCLUDED."lastVisitDate"
             RETURNING *;`,
      [
        record.id,
        args.input.seenByDentist,
        args.input.lastDentalCleaning,
        args.input.purpose,
        args.input.lastVisitDate
      ]
    );  

    return {...(args.input), id: record.id, archived_at: null};
  },

  createObgynHistory: async (_, args, { user, res }) => { // test start here
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    const result = await db.query(
      `INSERT INTO "ObGynHistory" 
        ("id", "lastMenstrualPeriod", "hasDysmenorrhea", "notes")
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (id) DO UPDATE
          SET "lastMenstrualPeriod" = EXCLUDED."lastMenstrualPeriod",
              "hasDysmenorrhea" = EXCLUDED."hasDysmenorrhea",
              "notes" = EXCLUDED."notes"
              RETURNING *;`,
        [
          record.id,
          args.input.lastMenstrualPeriod,
          args.input.hasDysmenorrhea,
          args.input.notes
        ]
      );

    return {...(args.input), id: record.id, archived_at: null};
  },

  createLifestyle: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    const result = await db.query(
      `INSERT INTO "Lifestyle" 
        ("id", "smoker", "numberOfCigarettesPerDay", "yearsSmoked", 
        "alcoholConsumer", "frequencyOfAlcoholConsumption", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET "smoker" = EXCLUDED."smoker",
             "numberOfCigarettesPerDay" = EXCLUDED."numberOfCigarettesPerDay",
             "yearsSmoked" = EXCLUDED."yearsSmoked",
             "alcoholConsumer" = EXCLUDED."alcoholConsumer",
             "frequencyOfAlcoholConsumption" = EXCLUDED."frequencyOfAlcoholConsumption",
             "notes" = EXCLUDED."notes"
             RETURNING *;`,
      [
        record.id,
        args.input.smoker,
        args.input.numberOfCigarettesPerDay,
        args.input.yearsSmoked,
        args.input.alcoholConsumer,
        args.input.frequencyOfAlcoholConsumption,
        args.input.notes
      ]
    );

    return {...(args.input), id: record.id, archived_at: null};
  },

  createDentalPhotos: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    const result = await db.query(
      `INSERT INTO "DentalPhotos" 
        ("id", "upperTeeth", "lowerTeeth")
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET "upperTeeth" = EXCLUDED."upperTeeth",
             "lowerTeeth" = EXCLUDED."lowerTeeth"
             RETURNING *;`,
      [
        record.id,
        args.input.upperTeeth,
        args.input.lowerTeeth
      ]
    );

    return {...(args.input), id: record.id, archived_at: null};
  },

  createOralApplianceProfile: async (_, args, { user, res }) => {
    // Step 1: Validate update ticket

    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    // Step 2: Ensure OralAppliance exists
    await db.query(
      `INSERT INTO "OralAppliance" ("id")
       VALUES ($1)
       ON CONFLICT (id) DO NOTHING
       RETURNING *;`,
      [record.id]
    );

    // Step 3: Extract legends
    const legends = args.input.appliances.map(a => a.legend);
    console.log("Legends:", legends);
    // Step 4: Detect duplicates
    const duplicates = legends.filter((l, i) => legends.indexOf(l) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate legend(s) not allowed: ${duplicates.join(', ')}`);
    }
    // Step 5: Lookup appliance IDs
    const query = `
      SELECT id, name
      FROM "oralApplianceCatalog"
      WHERE name = ANY($1::text[])
    `;
    const result = await db.query(query, [legends]);

    // Step 6: Validate all legends exist
    const foundNames = new Set(result.rows.map(r => r.name));
    const missing = legends.filter(l => !foundNames.has(l));
    if (missing.length > 0) {
      throw new Error(`Invalid legend(s): ${missing.join(', ')}`);
    }

    // Step 7: Insert into OralApplianceRecord
    for (const appliance of args.input.appliances) {
      const match = result.rows.find(r => r.name === appliance.legend);
      await db.query(
        `INSERT INTO "OralApplianceRecord"
          ("applianceId", "status", "dateIssued", "tagId", "arch")
         VALUES ($1, $2, $3, $4, $5);`,
        [
          record.id,              // applianceId from catalog
          appliance.status,      // status
          appliance.dateIssued,  // dateIssued
          appliance.tagId || null, // optional FK
          appliance.arch         // arch designation
        ]
      );
    }
    console.log(args.input);
    // Step 8: Return normalized profile
    return {
      ...args.input,
      id: record.id,
      archived_at: null
    };
  },

  createEmergencyContact: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    // Upsert both contacts
    //console.log(args.input.firstContact);
    //console.log(args.input.secondContact);
    const firstNumber = await upsertEmergencyNumber(args.input.firstContact);
    const secondNumber = await upsertEmergencyNumber(args.input.secondContact);

    console.log("First Number ID:", firstNumber.id);
    console.log("Second Number ID:", secondNumber.id);
    // Link them
    const contactResult = await db.query(
      `INSERT INTO "EmergencyContact"
        ("id", "firstNumber", "secondNumber")
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET "firstNumber" = EXCLUDED."firstNumber",
             "secondNumber" = EXCLUDED."secondNumber"
       RETURNING *;`,
      [record.id, firstNumber.id, secondNumber.id]
    );

    console.log("Emergency Contact Result:", contactResult.rows[0].id);
    console.log("First Contact ID:", firstNumber);
    console.log("Second Contact ID:", secondNumber);
    return {
      id: contactResult.rows[0].id,
      firstContact: firstNumber,
      secondContact: secondNumber,
      archived_at: null
    };
  },


  createVisualAcuityProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input.visualAcuity);

    await anchor.VisualAcuity(record.id);
    await remove.VisualAcuityRecord(record.id);

    if (!args.input.visualAcuity) {
       return {
         id: record.id,
         visualAcuity: null,
         archived_at: null
       };
      }
    
    try {
      const result = await db.queryControlled(
        `INSERT INTO "VisualAcuityRecord" 
          ("id", "acuityId", "recorded_at", "left_eye", "right_eye", "notes")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET "acuityId" = EXCLUDED."acuityId",
               "recorded_at" = EXCLUDED."recorded_at",
               "left_eye" = EXCLUDED."left_eye",
               "right_eye" = EXCLUDED."right_eye",
               "notes" = EXCLUDED."notes"
               RETURNING *;`,
        [
          record.id,
          args.input.visualAcuity.acuityId,
          args.input.visualAcuity.recorded_at,
          args.input.visualAcuity.left_eye,
          args.input.visualAcuity.right_eye,
          args.input.visualAcuity.notes
        ]
      );
    } catch (err) {
      if (err.code === '23503') { // foreign key violation
        throwGraphQLError(res)
          .status(400)
          .message(`Invalid acuityId: ${args.input.visualAcuity.acuityId}`)
          .throw();
        }
      else { throw err; }
    }

    return {...(args.input), id: record.id, archived_at: null};
  },

  createMedicalHistory: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    await anchor.MedicalHistory(record.id);
    await remove.MedicalCondition(record.id);

    if (args.input.conditions.length === 0) {
      return {
        id: record.id,
        conditions: [],
        archived_at: null
        };
      }

    const inserted = [];
    for (const condition of args.input.conditions) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "MedicalCondition"
            ("medicalHistoryId", "conditionId", "relationship", "description", "diagnosedDate")
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *;`,
          [
            record.id,
            condition.conditionId,
            condition.relationship || null,
            condition.description || null,
            condition.diagnosedDate || null
            ]
          );
        console.log("Inserted Medical Condition:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: record.id,
      conditions: inserted,
      archived_at: null
    };
  },

  createHospitalizationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    await anchor.Hospitalization(record.id, args.input.notes);

    if (args.input.hospitalizations.length === 0) {
      await remove.HospitalizationRecord(record.id);
      return {
        id: record.id,
        hospitalizations: [],
        archived_at: null
        };
      }

    const inserted = [];
    for (const hospitalization of args.input.hospitalizations) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "HospitalizationRecord"
            ("hospitalizationId", "hospitalName", "reason", "admissionDate", "dischargeDate", "notes")
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *;`,
          [
            record.id,
            hospitalization.hospitalName,
            hospitalization.reason,
            hospitalization.admissionDate,
            hospitalization.dischargeDate || null,
            hospitalization.notes || null
            ]
          );
        console.log("Inserted Hospitalization:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: record.id,
      hospitalizations: inserted,
      archived_at: null
    };
  },

  createOperationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);
    console.log(args.input);

    await anchor.Operation(record.id);
    await remove.OperationRecord(record.id);

    if (args.input.operations.length === 0) {
      return {
        id: record.id,
        operations: [],
        archived_at: null
        };
      }
    const inserted = [];
    for (const operation of args.input.operations) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "OperationRecord"
            ("operationId", "procedureId", "operationDate", "notes")
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [
            record.id,
            operation.procedureId,
            operation.operationDate,
            operation.notes || null
            ]
          );
        console.log("Inserted Operation:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: record.id,
      operations: inserted,
      archived_at: null
    };
  },

  createImmunizationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    await anchor.Immunization(record.id);
    await remove.ImmunizationRecord(record.id);

    if (args.input.immunizations.length === 0) {
      return {
        id: record.id,
        immunizations: [],
        archived_at: null
        };
      }

    const inserted = [];
    for (const immunization of args.input.immunizations) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "ImmunizationRecord"
            ("immunizationId", "vaccineTypeId", "immunizationDate", "doseNumber")
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [
            record.id,
            immunization.vaccineTypeId,
            immunization.immunizationDate,
            immunization.doseNumber
            ]
          );
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: record.id,
      immunizations: inserted,
      archived_at: null
    };
  },

  createDentalProcedureProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    await anchor.DentalProcedure(record.id);
    await remove.DentalProcedureRecord(record.id);

    if (args.input.procedures.length === 0) {
      return {
        id: record.id,
        procedures: [],
        archived_at: null
        };
      }

    const inserted = [];
    for (const procedure of args.input.procedures) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "DentalProcedureRecord"
            ("dentalProcedureId", "procedureTypeId", "procedureDate")
           VALUES ($1, $2, $3)
           RETURNING *;`,
          [
            record.id,
            procedure.procedureTypeId,
            procedure.procedureDate
            ]
          );
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: record.id,
      procedures: inserted,
      archived_at: null
    };
  },

  createAllergyProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    await anchor.Allergy(record.id);

    if (args.input.allergies.length === 0) {
      await remove.AllergyRecord(record.id);
      return {
        id: record.id,
        allergies: [],
        archived_at: null
        };
      }
    const inserted = [];
    for (const allergy of args.input.allergies) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "AllergyRecord"
            ("allergyId", "allergenCatalogId", "status", "severity", "notes", "date_identified")
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *;`,
          [
            record.id,
            allergy.allergenId,
            allergy.status,
            allergy.severity,
            allergy.notes || null,
            allergy.date_identified || null
            ]
          );
        console.log("Inserted Allergy:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        if (err.code === '23503') { // foreign key violation
          throwGraphQLError(res)
            .status(400)
            .message(`Invalid allergenId: ${allergy.allergenId}`)
            .throw();
        }
        else { throw err; }
      }
    }
    return {
      id: record.id,
      allergies: inserted,
      archived_at: null
    };
  },


  createMedicationProfile: async (_, args, { user, res }) => {
    const record = await Query.getUpdateTicket(_, {}, { user, res });
    assertActiveUpdateTicket(record, res);

    await anchor.MaintenanceMedication(record.id);

    if (args.input.medications.length === 0) {
      await remove.MedicationRecord(record.id);
      return {
        id: record.id,
        medications: [],
        archived_at: null
        };
      }
    const inserted = [];

    for (const medication of args.input.medications) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "MedicationRecord"
            ("medicationId", "medicineId", "description")
           VALUES ($1, $2, $3)
           RETURNING *;`,
          [
            record.id,
            medication.medicineId,
            medication.description || null
            ]
          );
        inserted.push(result.rows[0]);
      } catch (err) {
        if (err.code === '23503') { // foreign key violation
          throwGraphQLError(res)
            .status(400)
            .message(`Invalid medicineId: ${medication.medicineId}`)
            .throw();
        }
        else { throw err; }
      }
    }
    return {
      id: record.id,
      medications: inserted,
      archived_at: null
    };
  },



};

module.exports =  Mutation;