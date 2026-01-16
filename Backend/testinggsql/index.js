// graphql/index.js
const { graphqlHTTP } = require('express-graphql');
const schema = require('./schema');
const resolvers = require('./resolvers');

function registerGraphQLRoutes(app) {
  app.use('/graphql', (req, res, next) => {
    // Guard: prevent empty requests from hanging
    if (!req.body?.query && !req.query?.query) {
      return res.status(400).json({
        error: "MISSING_QUERY",
        message: "GraphQL query is required."
      });
    }
    next();
  });

  app.use('/graphql', graphqlHTTP({
    schema,
    rootValue: resolvers,
    graphiql: true, // enable GraphiQL playground
  }));
}

module.exports = registerGraphQLRoutes;
