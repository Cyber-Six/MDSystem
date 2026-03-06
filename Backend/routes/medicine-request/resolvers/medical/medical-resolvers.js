const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const logger = require("../../../../utils/logger.js");
const permit = require("../../../../services/permit.js");

const Query = {
  /**
   * Staff: Get all medicine requests (filterable by status, paginated).
   * GET: Receive Medicine Requests.
   */
  getMedicineRequests: async (_, { status, offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_view
    );
    if (!isPermitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${user.id} to getMedicineRequests`
      );
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    return await Wrapper._getAllRequests({
      status: status || null,
      offset: offset || 0,
      limit: limit || 20,
    });
  },

  /**
   * Staff: Get a single medicine request with full details.
   * GET: View request details.
   */
  getMedicineRequest: async (_, { requestId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_view
    );
    if (!isPermitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${user.id} to getMedicineRequest`
      );
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

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
   * Staff: Browse all active medicine items.
   */
  getMedicineItems: async (_, { offset, limit }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_view
    );
    if (!isPermitted) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    return await Wrapper._getMedicineItems({
      offset: offset || 0,
      limit: limit || 50,
    });
  },

  /**
   * Staff: Get available batches for a specific medicine item.
   */
  getMedicineBatches: async (_, { medicalItemId }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_view
    );
    if (!isPermitted) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    return await Wrapper._getAvailableBatches(medicalItemId);
  },
};

const Mutation = {
  /**
   * Staff: Update request data (PATCH) — reassign batches/quantities before approval.
   * PATCH: Validate and modify request details.
   */
  updateMedicineRequestData: async (_, { input }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_manage
    );
    if (!isPermitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${user.id} to updateMedicineRequestData`
      );
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    if (!input.items || input.items.length === 0) {
      throwGraphQLError(res)
        .status(400)
        .message("At least one medicine item is required.")
        .throw();
    }

    const request = await Wrapper._updateMedicineRequestData(
      input.requestId,
      input.items,
      res
    );

    logger.info(
      `Staff ${user.id} updated request data for request ${input.requestId}`
    );

    return request;
  },

  /**
   * Staff: Approve a medicine request (POST).
   * Issues medicine, creates transaction, updates inventory.
   */
  approveMedicineRequest: async (_, { input }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_manage
    );
    if (!isPermitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${user.id} to approveMedicineRequest`
      );
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const request = await Wrapper._approveMedicineRequest(
      input.requestId,
      user.id,
      input.notes || null,
      res
    );

    return request;
  },

  /**
   * Staff: Reject a medicine request (POST).
   * Records rejection reason.
   */
  rejectMedicineRequest: async (_, { requestId, reason }, { user, res }) => {
    if (!user?.id) {
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const isPermitted = await permit.isMedicalPermitted(
      user.id,
      permit.permissions.medicine_request_allow_manage
    );
    if (!isPermitted) {
      logger.warn(
        `Unauthorized access attempt by staff ${user.id} to rejectMedicineRequest`
      );
      throwGraphQLError(res).status(401).message("Unauthorized").throw();
    }

    const request = await Wrapper._rejectMedicineRequest(
      requestId,
      user.id,
      reason || null,
      res
    );

    return request;
  },
};

module.exports = { Query, Mutation };
