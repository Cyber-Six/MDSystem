const { convertIdentity } = require('../converter');

describe('convertIdentity', () => {
  test.each([
    ['student', 'patient'], ['EMPLOYEE', 'patient'], ['medical', 'medical'],
    ['unknown', null], [null, null],
  ])('maps %p to %p', (identity, expected) => {
    expect(convertIdentity(identity)).toBe(expected);
  });
});
