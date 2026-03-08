const Wrapper = require("../wrapper/wrapper.js");
const { hasActiveRequest, validateBatchAvailable } = require("../wrapper/helper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

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

    for (const item of input.items) {
      await validateBatchAvailable(item.batchId, res);
    }

    return await Wrapper.Mutation._createMedicineRequest(_, { patientId: user.id, input }, { res });
  },
};

module.exports = { Query, Mutation };