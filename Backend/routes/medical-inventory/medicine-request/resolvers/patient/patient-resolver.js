const Wrapper = require("../wrapper/wrapper.js");
const { hasActiveRequest, validateBatchesWithQuantity } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { emitToRoom } = require("../../../../../config/sockets");
const db = require("../../../../../config/query.js");
const logger = require("../../../../../utils/logger.js");

// Ensure Wrapper is properly loaded
if (!Wrapper || !Wrapper.Query) {
  logger.error("ERROR: Wrapper or Wrapper.Query is undefined. Wrapper exports:", Object.keys(Wrapper || {}));
  throw new Error("MedicineRequest Wrapper module failed to load properly");
}

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      return await Wrapper.Query._getAvailableMedicine(_, args, { res });
    } catch (error) {
      logger.error("Error in getAvailableMedicine resolver:", error);
      throwGraphQLError(res).message("Failed to fetch available medicines").status(500).throw();
    }
  },

  getMedicineStatus: async (_, __, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    try {
      return await Wrapper.Query._getMedicineStatus(_, { patientId: user.id }, { res });
    } catch (error) {
      logger.error("Error in getMedicineStatus resolver:", error);
      throwGraphQLError(res).message("Failed to fetch medicine request status").status(500).throw();
    }
  },
};

const Mutation = {
  createMedicineRequest: async (_, { input }, { user, res }) => {
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

    try {
      const result = await Wrapper.Mutation._createMedicineRequest(_, { patientId: user.id, input }, { res });

      // Notify medical staff on the branch channel for the location of the first batch
      try {
        const batch = await db.query(
          `SELECT location FROM "MedicineBatch" WHERE id = $1 LIMIT 1`,
          [input.items[0].batchId ?? input.items[0].medicineId],
        );
        if (batch.rows.length > 0) {
          const { location } = batch.rows[0];
          emitToRoom(`branch:${location}`, 'medicine:request:new', {
            requestId: result.id,
            patientId: user.id,
            location,
          });
        }
      } catch (notifErr) {
        logger.error("Failed to emit new medicine request to branch channel:", notifErr);
      }

      return result;
    } catch (error) {
      logger.error("Error in createMedicineRequest resolver:", error);
      throwGraphQLError(res).message("Failed to create medicine request").status(500).throw();
    }
  },

  cancelMedicineRequest: async (_, __, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    try {
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
    } catch (error) {
      logger.error("Error in cancelMedicineRequest resolver:", error);
      throwGraphQLError(res).message("Failed to cancel medicine request").status(500).throw();
    }
  },

  setStatusMedicineRequest: async (_, { requestId, status, notes }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    try {
      // Verify the request belongs to the patient
      const requestResult = await db.query(
        `SELECT "patientId", status FROM "MedicineRequestLog" WHERE id = $1 LIMIT 1`,
        [requestId],
      );

      if (requestResult.rows.length === 0) {
        throwGraphQLError(res).message("Request not found").status(404).throw();
      }

      if (requestResult.rows[0].patientId !== user.id) {
        throwGraphQLError(res).message("Unauthorized: You can only cancel your own requests").status(403).throw();
      }

      // Patients can only cancel pending requests
      if (requestResult.rows[0].status !== 'Pending' && status !== 'Cancelled') {
        throwGraphQLError(res).message("Patients can only cancel pending requests").status(400).throw();
      }

      return await Wrapper.Mutation._setStatusMedicineRequest(
        _,
        { requestId, status, approvedBy: user.id, notes },
        { res },
      );
    } catch (error) {
      logger.error("Error in setStatusMedicineRequest resolver:", error);
      throwGraphQLError(res).message("Failed to update medicine request status").status(500).throw();
    }
  },

  addMedicineToRequest: async (_, { requestId, items }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    // This mutation is only available to medical staff, not patients
    throwGraphQLError(res)
      .message("This operation is only available to medical staff")
      .status(403)
      .throw();
  },
};

module.exports = { Query, Mutation };