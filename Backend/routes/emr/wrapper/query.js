const db  = require("../../../config/query.js");

const { throwGraphQLError } = require("../../../utils/graphql-helper.js");
const logger = require("../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days
const DEFAULT_DATE_STRING = '1970-01-01T00:00:00Z';

const Query = {
  _getUserUpdateTicket: async (_, { userId }, { user, res }) => {
    if (!userId) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
       `SELECT log.id, log.status, log.scope, log.created_at
        FROM "patientUpdateLog" AS log
        JOIN "Patients" AS p ON p.id = log."patientId"
        WHERE p.id = $1
        ORDER BY log.created_at DESC
        LIMIT 1;
        `,
      [userId]
      );
     
    const ticket = result.rows[0];

    if (ticket && ticket.status === "InProgress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(userId))) {
        return {id: ticket.id, patientId: userId, status: "InProgress", scope: ticket.scope}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return {id: ticket.id, patientId: userId, status: "Expired", scope: ticket.scope};
    }

    return {id: ticket?.id, patientId: userId, status: ticket?.status, scope: ticket?.scope}; // return scalar ID
  },


  _getUserProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit,  }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }
    
    const query = `
      SELECT pr.id, pr.profile_type,
             sp.program, sp.year,
             sp.guardian_name, sp.guardian_relation, sp.guardian_contact,
             ep.department, ep.role, ep.position,
             pul.created_at, pul."patientId", pul.status
      FROM "profileRecord" pr
      LEFT JOIN "patientUpdateLog" pul ON pul.id = pr.id
      LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
      LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      from || new Date(0)
    ]);

    if (result.rows.length === 0) return [];

    return result.rows.map(row => {
      if (row.profile_type === "Student") {
        return {
          __typename: "StudentProfile",
          id: row.id,
          profile_type: row.profile_type,
          program: row.program,
          year: row.year,
          guardian_name: row.guardian_name,
          guardian_relation: row.guardian_relation,
          guardian_contact: row.guardian_contact,
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

  _getUserDentalPhotos: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dpr.*, pul.created_at, pul.status
      FROM "DentalPhotoRecord" dpr
      JOIN "patientUpdateLog" pul ON pul.id = dpr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getUserObgynHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ogh.*, pul.created_at, pul.status
      FROM "ObGynHistory" ogh
      JOIN "patientUpdateLog" pul ON pul.id = ogh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },


  _getUserLifestyle: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ls.*, pul.created_at, pul.status
      FROM "Lifestyle" ls
      JOIN "patientUpdateLog" pul ON pul.id = ls.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

// -------------------------------------- restart testing from here ------------------------------

  _getUserDentalHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dh.*, pul.created_at, pul.status
      FROM "DentalHistory" dh
      JOIN "patientUpdateLog" pul ON pul.id = dh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getUserDentalRecord: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) { // unc not yet finished
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT dr.*, pul.created_at, pul.status
      FROM "DentalRecord" dr
      JOIN "patientUpdateLog" pul ON pul.id = dr.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    
    for (const row of result.rows) { // define the every tooth status here
      const teethQuery = `
        SELECT tp.id, tp.toothIndex, tp.legend
        FROM "ToothPlacement" tp
        WHERE "dentalRecordId" = $1;
      `;
      const ToothPlacements = await db.query(teethQuery, [row.id]);
      row.ToothPlacements = ToothPlacements.rows;
    }
    
    for (const row of result.rows) { // define the oral findings here
      const findingsQuery = `
        SELECT oralFindingId, status, notes
        FROM "OralFindingRecord"
        WHERE "dentalRecordId" = $1;
      `; // somewhere here
      const DentalFindings = await db.query(findingsQuery, [row.id]);
      row.DentalFindings = DentalFindings.rows;
      }
    return result.rows;
  },

  _getUserVitalSigns: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT vs.*, pul.created_at, pul.status
      FROM "VitalSigns" vs
      JOIN "patientUpdateLog" pul ON pul.id = vs.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];
    return result.rows;
  },

  _getUserOralApplianceProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT oa.*, pul.created_at, pul.status
      FROM "OralAppliance" oa
      JOIN "patientUpdateLog" pul ON pul.id = oa.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const appliancesQuery = `
        SELECT status, dateIssued, tagId, arch
        FROM "OralApplianceRecord"
        WHERE "oralApplianceId" = $1;
      `;
      const ApplianceProfiles = await db.query(appliancesQuery, [row.id]);
      row.appliances = ApplianceProfiles.rows;
    } 
    return result.rows;
  },

  _getUserEmergencyContact: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT ec.*, pul.created_at, pul.status
      FROM "EmergencyContact" ec
      JOIN "patientUpdateLog" pul ON pul.id = ec.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
    ]);

    if (result.rows.length === 0) return [];

    for (const row of result.rows) {
      const numbersQuery = `
        SELECT *  
        FROM "EmergencyNumber"
        WHERE "id" = $1 OR "id" = $2
        ORDER BY "id" ASC;
      `;
      const ContactNumbers = await db.query(numbersQuery, [row.firstNumber, row.secondNumber  ]);
      const f1 = row.firstNumber > row.secondNumber ? 1 : 0;
      row.firstContact = ContactNumbers?.rows[f1] || null;
      row.secondContact = ContactNumbers?.rows[!f1] || null;
    }

    return result.rows; 
  },

  _getUserAllergyProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const query = `
      SELECT al.*, pul.created_at, pil.status
      FROM "Allergy" al
      JOIN "patientUpdateLog" pul ON pul.id = al.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserMedicationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT mm.*, pul.created_at, pul.status
      FROM "MaintenanceMedication" mm
      JOIN "patientUpdateLog" pul ON pul.id = mm.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserDentalProcedureProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT dp.*, pul.created_at, pul.status
      FROM "DentalProcedure" dp
      JOIN "patientUpdateLog" pul ON pul.id = dp.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserImmunizationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT im.*, pul.created_at, pul.status
      FROM "Immunization" im
      JOIN "patientUpdateLog" pul ON pul.id = im.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserOperationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT op.*, pul.created_at, pul.status
      FROM "Operation" op
      JOIN "patientUpdateLog" pul ON pul.id = op.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserHospitalizationProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT hp.*, pul.created_at, pul.status
      FROM "Hospitalization" hp
      JOIN "patientUpdateLog" pul ON pul.id = hp.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },

  _getUserMedicalHistory: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT mh.*, pul.created_at, pul.status
      FROM "MedicalHistory" mh
      JOIN "patientUpdateLog" pul ON pul.id = mh.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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

    return result.rows;
  },
  
  _getUserVisualAcuityProfile: async (_, { userId, from=DEFAULT_DATE_STRING, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
      }
    const query = `
      SELECT vap.*, pul.created_at, pul.status
      FROM "VisualAcuity" vap
      JOIN "patientUpdateLog" pul ON pul.id = vap.id
      WHERE pul."patientId" = $1 AND pul.created_at >= $4
      ORDER BY pul.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      userId,
      limit || 10,
      offset || 0,
      new Date(from)
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
    return result.rows;
  },
  
  _getProcedureDomain: async (_, __, { user, res }) => {
    const domains = ["VisualAcuity", "Medication", "Hospitalization", "Operation", "Immunization", "DentalProcedure"];
    return domains;
  },

  _getDomainCatalogs: async (_, { domain, filterIsValid, offset, limit }, { user, res }) => {
    console.log("Fetching Domain Catalogs:", { domain, filterIsValid, offset, limit });
    const query = `
    SELECT *
    FROM "DomainTypeCatalog"
    WHERE domain = COALESCE($1, domain)
      AND "isValid" = COALESCE($2, "isValid")
    ORDER BY created_at ASC
    LIMIT $3 OFFSET $4;

    `;
    console.log(typeof domain);
    const result = await db.query(query, [
      domain || null,
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);
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

    return result.rows;
  },

  _getOralFindingCatalogs: async (_, { filterIsValid, offset, limit }, { user, res }) => {
    const query = `
      SELECT *
      FROM "oralFindingCatalog"
      WHERE "isActive" = COALESCE($1, "isActive")
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(query, [
      filterIsValid === undefined ? null : filterIsValid,
      limit || 10,
      offset || 0
    ]);

    return result.rows;
  },

  _getStatusUpdateTickets: async (_, { statuses, branch, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).status(403).message("Forbidden").throw();
    }

    const query = `
      SELECT *
      FROM (
        SELECT DISTINCT ON (pul."patientId") pul.*, up.*
        FROM "patientUpdateLog" pul
        JOIN "UsersPersonal" up ON up.id = pul."patientId"
        ORDER BY pul."patientId", pul.created_at DESC, pul.id DESC
      ) latest
      WHERE latest.branch = $1
        AND latest.status = ANY(COALESCE($2, ARRAY[latest.status]))
      ORDER BY latest.created_at DESC
      LIMIT $3 OFFSET $4;
    `;

    const result = await db.query(query, [
      branch,
      statuses && statuses.length > 0 ? statuses : null,
      limit || 10,
      offset || 0
    ]);

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

    return result.rows;
  },
};


module.exports = Query;