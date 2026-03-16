const Wrapper = require("../wrapper/wrapper.js");
const { hasActiveRequest, validateBatchesWithQuantity } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const { emitToRoom } = require("../../../../../config/sockets");
const db = require("../../../../../config/query.js");
const logger = require("../../../../../utils/logger.js");

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return await Wrapper.Query._getAvailableMedicine(_, args, { res });
  },

  getMedicineStatus: async (_, __, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return await Wrapper.Query._getMedicineStatus(_, { patientId: user.id }, { res });
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

    const result = await Wrapper.Mutation._createMedicineRequest(_, { patientId: user.id, input }, { res });

    // Notify medical staff on the branch channel for the location of the first batch
    try {
      const batch = await db.query(
        `SELECT location FROM "MedicineBatch" WHERE id = $1 LIMIT 1`,
        [input.items[0].batchId],
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
      { requestId: pendingResult.rows[0].id, status: 'Cancelled', approvedBy: user.id, notes: null },
      { res },
    );
  },
};

module.exports = { Query, Mutation };