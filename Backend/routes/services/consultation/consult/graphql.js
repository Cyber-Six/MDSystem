// graphql.js

const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const fs = require("fs");
const path = require("path");

const medicalResolver = require("./resolvers/medical/medical-resolver.js");
const { jwtProtect } = require("../../../../config/middleware/jwtProtect.js");

const schemaPath = path.join(__dirname, "./schema.graphql");
const typeDefs = fs.readFileSync(schemaPath, "utf8");

const medicalSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: medicalResolver.Query,
    Mutation: medicalResolver.Mutation,
  },
});

function initMedicalConsultationGraphQL(app) {
  app.use(
    "/consultation",
    jwtProtect("medical"), // Protect all consultation routes with JWT middleware
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


module.exports = { initMedicalConsultationGraphQL };
