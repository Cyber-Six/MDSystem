// This legacy entry point references optional Apollo packages. Virtual mocks
// isolate its startup contract without adding dependencies or opening a port.
jest.mock('@apollo/server', () => ({ ApolloServer: jest.fn() }), { virtual: true });
jest.mock('@apollo/server/express4', () => ({ expressMiddleware: jest.fn() }), { virtual: true });
jest.mock('./resolvers/wrapper/wrapper', () => ({ Query: { patients: jest.fn() } }));
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const initialize = require('./graphql');
test('starts Apollo before mounting middleware and forwards the caller token', async () => {
  const server = { start: jest.fn().mockResolvedValue() };
  ApolloServer.mockReturnValue(server);
  expressMiddleware.mockReturnValue('middleware');
  const app = { use: jest.fn() };
  await initialize(app);
  expect(ApolloServer).toHaveBeenCalledWith({ typeDefs: expect.stringMatching(/type\s+Query/), resolvers: require('./resolvers/wrapper/wrapper') });
  expect(server.start).toHaveBeenCalledTimes(1);
  expect(app.use).toHaveBeenCalledWith('/api/admin/patient-management', 'middleware');
  const options = expressMiddleware.mock.calls[0][1];
  await expect(options.context({ req: { headers: { token: 'signed' } } })).resolves.toEqual({ token: 'signed' });
});
test('propagates startup failure without mounting the endpoint', async () => {
  const app = { use: jest.fn() };
  ApolloServer.mockReturnValue({ start: jest.fn().mockRejectedValue(new Error('bad schema')) });
  await expect(initialize(app)).rejects.toThrow('bad schema');
  expect(app.use).not.toHaveBeenCalled();
});
