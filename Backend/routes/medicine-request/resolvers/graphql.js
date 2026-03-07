const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./patient/patient-resolvers.js");
const medicalResolver = require("./medical/medical-resolvers.js");
const logger = require("../../../utils/logger.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

// Patient schema — only patient queries/mutations are resolved
const patientSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: patientResolver.Query,
    Mutation: patientResolver.Mutation,
  },
});

// Medical/Staff schema — only staff queries/mutations are resolved
const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
  },
});

function initPatientMedicineRequestGraphQL(app) {
  app.use(
    "/medicine-request/patient",
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
  logger.info("✅ Patient Medicine Request GraphQL registered at /medicine-request/patient");
}

function initMedicalMedicineRequestGraphQL(app) {
  app.use(
    "/medicine-request/medical",
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
  logger.info("✅ Medical Medicine Request GraphQL registered at /medicine-request/medical");
}

module.exports = { initPatientMedicineRequestGraphQL, initMedicalMedicineRequestGraphQL };
