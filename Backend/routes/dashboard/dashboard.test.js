jest.mock('./graphql', () => ({ initDashboardGraphQL: jest.fn(), initPatientDashboardGraphQL: jest.fn() }));
test('preserves the dashboard GraphQL entry-point API', () => {
  expect(require('./dashboard')).toBe(require('./graphql'));
});
