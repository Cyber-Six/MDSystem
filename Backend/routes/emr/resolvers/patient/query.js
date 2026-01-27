const db  = require("../../../../config/query.js");

const { upsertEmergencyNumber, upsertAllergenCatalog,
  upsertDomainCatalog } = require("../../query/upsert.js");

const anchor = require("../../query/anchor.js");
const remove = require("../../query/delete.js");

const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../env") });

const UPDATE_TICKET_EXPIRY_SEC = parseInt(process.env.UPDATE_TICKET_EXPIRY_SEC, 10) || 604800; // default 7 days

const BorrowQuery = require("../medical/query.js");

const Query = {
  getUpdateTicket: async (_, {}, { user, res }) => {
    if (!user || !user.id) {
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
      [user.id]
      );
     
    const ticket = result.rows[0];

    if (ticket && ticket.status === "InProgress") {
      const cutoff = Date.now() - UPDATE_TICKET_EXPIRY_SEC * 1000;
      const createdAt = new Date(ticket.created_at).getTime();

      if (createdAt >= cutoff || !(await db.isPatientValidated(user.id))) {
        return {id: ticket.id, status: "InProgress", scope: ticket.scope}; 
        } // still valid until nth days or the first ticket

      await db.setExpiredUpdateTickets(ticket.id); // mark expired
      return {id: ticket.id, status: "Expired", scope: ticket.scope};
    }

    return {id: ticket?.id, status: ticket?.status, scope: ticket?.scope}; // return scalar ID
  },

  getProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },


  getDentalPhotos: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserDentalPhotos(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getObgynHistory: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserObgynHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getLifestyle: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserLifestyle(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalHistory: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserDentalHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalRecord: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserDentalRecord(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getVitalSigns: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserVitalSigns(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },
  
  getOralApplianceProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserOralApplianceProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getEmergencyContact: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserEmergencyContact(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getAllergyProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserAllergyProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getMedicationProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserMedicationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getDentalProcedureProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserDentalProcedureProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getImmunizationProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserImmunizationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getOperationProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserOperationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getHospitalizationProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserHospitalizationProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getMedicalHistory: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserMedicalHistory(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },

  getVisualAcuityProfile: async (_, __, { user, res }) => {
    const result = await BorrowQuery.getUserVisualAcuityProfile(_, {userId: user.id, offset: 0, limit: 1}, { user, res });
    if (result.length === 0) return null;  
    else if (result[0].status === "InProgress") return result[0];

    throwGraphQLError(res).message("No active profile found.").status(404).throw();
  },
};


module.exports = Query;