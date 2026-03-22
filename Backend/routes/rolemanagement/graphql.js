// graphql.js - Role Management GraphQL Entry Point

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const fs = require('fs');
const path = require('path');

const adminResolver = require('./resolvers/admin/admin-resolver.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');

const schemaPath = path.join(__dirname, './schema.graphql');
const typeDefs = fs.readFileSync(schemaPath, 'utf8');

// Build schema with resolvers
const adminSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: adminResolver.Query,
    Mutation: adminResolver.Mutation,
  },
});

/**
 * Initialize the Role Management GraphQL endpoint for medical staff (admin only)
 * @param {Express.Application} app - Express application instance
 */
function initRoleManagementGraphQL(app) {
  app.use(
    '/rolemanagement/admin',
    jwtProtect('medical'),
    graphqlHTTP((req) => {
      if (!req.body || !req.body.query) {
        throw new Error('Empty GraphQL request');
      }
      return {
        schema: adminSchema,
        graphiql: true,
        context: {
          user: req.user || null,
          res: req.res,
        },
      };
    })
  );
}

module.exports = { initRoleManagementGraphQL };
