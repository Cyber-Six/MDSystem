// graphql.js - Health Chat Module

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { checkCredentialsStatus } = require("../../config/middleware/activeCredential.js");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./resolvers/patient/patient-resolver.js");
const medicalResolver = require("./resolvers/medical/medical-resolver.js");
const { jwtProtect } = require("../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

// Build schema with patient resolvers
const patientSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: patientResolver.Query,
    Mutation: patientResolver.Mutation,
  },
});

// Build schema with medical resolvers
const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
  },
});

/**
 * Initialize patient health chat GraphQL endpoint
 * Route: /healthchat/patient
 */
function initPatientHealthChatGraphQL(app) {
  app.use(
    "/healthchat/patient",
    jwtProtect("patient"),
    checkCredentialsStatus,
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

/**
 * Initialize medical health chat GraphQL endpoint
 * Route: /healthchat/medical
 */
function initMedicalHealthChatGraphQL(app) {
  app.use(
    "/healthchat/medical",
    jwtProtect("medical"),
    checkCredentialsStatus,
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: medicalSchema,
        graphiql: true,
        context: {
          user: req.user,
          res: req.res,
        },
      };
    })
  );
}

module.exports = {
  initPatientHealthChatGraphQL,
  initMedicalHealthChatGraphQL
};
