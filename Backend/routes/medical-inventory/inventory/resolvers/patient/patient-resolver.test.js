test('exposes no inventory-management operations to patients', () => {
  expect(require('./patient-resolver')).toEqual({ Query: {}, Mutation: {} });
});
