// graphql.js

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./resolvers/patient/patient-resolver.js");
const medicalResolver = require("./resolvers/medical/medical-resolver.js");
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
    ...require('./retired-profile-notes.js'),
  },
});

const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
    UserProfile: medicalResolver.UserProfile, // <-- interface resolver
    ...require('./retired-profile-notes.js'),
  },
});

function initPatientEMRGraphQL(app) {
  app.use(
    "/emr/patient",
    jwtProtect("patient"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      req.res.setHeader("Cache-Control", "private, no-store");
      req.res.setHeader("Pragma", "no-cache");
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
          res: req.res,
        },
      };
    })
  );
}


module.exports = { initPatientEMRGraphQL, initMedicalEMRGraphQL };
