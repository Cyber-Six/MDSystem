const Wrapper = require("../wrapper/wrapper.js");
const { hasActiveRequest, validateBatchesWithQuantity } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { emitToRoom } = require("../../../../../config/sockets");
const db = require("../../../../../config/query.js");
const logger = require("../../../../../utils/logger.js");

// Check if Wrapper loaded properly
if (!Wrapper || !Wrapper.Query || !Wrapper.Query._getAvailableMedicine) {
  logger.error("❌ Wrapper module failed to load properly");
  logger.error("Wrapper:", Wrapper);
  logger.error("Wrapper.Query:", Wrapper?.Query);
  throw new Error("Wrapper module not loaded correctly");
}

logger.info("✅ Wrapper module loaded successfully");

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    try {
      logger.info("Fetching available medicines for location:", args.location);
      const result = await Wrapper.Query._getAvailableMedicine(_, args, { res });
      logger.info("Medicines fetched:", result?.length || 0);
      return result;
    } catch (error) {
      logger.error("Error in getAvailableMedicine:", error);
      throw error;
    }
  },

  getMedicineStatus: async (_, __, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return await Wrapper.Query._getMedicineStatus(_, { patientId: user.id }, { res });
  },

  getMedicineRequestById: async (_, { requestId }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return await Wrapper.Query._getMedicineRequestById(_, { requestId }, { res });
  },

  getMedicineRequests: async (_, { patientId, offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    // Patients can only view their own requests
    if (user.id !== Number(patientId)) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicineRequests(_, { patientId, offset, limit }, { res });
  },

  getAllMedicineRequests: async (_, __, { user, res }) => {
    // Patients cannot view all requests - this is staff only
    throwGraphQLError(res).message("Unauthorized").status(401).throw();
  },
};

const Mutation = {
  createMedicineRequest: async (_, { input }, { user, res }) => {
    console.log('[MEDICINE_REQUEST] 🔥 createMedicineRequest called by user:', user?.id);
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    const hasPending = await hasActiveRequest(user.id, res);
    if (hasPending) {
      throwGraphQLError(res).message("You already have a pending medicine request. Please wait for it to be processed.").status(400).throw();
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throwGraphQLError(res).message("At least one medicine item is required").status(400).throw();
    }

    const mergedItems = Array.from(
      input.items.reduce((acc, item) => {
        const batchId = item?.batchId ?? item?.medicineId;
        if (!item || !Number.isInteger(batchId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          throwGraphQLError(res).message("Each item must include a valid batchId and positive quantity").status(400).throw();
        }
        acc.set(batchId, (acc.get(batchId) || 0) + item.quantity);
        return acc;
      }, new Map()).entries()
    ).map(([batchId, quantity]) => ({ batchId, quantity }));

    await validateBatchesWithQuantity(mergedItems, res);
    /*
    // Combine duplicate batch entries before validation to avoid undercount checks.
    const mergedItems = Array.from(
      input.items.reduce((acc, item) => {
        if (!item || !Number.isInteger(item.batchId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          throwGraphQLError(res).message("Each item must include a valid batchId and positive quantity").status(400).throw();
        }
        acc.set(item.batchId, (acc.get(item.batchId) || 0) + item.quantity);
        return acc;
      }, new Map()).entries()
    ).map(([batchId, quantity]) => ({ batchId, quantity }));

    await validateBatchesWithQuantity(mergedItems, res);
    */

    const result = await Wrapper.Mutation._createMedicineRequest(_, { patientId: user.id, input }, { res });

    console.log('[MEDICINE_REQUEST] ✅ Request created, ID:', result.id);

    // Notify medical staff on ALL branches for testing (temporary)
    const BRANCHES = ['Casal', 'Arlegui', 'QuezonCity'];
    
    try {
      console.log('[MEDICINE_REQUEST] 🔍 Broadcasting to all branches for testing...');
      
      BRANCHES.forEach(location => {
        console.log(`[MEDICINE_REQUEST] Emitting to branch:${location}`);
        emitToRoom(`branch:${location}`, 'medicine:request:new', {
          requestId: result.id,
          patientId: user.id,
          location,
        });
      });
      
      console.log('[MEDICINE_REQUEST] ✅ Broadcast complete');
    } catch (notifErr) {
      console.error('[MEDICINE_REQUEST] ❌ Broadcast failed:', notifErr);
    }

    return result;
  },

  cancelMedicineRequest: async (_, __, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    // Fetch pending request directly to avoid false positives from non-pending latest requests.
    const pendingResult = await db.query(
      `SELECT id, status
       FROM "MedicineRequestLog"
       WHERE "patientId" = $1 AND status = 'Pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    if (pendingResult.rows.length === 0) {
      throwGraphQLError(res).message("Request not found").status(404).throw();
    }

    return await Wrapper.Mutation._setStatusMedicineRequest(
      _,
      { requestId: pendingResult.rows[0].id, status: 'Cancelled', approvedBy: null, notes: null },
      { res },
    );
  },

  setStatusMedicineRequest: async (_, __, { user, res }) => {
    // Patients cannot update medicine request status - this is staff only
    throwGraphQLError(res).message("Unauthorized").status(401).throw();
  },
};

module.exports = { Query, Mutation };