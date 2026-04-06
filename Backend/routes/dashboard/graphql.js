// graphql.js - Dashboard GraphQL Entry Point

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const fs = require('fs');
const path = require('path');
const { ipRateLimiter } = require('../../config/middleware/ratelimiter.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const dashboardResolver = require('./resolvers/dashboard-resolver.js');

const schemaPath = path.join(__dirname, './schema.graphql');
const typeDefs = fs.readFileSync(schemaPath, 'utf8');

// Build schema with resolvers
const dashboardSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: dashboardResolver.Query,
  },
});

/**
 * Initialize the Dashboard GraphQL endpoint for medical staff
 * @param {Express.Application} app - Express application instance
 */
function initDashboardGraphQL(app) {
  app.use(
    '/dashboard',
    ipRateLimiter("genericLimiter", "staff"),
    jwtProtect('medical'),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error('Empty GraphQL request');
      }
      return {
        schema: dashboardSchema,
        graphiql: process.env.NODE_ENV !== 'production',
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );
}

module.exports = { initDashboardGraphQL };
