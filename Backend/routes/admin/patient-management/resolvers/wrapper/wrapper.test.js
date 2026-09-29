jest.mock('../admin/admin-resolver', () => ({ Query: { patients: jest.fn() }, Mutation: { update: jest.fn() }, Patient: { profile: jest.fn() } }));
test('maps the admin resolver groups without exposing additional operations', () => {
  expect(require('./wrapper')).toEqual(require('../admin/admin-resolver'));
});
