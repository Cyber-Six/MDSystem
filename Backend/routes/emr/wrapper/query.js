const db  = require("../../../config/query.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { log } = require("console");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days
const DEFAULT_DATE_STRING = '1970-01-01T00:00:00Z';

const Query = {
  _getUserUpdateTicket: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT pul.id, pul.status, pul.scope, pul.notes, 
        pul."dentalRecordId", pul."vitalSignsId", pul.created_at
        FROM "patientUpdateLog" AS pul
        JOIN "Patients" AS p ON p.id = pul."patientId"
        WHERE p.id = $1
        ORDER BY pul.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );

    const ticket = result.rows[0];
    logger.debug("Fetched Update Ticket:", ticket);
    if (ticket && ticket.status === "InProgress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isUserValidated(userId))) {
        return { ...ticket, patientId: userId, status: "InProgress"}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return { ...ticket, patientId: userId, status: "Expired"};
    }

    return { ...ticket, patientId: userId}; // return scalar ID
  },


  _getUserProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses}, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }
    
    const query = `
      SELECT pr.id, pr.profile_type,
             sp.program, sp.year,
             ep.department, ep.role, ep.position,
             pul.created_at, pul."patientId", pul.status
      FROM "profileRecord" pr
      JOIN "patientUpdateLog" pul ON pul.id = pr.id
      LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
      LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      from || new Date(0),
      statuses || null
    ]);

    logger.debug("User Profile Query Result:", result.rows);
    if (result.rows.length === 0) return [];

    return result.rows.map(row => {
      if (row.profile_type === "Student") {
        return {
          __typename: "StudentProfile",
          id: row.id,
          profile_type: row.profile_type,
          program: row.program,
          year: row.year,
          created_at: row.created_at,
          status: row.status,
        };
      } else if (row.profile_type === "Employee") {
        return {
          __typename: "EmployeeProfile",
          id: row.id,
          department: row.department,
          role: row.role,
          position: row.position,
          created_at: row.created_at,
          status: row.status,
        };
      }
      return null;
    });
  },

  _getUserDentalPhotoRecord: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dpr.*, pul.created_at, pul.status
      FROM "DentalPhotoRecord" dpr
      JOIN "patientUpdateLog" pul ON pul.id = dpr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];
    logger.debug("User Dental Photos Query Result:", result.rows);
    return result.rows;
  },

  _getUserObgynHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ogh.*, pul.created_at, pul.status
      FROM "ObGynHistory" ogh
      JOIN "patientUpdateLog" pul ON pul.id = ogh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);
    logger.debug("User ObGyn History Query Result:", result.rows);
    if (result.rows.length === 0) return [];
    return result.rows;
  },


  _getUserLifestyle: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ls.*, pul.created_at, pul.status
      FROM "Lifestyle" ls
      JOIN "patientUpdateLog" pul ON pul.id = ls.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);
    logger.debug("User Lifestyle Query Result:", result.rows);
    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getUserDentalHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dh.*, pul.created_at, pul.status
      FROM "DentalHistory" dh
      JOIN "patientUpdateLog" pul ON pul.id = dh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];
    logger.debug("User Dental History Query Result:", result.rows);
    return result.rows;
  },

  _getUserDentalRecord: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) { // unc not yet finished
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dr.*, pul.created_at, pul.status
      FROM "patientUpdateLog" pul
      JOIN "DentalRecord" dr ON pul."dentalRecordId" = dr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);
    logger.debug("User Dental Record Query Result:", result.rows);
    if (result.rows.length === 0) return [];
    
    for (const row of result.rows) { // define the every tooth status here
      const teethQuery = `
        SELECT tp.id, tp."toothIndex", tp.legend
        FROM "ToothPlacement" tp
        WHERE "dentalRecordId" = $1;
      `;
      const ToothPlacements = await db.query(teethQuery, [row.id]);
      row.ToothPlacements = ToothPlacements.rows;
    }
    logger.debug("User Dental Record with Tooth Placements:", result.rows);
    for (const row of result.rows) { // define the oral findings here
      const findingsQuery = `
        SELECT "oralFindingId", status, notes
        FROM "oralFindingRecord"
        WHERE "dentalRecordId" = $1;
      `; // somewhere here
      const oralFindings = await db.query(findingsQuery, [row.id]);
      row.oralFindings = oralFindings.rows;
      }
    logger.debug("User Dental Record with Findings:", result.rows);
    return result.rows;
  },

  _getUserVitalSigns: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT vs.*, pul.created_at, pul.status
      FROM "patientUpdateLog" pul
      LEFT JOIN "VitalSigns" vs ON pul."vitalSignsId" = vs.id 
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);
    logger.debug("User Vital Signs Query Result:", result.rows);
    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getUserOralApplianceProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT oa.*, pul.created_at, pul.status
      FROM "OralAppliance" oa
      JOIN "patientUpdateLog" pul ON pul.id = oa.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const appliancesQuery = `
        SELECT id, status, "dateIssued", "tagId", arch
        FROM "OralApplianceRecord"
        WHERE "applianceId" = $1;
      `;
      const ApplianceProfiles = await db.query(appliancesQuery, [row.id]);
      row.appliances = ApplianceProfiles.rows;
    } 
    logger.debug("User Oral Appliance Profile with Appliances:", result.rows);
    return result.rows;
  },

  _getUserEmergencyContact: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ec.*, pul.created_at, pul.status
      FROM "EmergencyContact" ec
      JOIN "patientUpdateLog" pul ON pul.id = ec.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const numbersQuery = `
        SELECT *  
        FROM "EmergencyNumber"
        WHERE "id" = $1 OR "id" = $2
        ORDER BY "id" ASC;
      `;
      const ContactNumbers = await db.query(numbersQuery, [row.firstNumber, row.secondNumber]);
      const numbers = ContactNumbers?.rows || [];
      row.firstContact = numbers.find(n => n.id === row.firstNumber) || null;
      row.secondContact = numbers.find(n => n.id === row.secondNumber) || null;
    }

    logger.debug("User Emergency Contact with Numbers:", result.rows);
    return result.rows; 
  },

  _getUserAllergyProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT al.*, pul.created_at, pul.status
      FROM "Allergy" al
      JOIN "patientUpdateLog" pul ON pul.id = al.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "AllergyRecord"
        WHERE "allergyId" = $1;
      `;
      const AllergenCatalog = await db.query(catalogQuery, [row.id]);
      row.allergies = AllergenCatalog.rows || [];
    }
    logger.debug("User Allergy Profile with Allergies:", result.rows);
    return result.rows;
  },

  _getUserMedicationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT mm.*, pul.created_at, pul.status
      FROM "MaintenanceMedication" mm
      JOIN "patientUpdateLog" pul ON pul.id = mm.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "MedicationRecord"
        WHERE "medicationId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.medications = DomainCatalog.rows || [];
    }

    logger.debug("User Medication Profile with Medications:", result.rows);
    return result.rows;
  },

  _getUserDentalProcedureProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT dp.*, pul.created_at, pul.status
      FROM "DentalProcedure" dp
      JOIN "patientUpdateLog" pul ON pul.id = dp.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "DentalProcedureRecord"
        WHERE "dentalProcedureId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.procedures = DomainCatalog.rows || [];
    }

    logger.debug("User Dental Procedure Profile with Procedures:", result.rows);
    return result.rows;
  },

  _getUserImmunizationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT im.*, pul.created_at, pul.status
      FROM "Immunization" im
      JOIN "patientUpdateLog" pul ON pul.id = im.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "ImmunizationRecord"
        WHERE "immunizationId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.immunizations = DomainCatalog.rows || [];
    }

    logger.debug("User Immunization Profile with Immunizations:", result.rows);
    return result.rows;
  },

  _getUserOperationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT op.*, pul.created_at, pul.status
      FROM "Operation" op
      JOIN "patientUpdateLog" pul ON pul.id = op.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "OperationRecord"
        WHERE "operationId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.operations = DomainCatalog.rows || [];
    }

    logger.debug("User Operation Profile with Operations:", result.rows);
    return result.rows;
  },

  _getUserHospitalizationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT hp.*, pul.created_at, pul.status
      FROM "Hospitalization" hp
      JOIN "patientUpdateLog" pul ON pul.id = hp.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT *
        FROM "HospitalizationRecord"
        WHERE "hospitalizationId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.hospitalizations = DomainCatalog.rows || [];
    }

    logger.debug("User Hospitalization Profile with Hospitalizations:", result.rows);
    return result.rows;
  },

  _getUserMedicalHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT mh.*, pul.created_at, pul.status
      FROM "MedicalHistory" mh
      JOIN "patientUpdateLog" pul ON pul.id = mh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const catalogQuery = `
        SELECT * FROM "MedicalCondition"
        WHERE "medicalHistoryId" = $1;
      `;
      const DomainCatalog = await db.query(catalogQuery, [row.id]);
      row.conditions = DomainCatalog.rows || [];
    }

    logger.debug("User Medical History with Conditions:", result.rows);
    return result.rows;
  },
  
  _getUserVisualAcuityProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT vap.*, pul.created_at, pul.status
      FROM "VisualAcuity" vap
      JOIN "patientUpdateLog" pul ON pul.id = vap.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const acuityQuery = `
        SELECT *
        FROM "VisualAcuityRecord"
        WHERE "id" = $1;
      `;
      const AcuityRecords = await db.query(acuityQuery, [row.id]);
      row.acuity = AcuityRecords.rows[0] || null;
    }
    logger.debug("User Visual Acuity Profile with Acuity Records:", result.rows);
    return result.rows;
  },
  
  _getProcedureDomain: async (_, __, { user, res }) => {
    const domains = ["VisualAcuity", "Medication", "Hospitalization", "Operation", "Immunization", "DentalProcedure"];
    return domains;
  },

  _getDomainCatalogs: async (_, { domain, filterIsValid, offset, limit }, { user, res }) => {
    logger.debug("Fetching Domain Catalogs:", { domain, filterIsValid, offset, limit });
    const query = `
    SELECT *
    FROM "DomainTypeCatalog"
    WHERE domain = COALESCE($1, domain)
      AND "isValid" = COALESCE($2, "isValid")
    ORDER BY created_at ASC
    LIMIT $3 OFFSET $4;

    `;

    const result = await db.query(query, [
      domain || null,
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);
    logger.debug("Domain Catalogs Query Result:", result.rows);
    return result.rows;
  },


  _getAllergenCatalogs: async (_, { type, filterIsValid, offset, limit }, { user, res }) => {
    const query = `
      SELECT *
      FROM "AllergenCatalog"
      WHERE type = COALESCE($1, type)
        AND "isValid" = COALESCE($2, "isValid")
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4;
    `;

    const result = await db.query(query, [
      type || null,
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);
    logger.debug("Allergen Catalogs Query Result:", result.rows);
    return result.rows;
  },

  _getOralApplianceCatalogs: async (_, { filterIsValid, offset, limit }, { user, res }) => {
    const query = `
      SELECT *
      FROM "oralApplianceCatalog"
      WHERE "isActive" = COALESCE($1, "isActive")
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);

    logger.debug("User Oral Appliance Profile with Appliances:", result.rows);
    return result.rows;
  },

  _getStatusUpdateTickets: async (_, { statuses, branch, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

  const query =`
        SELECT *
        FROM (
          SELECT DISTINCT ON (pul."patientId")
            pul.id            AS id,
            pul."patientId"   AS "patientId",
            pul.status        AS status,
            pul.scope         AS scope,
            pul.created_at    AS created_at,
            COALESCE(up.first_name, upl.first_name)   AS first_name,
            COALESCE(up.last_name,  upl.last_name)    AS last_name,
            up.branch         AS branch
          FROM "patientUpdateLog" pul
          JOIN "UsersPersonal" up ON up.id = pul."patientId"
          LEFT JOIN LATERAL (
            SELECT first_name, last_name
            FROM "UsersPersonalLog"
            WHERE user_id = pul."patientId"
            ORDER BY created_at DESC
            LIMIT 1
          ) upl ON true
          ORDER BY pul."patientId", pul.created_at DESC, pul.id DESC
        ) latest
        WHERE ($1 = 'Both' OR latest.branch::text = $1)
          AND latest.status::text = ANY(COALESCE($2, ARRAY[latest.status::text]))
        ORDER BY latest.created_at DESC
        LIMIT $3 OFFSET $4;
      `;

    const result = await db.query(query, [
      branch,
      statuses && statuses.length > 0 ? statuses : null,
      limit || 10,
      offset || 0
    ]);

    logger.debug("User Status Update Tickets with Statuses:", result.rows);
    return result.rows;
  },

  _searchDomainCatalogs: async (_, { domain, filterIsValid, names }, { user, res }) => {
    const query = `
      SELECT *
      FROM "DomainTypeCatalog"
      WHERE domain = COALESCE($1, domain)
        AND name = ANY($2)
        AND "isValid" = COALESCE($3, "isValid")
      ORDER BY created_at ASC;
    `;

    const result = await db.query(query, [
      domain || null,
      names || [],
      filterIsValid === undefined ? null : filterIsValid
    ]);

    logger.debug("Searched Domain Catalogs Query Result:", result.rows);
    return result.rows;
  },

  _searchAllergenCatalogs: async (_, { allergens, filterIsValid }, { user, res }) => {
    const query = `
      SELECT *
      FROM "AllergenCatalog"
      WHERE name = ANY($1)
        AND "isValid" = COALESCE($2, "isValid")
      ORDER BY created_at ASC;
    `;

    const result = await db.query(query, [
      allergens || [],
      filterIsValid === undefined ? null : filterIsValid
    ]);

    logger.debug("Searched Allergen Catalogs Query Result:", result.rows);
    return result.rows;
  },

  _searchOralApplianceCatalogs: async (_, { filterIsValid, names }, { user, res }) => {
    const query = `
      SELECT *
      FROM "oralApplianceCatalog"
      WHERE name = ANY($1)
        AND "isActive" = COALESCE($2, "isActive")
      ORDER BY created_at ASC;
    `;

    const result = await db.query(query, [
      names || [],
      filterIsValid === undefined ? null : filterIsValid
    ]);

    logger.debug("Searched Oral Appliance Catalogs Query Result:", result.rows);
    return result.rows;
  },

  _getTicketVitalSignsId: async (_, { ticketId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT pul.id, pul."vitalSignsId", pul.created_at
      FROM "patientUpdateLog" pul
      WHERE pul.id = $1
      LIMIT 1;
    `;

    const result = await db.query(query, [ticketId]);

    if (result.rows.length === 0) {
      return null;
    }

    logger.debug("Ticket VitalSignsId Query Result:", result.rows[0]);
    return result.rows[0];
  },

  _getTicketDentalRecordId: async (_, { ticketId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT pul.id, pul."dentalRecordId", pul.created_at
      FROM "patientUpdateLog" pul
      WHERE pul.id = $1
      LIMIT 1;
    `;

    const result = await db.query(query, [ticketId]);

    if (result.rows.length === 0) {
      return null;
    }

    logger.debug("Ticket DentalRecordId Query Result:", result.rows[0]);
    return result.rows[0];
  },

  _getUserTicketIds: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit, statuses }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT
        pul.id,
        pul."vitalSignsId",
        pul."dentalRecordId",
        pul.status,
        pul.scope,
        pul.created_at
      FROM "patientUpdateLog" pul
      WHERE pul."patientId" = $1 AND pul.created_at >= $4 AND
        (pul.status = ANY($5::"UpdateStatus"[]) OR $5 IS NULL)
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from),
      statuses || null
    ]);

    logger.debug("User Ticket IDs Query Result:", result.rows);
    return result.rows;
  },

  // ─── Patient Search ───────────────────────────────────────────────────────
  _getPatientBasicInfo: async (_, { userId }, { user, res }) => {
    const query = `
      SELECT
        up.id,
        up.identifier,
        up.branch,
        up.sex,
        upl.first_name,
        upl.last_name,
        upl.middle_name,
        upl.suffix,
        pr.profile_type,
        sp.program,
        sp.year,
        ep.department,
        ep.role,
        latest.id           AS latest_ticket_id,
        latest.status       AS latest_status,
        latest.scope        AS latest_scope,
        latest.created_at   AS latest_updated_at
      FROM "UsersPersonal" up
      JOIN "Patients" p ON p.id = up.id
      LEFT JOIN LATERAL (
        SELECT l.first_name, l.last_name, l.middle_name, l.suffix
        FROM "UsersPersonalLog" l
        WHERE l.user_id = up.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) upl ON true
      LEFT JOIN LATERAL (
        SELECT pul.id, pul.status, pul.scope, pul.created_at
        FROM "patientUpdateLog" pul
        WHERE pul."patientId" = up.id
        ORDER BY pul.created_at DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT pr2.id, pr2.profile_type
        FROM "profileRecord" pr2
        JOIN "patientUpdateLog" pul2 ON pul2.id = pr2.id
        WHERE pul2."patientId" = up.id
        ORDER BY pul2.created_at DESC
        LIMIT 1
      ) pr ON true
      LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
      LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE up.id = $1
      LIMIT 1;
    `;
    const result = await db.query(query, [userId]);
    logger.debug('getPatientBasicInfo result:', result.rows[0]);
    return result.rows[0] || null;
  },

  _searchPatients: async (_, { searchTerm, branch, offset, limit }, { user, res }) => {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const term = searchTerm.trim();
    const prefixTerm = term + '%';          // for identifier prefix match
    const anyTerm   = '%' + term + '%';     // for name contains match

    const query = `
      SELECT
        up.id,
        up.identifier,
        up.branch,
        up.sex,
        upl.first_name,
        upl.last_name,
        upl.middle_name,
        upl.suffix,
        pr.profile_type,
        sp.program,
        sp.year,
        ep.department,
        ep.role,
        latest.id           AS latest_ticket_id,
        latest.status       AS latest_status,
        latest.scope        AS latest_scope,
        latest.created_at   AS latest_updated_at
      FROM "UsersPersonal" up
      JOIN "Patients" p ON p.id = up.id
      JOIN "UserCredentials" uc ON uc.id = up.id
      -- latest personal name snapshot
      LEFT JOIN LATERAL (
        SELECT l.first_name, l.last_name, l.middle_name, l.suffix
        FROM "UsersPersonalLog" l
        WHERE l.user_id = up.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) upl ON true
      -- latest update ticket
      LEFT JOIN LATERAL (
        SELECT pul.id, pul.status, pul.scope, pul.created_at
        FROM "patientUpdateLog" pul
        WHERE pul."patientId" = up.id
        ORDER BY pul.created_at DESC
        LIMIT 1
      ) latest ON true
      -- latest profile record
      LEFT JOIN LATERAL (
        SELECT pr2.id, pr2.profile_type
        FROM "profileRecord" pr2
        JOIN "patientUpdateLog" pul2 ON pul2.id = pr2.id
        WHERE pul2."patientId" = up.id
        ORDER BY pul2.created_at DESC
        LIMIT 1
      ) pr ON true
      LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
      LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE
        ($1::text IS NULL OR up.branch::text = $1::text)
        AND (
          up.identifier::text ILIKE $2
          OR (COALESCE(upl.first_name, '') || ' ' || COALESCE(upl.last_name, '')) ILIKE $3
          OR (COALESCE(upl.last_name, '')  || ', ' || COALESCE(upl.first_name, '')) ILIKE $3
          OR COALESCE(upl.first_name, '') ILIKE $3
          OR COALESCE(upl.last_name, '') ILIKE $3
          OR uc.email ILIKE $3
        )
      ORDER BY
        CASE WHEN up.identifier::text ILIKE $2 THEN 0 ELSE 1 END,
        upl.last_name, upl.first_name
      LIMIT $4 OFFSET $5;
    `;

    const result = await db.query(query, [
      branch || null,
      prefixTerm,
      anyTerm,
      limit || 15,
      offset || 0,
    ]);

    logger.debug(`Patient search for "${term}" returned ${result.rows.length} results`);
    return result.rows;
  },
};


module.exports = Query;
