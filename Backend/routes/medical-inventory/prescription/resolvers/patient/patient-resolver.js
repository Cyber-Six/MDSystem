const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");

const Query = {
  getMyPrescriptions: async (_, { offset, limit }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    return await Wrapper.Query._getPatientPrescriptions(_, { patientId: user.id, offset, limit }, { res });
  },
};

const Mutation = {};
module.exports = { Query, Mutation };