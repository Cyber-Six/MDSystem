// graphql.js - Staff EMR GraphQL endpoint

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const Query = require("./query.js");
const Mutation = require("./mutation.js");
const logger = require("../../../utils/logger.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

// Build schema with resolvers
const staffEMRSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query,
    Mutation,
  },
});

function initStaffEMRGraphQL(app) {
  app.use(
    "/staff/emr",
    jwtProtect("medical"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: staffEMRSchema,
        graphiql: true,
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );

  logger.info("Staff EMR GraphQL endpoint initialized at /staff/emr");
}

module.exports = { initStaffEMRGraphQL };
