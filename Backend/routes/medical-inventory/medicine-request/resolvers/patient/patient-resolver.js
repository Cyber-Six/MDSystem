const Wrapper = require("../wrapper/wrapper.js");
const { hasActiveRequest, validateBatchesAvailable } = require("../wrapper/helper.js");
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

    await validateBatchesAvailable(input.items.map(i => i.batchId), res);

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

  setStatusMedicineRequest: async (_, { requestId, status, notes }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    // Patients can only cancel their own requests
    if (status !== 'Cancelled') {
      throwGraphQLError(res).message("Patients can only cancel requests").status(400).throw();
    }

    // Verify request belongs to this patient
    const request = await Wrapper.Query._getMedicineRequestById(_, { requestId }, { res });
    if (!request) {
      throwGraphQLError(res).message("Request not found").status(404).throw();
    }
    if (request.patientId !== user.id) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Mutation._setStatusMedicineRequest(_, { requestId, status: 'Cancelled', approvedBy: user.id, notes }, { res });
  },
};

module.exports = { Query, Mutation };