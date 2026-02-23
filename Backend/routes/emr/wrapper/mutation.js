const db  = require("../../../config/query.js");
const { promoteFile, deleteFile } = require("../../../config/multer.js");
const { upsertEmergencyNumber } = require("../query/upsert.js");

const anchor = require("../query/anchor.js");
const remove = require("../query/delete.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const { generateDomainCodes } = require("../../../utils/validator.js");

const Mutation = {
  _StudentProfile: async (_, {args, recordId}, { user, res }) => {
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
      [recordId, identity]
    );

    const result = await db.query(
      `INSERT INTO "student_profile" 
        (id, program, year)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET program = EXCLUDED.program,
             year = EXCLUDED.year
             RETURNING *;`,
      [
        recordId,
        args.input.program,
        args.input.year
      ]
    );
    logger.debug("Upserted Student Profile:", result.rows[0]);
    //return result.rows[0];
    return {...(args.input), id: recordId, archived_at: null};
  },

  _EmployeeProfile: async (_, {args, recordId}, { user, res }) => {
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
      [recordId, identity]
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
        recordId,
        args.input.department,
        args.input.role,
        args.input.position
      ]
    );

    logger.debug("Upserted Employee Profile:", result.rows[0]);
    //return result.rows[0];
    return {...(args.input), id: recordId, archived_at: null};
  },

  _VitalSigns: async (_, {args, recordId}, { user, res }) => {
    const result = await db.query(
      `INSERT INTO "VitalSigns" 
        ("id", "height_cm", "weight_kg", "blood_pressure", "heart_rate", 
        "temperature", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET "height_cm" = EXCLUDED."height_cm",
             "weight_kg" = EXCLUDED."weight_kg",
             "blood_pressure" = EXCLUDED."blood_pressure",
             "heart_rate" = EXCLUDED."heart_rate",
             "temperature" = EXCLUDED."temperature",
             "notes" = EXCLUDED."notes"
             RETURNING *;`,
      [
        recordId,
        args.input.height_cm,
        args.input.weight_kg,
        args.input.blood_pressure,
        args.input.heart_rate,
        args.input.temperature,
        args.input.notes
      ]
    );

    logger.debug("Upserted Vital Signs:", result.rows[0]);
    return {...(args.input), id: recordId, archived_at: null};
  },

  _DentalRecord: async (_, { args, recordId }, { user, res }) => {

    await anchor.DentalRecord(recordId, args.input.notes);
    let result;
    try {
      const values = [];
      const params = [];
      args.input.toothPlacements.forEach((tooth, i) => {
        const baseIndex = i * 3;
        values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
        params.push(recordId, tooth.tooth_index, tooth.legend);
      });

      const query = `
        INSERT INTO "ToothPlacement" ("dentalRecordId", "toothIndex", "legend")
        VALUES ${values.join(", ")}
        RETURNING *;
      `;
      result = await db.queryControlled(query, params);

      logger.debug("Inserted Tooth Placements:", result.rows);
    } catch (err) {
      logger.error("Error inserting Tooth Placements:", err);
      throwGraphQLError(res)
        .status(400)
        .message(`Failed to insert DentalRecord: ${err.message}`)
        .throw();
      }
    // Oral Finding

    let insert = [];
    for (const finding of args.input.oralFindings) {
      try {
        const resultFinder = await db.queryControlled(
          `INSERT INTO "OralFindingRecord"
            ("dentalRecordId", "oralFindingId", "status", "notes")
           VALUES ($1, $2, $3, $4)
           RETURNING *;`,
          [
            recordId,
            finding.oralFindingId,
            finding.status,
            finding.notes || null
            ]
          );
        insert.push(resultFinder.rows[0]);
        } catch (err) {
          if (err.code === '23503') { // foreign key violation
            throwGraphQLError(res)
              .status(400)
              .message(`Invalid oralFindingId: ${finding.oralFindingId}`)
              .throw();
            }
          else throw err;
        }
      }
    logger.debug("Inserted Oral Findings:", insert);
    return {
      ...args.input,
      id: recordId,
      archived_at: null,
      toothPlacements: result.rows,
      oralFindings: insert
    };

  },


  _DentalHistory: async (_, {args, recordId}, { user, res }) => {
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
        recordId,
        args.input.seenByDentist,
        args.input.lastDentalCleaning,
        args.input.purpose,
        args.input.lastVisitDate
      ]
    );  

    logger.debug("Upserted Dental History:", result.rows[0]);
    return {...(args.input), id: recordId, archived_at: null};
  },

  _ObgynHistory: async (_, {args, recordId}, { user, res }) => {
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
          recordId,
          args.input.lastMenstrualPeriod,
          args.input.hasDysmenorrhea,
          args.input.notes
        ]
      );
    logger.debug("Upserted ObGynHistory:", result.rows[0]);
    return {...(args.input), id: recordId, archived_at: null};
  },

  _Lifestyle: async (_, {args, recordId}, { user, res }) => {
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
        recordId,
        args.input.smoker,
        args.input.numberOfCigarettesPerDay,
        args.input.yearsSmoked,
        args.input.alcoholConsumer,
        args.input.frequencyOfAlcoholConsumption,
        args.input.notes
      ]
    );
    logger.debug("Upserted Lifestyle:", result.rows[0]);

    return {...(args.input), id: recordId, archived_at: null};
  },

  _DentalPhotoRecord: async (_, {args, recordId}, { user, res }) => {
    const upperUUID = (args.input.upperTeeth) ? await promoteFile(user.id, args.input.upperTeeth, "dentalPhoto") : null;
    const lowerUUID = (args.input.lowerTeeth) ? await promoteFile(user.id, args.input.lowerTeeth, "dentalPhoto") : null;

    // check existing
    const existing = await db.query(
      `SELECT "id", "upperTeeth", "lowerTeeth" FROM "DentalPhotoRecord" WHERE "id" = $1;`,
      [recordId]
      );

    if (existing.rows.length > 0) {
      if (upperUUID && existing.rows[0].upperTeeth) await deleteFile("dentalPhoto", existing.rows[0].upperTeeth);
      if (lowerUUID && existing.rows[0].lowerTeeth) await deleteFile("dentalPhoto", existing.rows[0].lowerTeeth);
    }

    // insert
    const result = await db.query(
      `INSERT INTO "DentalPhotoRecord" ("id", "upperTeeth", "lowerTeeth")
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE
          SET "upperTeeth" = COALESCE(EXCLUDED."upperTeeth", "DentalPhotoRecord"."upperTeeth"),
              "lowerTeeth" = COALESCE(EXCLUDED."lowerTeeth", "DentalPhotoRecord"."lowerTeeth")
        RETURNING *;
`,
      [
        recordId,
        upperUUID,
        lowerUUID
        ]
      );
    const record = result.rows[0];
    return {...record, id: recordId, isValid: result.rows[0].isValid, archived_at: null};
  },

  
  _OralApplianceProfile: async (_, {args, recordId}, { user, res }) => {
    await anchor.OralAppliance(recordId);
    await remove.OralApplianceRecord(recordId);

    if (args.input.appliances.length === 0) {
      await remove.OralApplianceRecord(recordId);
      return {
        id: recordId,
        appliances: [],
        archived_at: null
        };
      }
    const inserted = [];
    for (const appliance of args.input.appliances) {
      try {
        const result = await db.queryControlled(
          `INSERT INTO "OralApplianceRecord"
            ("applianceId", "tagId", "status", "dateIssued", "arch")
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *;`,
          [
            recordId,
            appliance.tagId,
            appliance.status,
            appliance.dateIssued,
            appliance.arch
            ]
          );
        logger.debug("Inserted Oral Appliance:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        if (err.code === '23503') { // foreign key violation
          throwGraphQLError(res)
            .status(400)
            .message(`Invalid tagId: ${appliance.tagId}`)
            .throw();
          }
        else throw err;
      }
    }
    logger.warn("Inserted Oral Appliances:", inserted);
    return {
      id: recordId,
      appliances: inserted,
      archived_at: null
    };
  },

  _EmergencyContact: async (_, {args, recordId}, { user, res }) => {
    const firstNumber = await upsertEmergencyNumber(args.input.firstContact);
    const secondNumber = await upsertEmergencyNumber(args.input.secondContact);

    // Link them
    const result = await db.query(
      `INSERT INTO "EmergencyContact"
        ("id", "firstNumber", "secondNumber")
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET "firstNumber" = EXCLUDED."firstNumber",
             "secondNumber" = EXCLUDED."secondNumber"
       RETURNING *;`,
      [recordId, firstNumber.id, secondNumber.id]
    );
    logger.debug("Upserted Emergency Contact:", result.rows[0]);

    return {
      id: recordId,
      firstContact: firstNumber,
      secondContact: secondNumber,
      archived_at: null
    };
  },

  _VisualAcuityProfile: async (_, { args, recordId }, { user, res }) => {
    // Anchor and cleanup existing records
    await anchor.VisualAcuity(recordId);
    await remove.VisualAcuityRecord(recordId);

    // If no acuity input provided, return with acuity = null
    if (!args.input.acuity) {
      return {
        id: recordId,
        acuity: null,
        archived_at: null
      };
    }

    try {
      // Upsert the visual acuity record
      const result = await db.queryControlled(
        `INSERT INTO "VisualAcuityRecord" 
          ("id", "acuityId", "recorded_at", "left_eye", "right_eye", "notes")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET "acuityId"   = EXCLUDED."acuityId",
               "recorded_at"= EXCLUDED."recorded_at",
               "left_eye"   = EXCLUDED."left_eye",
               "right_eye"  = EXCLUDED."right_eye",
               "notes"      = EXCLUDED."notes"
         RETURNING *;`,
        [
          recordId,
          args.input.acuity.acuityId,
          args.input.acuity.recorded_at,
          args.input.acuity.left_eye,
          args.input.acuity.right_eye,
          args.input.acuity.notes
        ]
      );

      const acuityRecord = result.rows[0];
      logger.debug("Upserted Visual Acuity Profile:", acuityRecord);

      // Return the proper shape expected by GraphQL
      return {
        id: recordId,
        archived_at: null,
        acuity: acuityRecord
      };
    } catch (err) {
      if (err.code === '23503') { // foreign key violation
        throwGraphQLError(res)
          .status(400)
          .message(`Invalid acuityId: ${args.input.acuity.acuityId}`)
          .throw();
      } else {
        throw err;
      }
    }
  },


  _MedicalHistory: async (_, {args, recordId}, { user, res }) => {
    await anchor.MedicalHistory(recordId);
    await remove.MedicalCondition(recordId);

    if (args.input.conditions.length === 0) {
      return {
        id: recordId,
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
            recordId,
            condition.conditionId,
            condition.relationship || null,
            condition.description || null,
            condition.diagnosedDate || null
            ]
          );
        logger.debug("Inserted Medical Condition:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    logger.debug("Inserted Medical Conditions:", inserted);
    return {
      id: recordId,
      conditions: inserted,
      archived_at: null
    };
  },

  _HospitalizationProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.Hospitalization(recordId, args.input.notes);
    await remove.HospitalizationRecord(recordId);

    if (args.input.hospitalizations.length === 0) {
      return {
        id: recordId,
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
            recordId,
            hospitalization.hospitalName,
            hospitalization.reason,
            hospitalization.admissionDate,
            hospitalization.dischargeDate || null,
            hospitalization.notes || null
            ]
          );
        logger.debug("Inserted Hospitalization:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    logger.debug("Inserted Hospitalizations:", inserted);
    return {
      id: recordId,
      hospitalizations: inserted,
      archived_at: null
    };
  },

  _OperationProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.Operation(recordId);
    await remove.OperationRecord(recordId);

    if (args.input.operations.length === 0) {
      return {
        id: recordId,
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
            recordId,
            operation.procedureId,
            operation.operationDate,
            operation.notes || null
            ]
          );
        logger.debug("Inserted Operation:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: recordId,
      operations: inserted,
      archived_at: null
    };
  },

  _ImmunizationProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.Immunization(recordId);
    await remove.ImmunizationRecord(recordId);

    if (args.input.immunizations.length === 0) {
      return {
        id: recordId,
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
            recordId,
            immunization.vaccineTypeId,
            immunization.immunizationDate,
            immunization.doseNumber
            ]
          );
        logger.debug("Inserted Immunization:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        throw err;
      }
    }
    return {
      id: recordId,
      immunizations: inserted,
      archived_at: null
    };
  },

  _DentalProcedureProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.DentalProcedure(recordId);
    await remove.DentalProcedureRecord(recordId);

    if (args.input.procedures.length === 0) {
      return {
        id: recordId,
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
            recordId,
            procedure.procedureTypeId,
            procedure.procedureDate
            ]
          );
        logger.debug("Inserted Dental Procedure:", result.rows[0]);
        inserted.push(result.rows[0]);
      } catch (err) {
        if (err.code === '23503') { // foreign key violation
          throwGraphQLError(res)
            .status(400)
            .message(`Invalid procedureTypeId: ${procedure.procedureTypeId}`)
            .throw();
            }
        else throw err;
      }
    }
    return {
      id: recordId,
      procedures: inserted,
      archived_at: null
    };
  },

  _AllergyProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.Allergy(recordId);
    await remove.AllergyRecord(recordId);

    if (args.input.allergies.length === 0) {
      return {
        id: recordId,
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
            recordId,
            allergy.allergenId,
            allergy.status,
            allergy.severity,
            allergy.notes || null,
            allergy.date_identified || null
            ]
          );
        logger.debug("Inserted Allergy:", result.rows[0]);
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
      id: recordId,
      allergies: inserted,
      archived_at: null
    };
  },

  _MedicationProfile: async (_, {args, recordId}, { user, res }) => {
    console.log(args.input);

    await anchor.MaintenanceMedication(recordId);
    await remove.MedicationRecord(recordId);

    if (args.input.medications.length === 0) {
      return {
        id: recordId,
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
            recordId,
            medication.medicineId,
            medication.description || null
            ]
          );
        logger.debug("Inserted Medication:", result.rows[0]);
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
      id: recordId,
      medications: inserted,
      archived_at: null
    };
  },

  _DomainCatalog: async (_, { domain, names }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    const query = `
      INSERT INTO "DomainTypeCatalog" (domain, name, created_by, code)
      SELECT $1, UNNEST($2::text[]), $3, UNNEST($4::text[])
      ON CONFLICT (domain, name) DO NOTHING
      RETURNING *;
    `;

    const result = await db.query(query, [domain, names || [], user.id, generateDomainCodes(names, domain)]);
    logger.debug("Inserted DomainTypeCatalogs:", result.rows);
    return result.rows;
  },

  _AllergenCatalogs: async (_, { allergens }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    if (!allergens || allergens.length === 0) {
      throwGraphQLError(res).status(400).message("No allergens provided").throw();
    }

    // Build VALUES placeholders dynamically
    const values = allergens
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(", ");

    // Flatten params [allergen, type, allergen, type, ...]
    const params = allergens.flatMap(a => [a.allergen, a.type, user.id]);
    const query = `
      INSERT INTO "AllergenCatalog" (allergen, type, created_by)
      VALUES ${values}
      ON CONFLICT (allergen, type) DO NOTHING
      RETURNING *;
    `;

    const result = await db.queryControlled(query, params);
    logger.debug("Inserted AllergenCatalogs:", result.rows);
    return result.rows;
  },

  _OralApplianceCatalogs: async (_, { appliances }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    if (!appliances || appliances.length === 0) {
      throwGraphQLError(res).status(400).message("No oral appliances provided").throw();
    }

    // Build VALUES placeholders dynamically
    const values = appliances
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(", ");

    // Flatten params [name, archable, description, created_by, ...]
    const params = appliances.flatMap(a => [a.name, a.archable, a.description, user.id]);

    const query = `
      INSERT INTO "OralApplianceCatalog" (name, archable, description, created_by)
      VALUES ${values}
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
    `;

    const result = await db.queryControlled(query, params);
    logger.debug("Inserted OralApplianceCatalogs:", result.rows);
    return result.rows;
  },

  _UpdateDomainCatalogs: async (_, { catalogs }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    if (!catalogs || catalogs.length === 0) {
      throwGraphQLError(res).status(400).message("No catalogs provided").throw();
    }

    // Build VALUES placeholders dynamically
    const values = catalogs
      .map((_, i) =>
        `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
      )
      .join(", ");

    // Flatten params: [id, domain, name, code, description, isValid, ...]
    const params = catalogs.flatMap(c => [
      c.id,
      c.domain ?? null,
      c.name ?? null,
      c.code ?? null,
      c.description ?? null,
      c.isValid ?? null
    ]);

    const query = `
      UPDATE "DomainTypeCatalog" AS d
      SET domain      = COALESCE(v.domain, d.domain),
          name        = COALESCE(v.name, d.name),
          code        = COALESCE(v.code, d.code),
          description = COALESCE(v.description, d.description),
          isValid     = COALESCE(v.isValid, d.isValid)
      FROM (VALUES ${values}) AS v(id, domain, name, code, description, isValid)
      WHERE d.id = v.id
      RETURNING d.*;
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      throwGraphQLError(res)
        .status(404)
        .message(`No matching domain catalogs found.`)
        .throw();
    }
    logger.debug("Updated DomainTypeCatalogs:", result.rows);

    return result.rows;
  }, // update catalog

  _UpdateAllergenCatalog: async (_, { allergens }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    if (!allergens || allergens.length === 0) {
      throwGraphQLError(res).status(400).message("No allergens provided").throw();
    }

    // Build VALUES placeholders dynamically
    const values = allergens
      .map((_, i) =>
        `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      )
      .join(", ");

    // Flatten params: [id, allergen, type, isValid, ...]
    const params = allergens.flatMap(a => [
      a.id,
      a.allergen ?? null,
      a.type ?? null,
      a.isValid ?? null
    ]);

    const query = `
      UPDATE "AllergenCatalog" AS ac
      SET allergen = COALESCE(v.allergen, ac.allergen),
          type     = COALESCE(v.type, ac.type),
          isValid  = COALESCE(v.isValid, ac.isValid)
      FROM (VALUES ${values}) AS v(id, allergen, type, isValid)
      WHERE ac.id = v.id
      RETURNING ac.*;
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      throwGraphQLError(res)
        .status(404)
        .message(`No matching allergen catalogs found.`)
        .throw();
    }
    logger.debug("Updated AllergenCatalogs:", result.rows);

    return result.rows;
  },

  _UpdateOralApplianceCatalog: async (_, { appliances }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    if (!appliances || appliances.length === 0) {
      throwGraphQLError(res).status(400).message("No oral appliances provided").throw();
    }

    // Build VALUES placeholders dynamically
    const values = appliances
      .map((_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      )
      .join(", ");

    // Flatten params: [id, name, description, archable, isActive, ...]
    const params = appliances.flatMap(a => [
      a.id,
      a.name === undefined ? null : a.name,
      a.description === undefined ? null : a.description,
      a.archable === undefined ? null : a.archable,
      a.isActive === undefined ? null : a.isActive
    ]);

    const query = `
      UPDATE "OralApplianceCatalog" AS oac
      SET name        = COALESCE(v.name, oac.name),
          description = COALESCE(v.description, oac.description),
          archable    = COALESCE(v.archable, oac.archable),
          isActive    = COALESCE(v.isActive, oac.isActive)
      FROM (VALUES ${values}) AS v(id, name, description, archable, isActive)
      WHERE oac.id = v.id
      RETURNING oac.*;
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      throwGraphQLError(res)
        .status(404)
        .message(`No matching oral appliance catalogs found.`)
        .throw();
    }
    logger.debug("Updated OralApplianceCatalogs:", result.rows);

    return result.rows;
  },

};

module.exports =  Mutation;