const Wrapper = require("../wrapper/wrapper.js");
const { validateBatchesWithQuantity } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const permit = require("../../../../../services/permit.js");
const logger = require("../../../../../utils/logger.js");

const Query = {
  getAvailableMedicine: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_prescribe);
    if (!isPermitted) {
      logger.warn("Unauthorized prescription view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getAvailableMedicine(_, args, { user, res });
  },

  getPatientPrescriptions: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.inventory_allow_prescribe, args.patientId);
    if (!isPermitted) {
      logger.warn("Unauthorized prescription view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getPatientPrescriptions(_, args, { user, res });
  },
};

const Mutation = {
  issuePrescription: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedPatientBased (user.id, permit.permissions.inventory_allow_prescribe, input.patientId);
    if (!isPermitted) {
      logger.warn("Unauthorized prescription issue attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

    return await Wrapper.Mutation._issuePrescription(_, { input, issuedBy: user.id }, { user, res });
  },
};

module.exports = { Query, Mutation };