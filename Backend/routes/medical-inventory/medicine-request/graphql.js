const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./resolvers/patient/patient-resolver.js");
const medicalResolver = require("./resolvers/medical/medical-resolver.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");

const typeDefs = fs.readFileSync(path.join(__dirname, "./schema.graphql"), "utf8");

const patientSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: patientResolver.Query,
    Mutation: patientResolver.Mutation,
  },
});

const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
  },
});

function initPatientMedicineRequestGraphQL(app) {
  app.use(
    "/medical-inventory/medicine-request/patient",
    jwtProtect("patient"),
    graphqlHTTP((req) => ({
      schema: patientSchema,
      graphiql: true,
      context: { user: req.user, res: req.res },
    }))
  );
}

function initMedicalMedicineRequestGraphQL(app) {
  app.use(
    "/medical-inventory/medicine-request/medical",
    jwtProtect("medical"),
    graphqlHTTP((req) => ({
      schema: medicalSchema,
      graphiql: true,
      context: { user: req.user, res: req.res },
    }))
  );
}

module.exports = { initPatientMedicineRequestGraphQL, initMedicalMedicineRequestGraphQL };