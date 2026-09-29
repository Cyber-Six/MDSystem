test('the reserved constants module exposes no runtime API', () => {
  expect(require('./const')).toEqual({});
});
