const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { readFileSync } = require('fs');
const path = require('path');
const resolvers = require('./resolvers/wrapper/wrapper');

const typeDefs = readFileSync(
    path.join(__dirname, 'schema.graphql'),
    'utf-8'
);

const createPatientManagementServer = async (app) => {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
    });

    await server.start();

    app.use(
        '/api/admin/patient-management',
        expressMiddleware(server, {
            context: async ({ req }) => ({ token: req.headers.token }),
        })
    );
};

module.exports = createPatientManagementServer;