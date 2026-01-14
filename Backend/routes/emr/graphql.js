// 

const { graphqlHTTP } = require("express-graphql");
const patientResolver = require("./patient-resolver.js"); // import your resolvers

const fs = require("fs");
const path = require("path");
const { buildSchema } = require("graphql");

const schemaPath = path.join(__dirname, "./schema.graphql");
const schemaSDL = fs.readFileSync(schemaPath, "utf8"); // Build GraphQL schema object const schema = buildSchema(schemaSDL);


function initEMRGraphQL(app) {
  app.use(
    "/emr",
    graphqlHTTP((req) => {
      // Guard: prevent empty requests from hanging
      if (!req.body || !req.body.query) {
        throw new Error("Empty GraphQL request");
      }

      return {
        schema: buildSchema(schemaSDL),
        rootValue: patientResolver,
        graphiql: true, // enable GraphiQL IDE for testing
        context: {
          user: req.user || null,
          db: req.db,
        },
      };
    })
  );
}

module.exports = initEMRGraphQL;
