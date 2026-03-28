const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const medicalResolver = require("./resolvers/medical/medical-resolver.js");
const patientResolver = require("./resolvers/patient/patient-resolver.js");
const { jwtProtect } = require("../../../config/middleware/jwtProtect.js");

const typeDefs = fs.readFileSync(path.join(__dirname, "./schema.graphql"), "utf8");

const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
  },
});

const patientSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: patientResolver.Query,
    Mutation: patientResolver.Mutation,
  },
});

function initPrescriptionGraphQL(app) {
  app.use(
    "/medical-inventory/prescription/medical",
    jwtProtect("medical"),
    graphqlHTTP((req) => ({
      schema: medicalSchema,
      graphiql: true,
      context: { user: req.user, res: req.res },
    }))
  );

  app.use(
    "/medical-inventory/prescription/patient",
    jwtProtect("patient"),
    graphqlHTTP((req) => ({
      schema: patientSchema,
      graphiql: true,
      context: { user: req.user, res: req.res },
    }))
  );
}

module.exports = { initPrescriptionGraphQL };