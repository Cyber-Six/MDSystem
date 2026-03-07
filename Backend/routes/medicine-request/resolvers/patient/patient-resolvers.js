const Wrapper = require("../wrapper/wrapper.js");
const { assertRequestOwnership } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");

const Query = {
  /**
   * Patient: Get own medicine requests (paginated).
   */
  getMyMedicineRequests: async (_, { offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const requests = await Wrapper._getPatientRequests(user.id, {
      offset: offset || 0,
      limit: limit || 20,
    });

    return requests;
  },

  /**
   * Patient: Get a single own medicine request with item details.
   */
  getMyMedicineRequest: async (_, { requestId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    // Verify ownership first
    await assertRequestOwnership(requestId, user.id, res);

    const request = await Wrapper._getRequestById(requestId);
    if (!request) {
      throwGraphQLError(res)
        .status(404)
        .message("Medicine request not found.")
        .throw();
    }

    return request;
  },

  /**
   * Patient: Browse available medicine items.
   */
  getAvailableMedicines: async (_, { offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    return await Wrapper._getMedicineItems({
      offset: offset || 0,
      limit: limit || 50,
    });
  },

  /**
   * Patient: Get available batches for a specific medicine item.
   */
  getAvailableBatches: async (_, { medicalItemId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    return await Wrapper._getAvailableBatches(medicalItemId);
  },
};

const Mutation = {
  /**
   * Patient: Create a new medicine request.
   * POST: Request/Prescription with note for symptoms.
   */
  createMedicineRequest: async (_, { input }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    if (!input.items || input.items.length === 0) {
      throwGraphQLError(res)
        .status(400)
        .message("At least one medicine item is required.")
        .throw();
    }

    if (!input.purpose || input.purpose.trim().length === 0) {
      throwGraphQLError(res)
        .status(400)
        .message("Purpose/symptoms description is required.")
        .throw();
    }

    const request = await Wrapper._createMedicineRequest(
      user.id,
      { purpose: input.purpose, items: input.items },
      res
    );

    logger.info(`Patient ${user.id} created medicine request ${request.id}`);
    return request;
  },

  /**
   * Patient: Cancel own pending medicine request.
   */
  cancelMedicineRequest: async (_, { requestId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    // Verify ownership
    await assertRequestOwnership(requestId, user.id, res);

    const request = await Wrapper._cancelMedicineRequest(requestId, res);
    logger.info(`Patient ${user.id} cancelled medicine request ${requestId}`);
    return request;
  },
};

module.exports = { Query, Mutation };
