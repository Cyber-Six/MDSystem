const Wrapper = require("../wrapper/wrapper.js");
const { validateBatchAvailable } = require("../wrapper/helper.js");
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
    return await Wrapper.Query._getAvailableMedicine(_, args, { res });
  },

  getPatientPrescriptions: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_prescribe, args.patientId);
    if (!isPermitted) {
      logger.warn("Unauthorized prescription view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getPatientPrescriptions(_, args, { res });
  },
};

const Mutation = {
  issuePrescription: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_prescribe, input.patientId);
    if (!isPermitted) {
      logger.warn("Unauthorized prescription issue attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    for (const item of input.items) {
      await validateBatchAvailable(item.batchId, res);
    }

    return await Wrapper.Mutation._issuePrescription(_, { input, issuedBy: user.id }, { res });
  },
};

module.exports = { Query, Mutation };