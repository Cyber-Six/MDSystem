const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const permit = require("../../../../../services/permit.js");
const logger = require("../../../../../utils/logger.js");

const { isConnectedAnywhere, emitToUserWithAck } = require("../../../../../config/sockets");
const { enqueueNotificationEmail } = require("../../../../../services/emailservice.js");
const { findEmailByUserId } = require("../../../../../config/query.js");

// Ensure Wrapper is properly loaded
if (!Wrapper || !Wrapper.Query || !Wrapper.Mutation) {
  logger.error("ERROR: Wrapper or its properties are undefined. Wrapper exports:", Object.keys(Wrapper || {}));
  throw new Error("MedicineRequest Wrapper module failed to load properly");
}

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      return await Wrapper.Query._getAvailableMedicine(_, args, { res });
    } catch (error) {
      logger.error("Error in getAvailableMedicine resolver:", error);
      throwGraphQLError(res).message("Failed to fetch available medicines").status(500).throw();
    }
  },

  getMedicineRequestById: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      return await Wrapper.Query._getMedicineRequestById(_, args, { res });
    } catch (error) {
      logger.error("Error in getMedicineRequestById resolver:", error);
      throwGraphQLError(res).message("Failed to fetch medicine request").status(500).throw();
    }
  },

  getMedicineRequests: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests, args.patientId);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      return await Wrapper.Query._getMedicineRequests(_, args, { res });
    } catch (error) {
      logger.error("Error in getMedicineRequests resolver:", error);
      throwGraphQLError(res).message("Failed to fetch medicine requests").status(500).throw();
    }
  },

  getAllMedicineRequests: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request list attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }
      return await Wrapper.Query._getAllMedicineRequests(_, args, { res });
    } catch (error) {
      logger.error("Error in getAllMedicineRequests resolver:", error);
      throwGraphQLError(res).message("Failed to fetch medicine requests").status(500).throw();
    }
  },
};

const Mutation = {
  setStatusMedicineRequest: async (_, { requestId, status, notes }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request status change attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

      if (!['Approved', 'Rejected', 'Completed'].includes(status)) {
        throwGraphQLError(res).message("Invalid status. Must be Approved, Rejected, or Completed").status(400).throw();
      }

      const result = await Wrapper.Mutation._setStatusMedicineRequest(_, { requestId, status, approvedBy: user.id, notes }, { res });
      
      // Notify patient: socket with ack, fall back to email if not acked or offline
      try {
        const patientId = result.patientId;
        const approved = status === 'Approved';
        const completed = status === 'Completed';

        const acked = (await isConnectedAnywhere(patientId))
          && await emitToUserWithAck(patientId, `medicine:request:${status.toLowerCase()}`, { requestId, status, notes });

        if (!acked) {
          const patientEmail = await findEmailByUserId(patientId);
          if (patientEmail) {
            let subject, message;
            
            if (completed) {
              subject = 'Medicine Request Dispensed';
              message = `Your medicine request <strong>#${requestId}</strong> has been <span style="color:green;font-weight:bold;">dispensed</span>. You have received your medicine from the clinic.`;
            } else if (approved) {
              subject = 'Medicine Request Approved';
              message = `Your medicine request <strong>#${requestId}</strong> has been <span style="color:green;font-weight:bold;">approved</span> by the medical staff. You may now proceed to the clinic to collect your medicine.`;
            } else {
              subject = 'Medicine Request Rejected';
              message = `Your medicine request <strong>#${requestId}</strong> has been <span style="color:red;font-weight:bold;">rejected</span> by the medical staff. Please contact the clinic if you believe this is an error or to submit a new request.`;
            }
            
            await enqueueNotificationEmail(patientEmail, subject, message, notes ?? null);
          }
        }
      } catch (notifErr) {
        logger.error("Failed to send medicine request notification:", notifErr);
      }
      
      return result;
    } catch (error) {
      logger.error("Error in setStatusMedicineRequest resolver:", error);
      throwGraphQLError(res).message("Failed to update medicine request status").status(500).throw();
    }
  },

  // ✅ PART 2: Add medicine to existing request
  addMedicineToRequest: async (_, { requestId, items }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
      if (!isPermitted) {
        logger.warn("Unauthorized medicine request modification attempt by staff " + user.id);
        throwGraphQLError(res).message("Unauthorized").status(401).throw();
      }

      return await Wrapper.Mutation._addMedicineToRequest(_, { requestId, items }, { res });
    } catch (error) {
      logger.error("Error in addMedicineToRequest resolver:", error);
      throwGraphQLError(res).message("Failed to add medicine to request").status(500).throw();
    }
  },
};

module.exports = { Query, Mutation };