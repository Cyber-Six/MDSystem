const { GraphQLError } = require('graphql');
const { validateIdentifier } = require('./identifier');

test.each([
  ['0', '0'],
  [0, '0'],
  ['700001', '700001'],
  ['000700001', '000700001'],
  [' 700001 ', '700001'],
  ['2147483647', '2147483647'],
  [2147483647, '2147483647'],
])('accepts integer identifier %p', (input, expected) => {
  const res = { status: jest.fn() };
  expect(validateIdentifier(input, res)).toBe(expected);
  expect(res.status).not.toHaveBeenCalled();
});

test.each([
  undefined, null, '', '   ', 'EMP-700001', '-1', '1.2', '1e3', '+1',
  '2147483648', 2147483648, '999999999999999999999',
  '1; DROP TABLE example', '１２３', '1\u0000', NaN, Infinity,
])('rejects invalid identifier %p with a safe client error', input => {
  const res = { status: jest.fn() };
  let error;
  try {
    validateIdentifier(input, res);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.message).toBe('Identifier must contain digits only and be between 0 and 2147483647.');
  expect(res.status).toHaveBeenCalledWith(400);
});
