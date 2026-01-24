// graphql.js

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./patient-resolver.js");
const medicalResolver = require("./medical-resolver.js");
const logger = require("../../utils/logger.js");
const { jwtProtect } = require("../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

// Build schema with resolvers (instead of buildSchema)
const patientSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: patientResolver.Query,
    Mutation: patientResolver.Mutation,
    UserProfile: patientResolver.UserProfile, // <-- interface resolver
  },
});

const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: medicalResolver,
});

function initPatientEMRGraphQL(app) {
  app.use(
    "/emr/patient",
    jwtProtect("patient"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: patientSchema,
        graphiql: true,
        context: {
          user: req.user, 
          res: req.res,
        },
      };
    })
  );
}

function initMedicalEMRGraphQL(app) {
  app.use(
    "/emr/medical",
    jwtProtect("medical"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: medicalSchema,
        graphiql: true,
        context: {
          user: req.user || null,
          db: req.db,
        },
      };
    })
  );
}

module.exports = { initPatientEMRGraphQL, initMedicalEMRGraphQL };
