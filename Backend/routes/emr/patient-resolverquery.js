const db = require("../../config/query.js");
const { throwGraphQLError } = require("../../utils/graphql-helper.js");
const logger = require("../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
const { get } = require("http");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days

const Query = {
  getProfile: async (_, args, {user, logId}) => {
    if (!user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    await db.query("", [user.id, logId]);
    // Example: return a student profile
    return { id: "1", program: "BSCS", year: "FIRST" };
  },
  getUpdateTicket: async (_, {}, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
      `SELECT log.id, log.status, log.created_at
       FROM "patientUpdateLog" AS log
       JOIN "Patients" AS p ON p.id = log."patientId"
       WHERE p.id = $1
       ORDER BY log.created_at DESC
       LIMIT 1;`,
      [user.id]
    );

    const ticket = result.rows[0];

    if (ticket && ticket.status.toLowerCase() === "in-progress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(user.id))) {
        return ticket.id;
      } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return ticket.id;
    }

    return ticket?.id; // return scalar ID
  },

  getUserProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT pr.id, pr.profile_type,
             sp.program, sp.year,
             ep.department, ep.role, ep.position,
             log.status, log.created_at, log.scope
      FROM "profileRecord" pr
      LEFT JOIN "student_profile" sp ON pr.id = sp.id
      LEFT JOIN "employee_profile" ep ON pr.id = ep.id
      JOIN "patientUpdateLog" log ON pr.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => {
      if (row.profile_type === 'Student') {
        return {
          id: row.id,
          program: row.program,
          year: row.year,
          archived_at: null
        };
      } else if (row.profile_type === 'Employee') {
        return {
          id: row.id,
          department: row.department,
          role: row.role,
          position: row.position,
          archived_at: null
        };
      }
      return null;
    }).filter(Boolean);
  },

  getUserDentalPhotos: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT dp.id, dp.upperTeeth, dp.lowerTeeth, dp.isValid, log.created_at
      FROM "dentalPhotos" dp
      JOIN "patientUpdateLog" log ON dp.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      upperTeeth: row.upperTeeth,
      lowerTeeth: row.lowerTeeth,
      isValid: row.isValid,
      archived_at: null
    }));
  },

  getUserObgynHistory: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT oh.id, oh.lastMenstrualPeriod, oh.hasDysmenorrhea, oh.notes, log.created_at
      FROM "ObgynHistory" oh
      JOIN "patientUpdateLog" log ON oh.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      lastMenstrualPeriod: row.lastMenstrualPeriod,
      hasDysmenorrhea: row.hasDysmenorrhea,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserLifestyle: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT l.id, l.smoker, l.numberOfCigarettesPerDay, l.yearsSmoked, l.alcoholConsumer, l.frequencyOfAlcoholConsumption, l.notes, log.created_at
      FROM "Lifestyle" l
      JOIN "patientUpdateLog" log ON l.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      smoker: row.smoker,
      numberOfCigarettesPerDay: row.numberOfCigarettesPerDay,
      yearsSmoked: row.yearsSmoked,
      alcoholConsumer: row.alcoholConsumer,
      frequencyOfAlcoholConsumption: row.frequencyOfAlcoholConsumption,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserDentalHistory: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT dh.id, dh.seenByDentist, dh.lastDentalCleaning, dh.purpose, dh.lastVisitDate, log.created_at
      FROM "DentalHistory" dh
      JOIN "patientUpdateLog" log ON dh.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      seenByDentist: row.seenByDentist,
      lastDentalCleaning: row.lastDentalCleaning,
      purpose: row.purpose,
      lastVisitDate: row.lastVisitDate,
      archived_at: null
    }));
  },

  getUserDentalRecord: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT dr.id, dr.numberOfTeeth, dr.cariesForFilling, dr.cariesForExtraction, dr.rootFragment, dr.missingTeeth, dr.filled, dr.totalDMF, dr.notes,
             dr.oralFindings, dr.ToothPlacement, log.created_at
      FROM "DentalRecord" dr
      JOIN "patientUpdateLog" log ON dr.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      numberOfTeeth: row.numberOfTeeth,
      cariesForFilling: row.cariesForFilling,
      cariesForExtraction: row.cariesForExtraction,
      rootFragment: row.rootFragment,
      missingTeeth: row.missingTeeth,
      filled: row.filled,
      totalDMF: row.totalDMF,
      notes: row.notes,
      oralFindings: row.oralFindings,
      ToothPlacement: row.ToothPlacement,
      created_at: row.created_at
    }));
  },

  getUserVitalSigns: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT vs.id, vs.height_cm, vs.weight_kg, vs.blood_pressure, vs.heart_rate, vs.temperature, vs.notes, log.created_at
      FROM "VitalSigns" vs
      JOIN "patientUpdateLog" log ON vs.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
      blood_pressure: row.blood_pressure,
      heart_rate: row.heart_rate,
      temperature: row.temperature,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserOralApplianceProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT oap.id, oap.appliances, oap.notes, log.created_at
      FROM "OralApplianceProfile" oap
      JOIN "patientUpdateLog" log ON oap.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      appliances: row.appliances,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserEmergencyContact: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT ec.id, ec.firstContact, ec.secondContact, log.created_at
      FROM "EmergencyContact" ec
      JOIN "patientUpdateLog" log ON ec.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      firstContact: row.firstContact,
      secondContact: row.secondContact,
      archived_at: null
    }));
  },

  getUserAllergyProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT ap.id, ap.allergies, ap.notes, log.created_at
      FROM "AllergyProfile" ap
      JOIN "patientUpdateLog" log ON ap.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      allergies: row.allergies,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserMedicationProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT mp.id, mp.medications, mp.notes, log.created_at
      FROM "MedicationProfile" mp
      JOIN "patientUpdateLog" log ON mp.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      medications: row.medications,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserDentalProcedureProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT dpp.id, dpp.procedures, dpp.notes, log.created_at
      FROM "DentalProcedureProfile" dpp
      JOIN "patientUpdateLog" log ON dpp.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      procedures: row.procedures,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserImmunizationProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT ip.id, ip.immunizations, ip.notes, log.created_at
      FROM "ImmunizationProfile" ip
      JOIN "patientUpdateLog" log ON ip.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      immunizations: row.immunizations,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserOperationProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT op.id, op.operations, op.notes, log.created_at
      FROM "OperationProfile" op
      JOIN "patientUpdateLog" log ON op.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      operations: row.operations,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserHospitalizationProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT hp.id, hp.hospitalizations, hp.notes, log.created_at
      FROM "HospitalizationProfile" hp
      JOIN "patientUpdateLog" log ON hp.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      hospitalizations: row.hospitalizations,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserMedicalHistory: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT mh.id, mh.conditions, mh.notes, log.created_at
      FROM "MedicalHistory" mh
      JOIN "patientUpdateLog" log ON mh.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      conditions: row.conditions,
      notes: row.notes,
      archived_at: null
    }));
  },

  getUserVisualAcuityProfile: async (_, { id, from, to, offset, limit, scope, statuses }, { user, res }) => {
    if (!user || !user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `
      SELECT vap.id, vap.notes, vap.visualAcuity, log.created_at
      FROM "VisualAcuityProfile" vap
      JOIN "patientUpdateLog" log ON vap.id = log.id
      WHERE log."patientId" = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (from) {
      query += ` AND log.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND log.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    if (scope) {
      query += ` AND log.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    if (statuses && statuses.length > 0) {
      query += ` AND log.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    query += ` ORDER BY log.created_at DESC`;

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
      paramIndex++;
    }
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      notes: row.notes,
      visualAcuity: row.visualAcuity,
      archived_at: null
    }));
  },

  // Miscellaneous queries can be added if needed, but focusing on updates
};

module.exports = { Query };
