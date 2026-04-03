const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const permit = require("../../../../../services/permit.js");
const logger = require("../../../../../utils/logger.js");

const { isConnectedAnywhere, emitToUserWithAck } = require("../../../../../config/sockets");
const { enqueueNotificationEmail } = require("../../../../../services/emailservice.js");
const { findEmailByUserId } = require("../../../../../config/query.js");

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getAvailableMedicine(_, args, { res });
  },

  getMedicineRequestById: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicineRequestById(_, args, { res });
  },

  getMedicineRequests: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.inventory_allow_manage_requests, args.patientId);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine request view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicineRequests(_, args, { res });
  },

  getAllMedicineRequests: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine request list attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getAllMedicineRequests(_, args, { res });
  },
};

const Mutation = {
  setStatusMedicineRequest: async (_, { requestId, status, notes }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_manage_requests);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine request status change attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    if (!['Approved', 'Rejected'].includes(status)) {
      throwGraphQLError(res).message("Invalid status. Must be Approved or Rejected").status(400).throw();
    }

    const result = await Wrapper.Mutation._setStatusMedicineRequest(_, { requestId, status, approvedBy: user.id, notes }, { user, res });
    
    // Notify patient: socket with ack, fall back to email if not acked or offline
    try {
      const patientId = result.patientId;
      const approved = status === 'Approved';
      
      console.log(`[MEDICINE_REQUEST] 📤 Attempting to notify patient ${patientId} about ${status}`);

      const acked = (await isConnectedAnywhere(patientId))
        && await emitToUserWithAck(patientId, `medicine:request:${status.toLowerCase()}`, { requestId, status, notes });

      console.log(`[MEDICINE_REQUEST] Acknowledgement received: ${acked}`);

      if (!acked) {
        console.log(`[MEDICINE_REQUEST] Patient not online or didn't acknowledge, sending email...`);
        const patientEmail = await findEmailByUserId(patientId);
        if (patientEmail) {
          await enqueueNotificationEmail(
            patientEmail,
            approved ? 'Medicine Request Approved' : 'Medicine Request Rejected',
            approved
              ? `Your medicine request <strong>#${requestId}</strong> has been <span style="color:green;font-weight:bold;">approved</span> by the medical staff. You may now proceed to the clinic to collect your medicine.`
              : `Your medicine request <strong>#${requestId}</strong> has been <span style="color:red;font-weight:bold;">rejected</span> by the medical staff. Please contact the clinic if you believe this is an error or to submit a new request.`,
            notes ?? null,
          );
          console.log(`[MEDICINE_REQUEST] ✅ Email queued for ${patientEmail}`);
        } else {
          console.log(`[MEDICINE_REQUEST] ❌ No email found for patient ${patientId}`);
        }
      } else {
        console.log(`[MEDICINE_REQUEST] ✅ Real-time notification delivered successfully`);
      }
    } catch (notifErr) {
      logger.error("Failed to send medicine request notification:", notifErr);
      console.error('[MEDICINE_REQUEST] ❌ Notification error:', notifErr);
    }
    
    return result;
  },
};

module.exports = { Query, Mutation };