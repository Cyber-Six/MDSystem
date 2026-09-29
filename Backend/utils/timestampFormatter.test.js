test('the reserved timestamp module exposes no runtime API', () => {
  expect(require('./timestampFormatter')).toEqual({});
});
