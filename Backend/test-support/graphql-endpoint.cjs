const path = require('path');
const backend = path.resolve(__dirname, '..');

// Exercise endpoint wiring with isolated boundary middleware. Resolver behavior
// belongs in each resolver's own counterpart; schemas remain real file inputs.
function endpointContract(directory, { resolvers, endpoints, userProfile = false }) {
  describe('GraphQL endpoint contract', () => {
    let module, schemas, jwtProtect, graphqlHTTP, credentialGuard, rateLimiter;
    beforeEach(() => {
      jest.resetModules();
      schemas = [];
      jwtProtect = jest.fn(role => ({ guard: role }));
      credentialGuard = { guard: 'active-credentials' };
      rateLimiter = jest.fn((name, role) => ({ limiter: name, role }));
      graphqlHTTP = jest.fn(options => ({ options }));
      jest.doMock('express-graphql', () => ({ graphqlHTTP }));
      jest.doMock('@graphql-tools/schema', () => ({ makeExecutableSchema: jest.fn(input => {
        const schema = { ...input, marker: schemas.length };
        schemas.push(schema);
        return schema;
      }) }));
      jest.doMock(path.join(backend, 'config/middleware/jwtProtect.js'), () => ({ jwtProtect }));
      jest.doMock(path.join(backend, 'config/middleware/activeCredential.js'), () => ({ checkCredentialsStatus: credentialGuard }));
      jest.doMock(path.join(backend, 'config/middleware/ratelimiter.js'), () => ({ ipRateLimiter: rateLimiter }));
      jest.doMock(path.join(backend, 'utils/logger.js'), () => require('./fixtures.cjs').loggerMock());
      for (const [relative, label] of Object.entries(resolvers)) {
        jest.doMock(path.join(directory, relative), () => ({ Query: { label }, Mutation: { label }, UserProfile: { label } }));
      }
      module = require(path.join(directory, 'graphql.js'));
    });
    test.each([false, true])('registers guarded routes and request context (production=%s)', production => {
      const restore = require('./fixtures.cjs').withEnvironment({ NODE_ENV: production ? 'production' : 'test' });
      try {
        const app = { use: jest.fn() };
        for (const init of new Set(endpoints.map(endpoint => endpoint.init))) module[init](app);
        expect(app.use).toHaveBeenCalledTimes(endpoints.length);
        for (const endpoint of endpoints) {
          const call = app.use.mock.calls.find(([route]) => route === endpoint.route);
          expect(call).toBeDefined();
          const guards = call.slice(1, -1);
          expect(guards).toEqual([
            ...(endpoint.limiter ? [{ limiter: endpoint.limiter[0], role: endpoint.limiter[1] }] : []),
            { guard: endpoint.role }, ...(endpoint.credentials ? [credentialGuard] : []),
          ]);
          const { options } = call.at(-1);
          const user = { id: '12', role: endpoint.role };
          const res = {};
          const settings = options({ body: { query: '{ __typename }' }, user, res });
          expect(settings.context).toEqual({ user, res });
          expect(settings.graphiql).toBe(endpoint.productionGraphiql ? !production : true);
          expect(settings.schema.typeDefs).toMatch(/type\s+Query/);
          expect(settings.schema.resolvers.Query).toEqual({ label: endpoint.resolver });
          expect(settings.schema.resolvers.Mutation).toEqual({ label: endpoint.resolver });
          if (userProfile) expect(settings.schema.resolvers.UserProfile).toEqual({ label: endpoint.resolver });
          expect(options({ body: { query: '{ __typename }' }, res }).context.user).toBe(endpoint.nullUser ? null : undefined);
          if (endpoint.rejectEmpty) {
            expect(() => options({})).toThrow('Empty GraphQL request');
            expect(() => options({ body: {} })).toThrow('Empty GraphQL request');
          }
        }
      } finally { restore(); }
    });
  });
}

module.exports = { endpointContract };
