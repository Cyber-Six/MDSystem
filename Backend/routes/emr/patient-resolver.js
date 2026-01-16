// resolvers/patient.js
const { GraphQLError } = require("graphql");

const Query = {
  getProfile: async (_, args, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHORIZED" },
      });
    }
    return { id: "1", name: "John Doe" }; // placeholder
  },
};

const Mutation = {
  createPatient: async (_, { input }, { db, user }) => {
    if (!user || user.role !== "staff") {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHORIZED" },
      });
    }
    return { id: "123", ...input }; // placeholder
  },
};

module.exports = { Query, Mutation };
