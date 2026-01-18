// resolvers/patient.js
// solgay workon

const { GraphQLError } = require("graphql");
const query  = require("../../config/query.js");

const Query = {
  getProfile: async (_, args, req) => {
    console.log(args);
    if (!args.user) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHORIZED" },
      });
    }
    query.query()
    return { id: "1", name: "John Doe" }; // placeholder
  },
};

const Mutation = {
  createStudentProfile: async (_, { input }, { db, user }) => {
    console.log(input);
    if (!user || user.role !== "staff") {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHORIZED" },
      });
    }
    return { id: "123", ...input }; // placeholder
  },
};

module.exports = { Query, Mutation };
