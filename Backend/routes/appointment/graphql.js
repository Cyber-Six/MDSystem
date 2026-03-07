// graphql.js

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const patientResolver = require("./resolvers/patient/patient-resolver.js");
const medicalResolver = require("./resolvers/medical/medical-resolver.js");
const { jwtProtect } = require("../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

// Build schema with resolvers (instead of buildSchema)
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

function initPatientAppointmentGraphQL(app) {
  app.use(
    "/appointment/patient",
    jwtProtect("patient"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: patientSchema,
        graphiql: process.env.NODE_ENV !== 'production',
        context: {
          user: req.user, 
          res: req.res,
        },
      };
    })
  );
}


function initMedicalAppointmentGraphQL(app) {
  app.use(
    "/appointment/medical",
    jwtProtect("medical"),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }
      return {
        schema: medicalSchema,
        graphiql: process.env.NODE_ENV !== 'production',
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );
}


module.exports = { initPatientAppointmentGraphQL, initMedicalAppointmentGraphQL };
