const { validatePersonalInput } = require('./personal-input');
const res = () => ({ status: jest.fn() });

test.each([
  { first_name: 'x'.repeat(51) },
  { suffix: 'x'.repeat(11) },
  { contactNumber: 'x'.repeat(16) },
  { present_address: 'x'.repeat(10001) },
  { last_name: 'Fixture\u0000' },
  { first_name: 123 },
  { date_of_birth: '2000-02-30' },
  { date_of_birth: 'not-a-date' },
  { date_of_birth: '2999-01-01' },
  { sex: 'invalid' },
  { civil_status: 'invalid' },
  { ['first_name" = NULL; --']: 'attack' },
  { status: 'Approved' },
])('rejects malformed personal input without exposing values (%#)', input => {
  const response = res();
  expect(() => validatePersonalInput(input, response)).toThrow('Invalid personal record field:');
  expect(response.status).toHaveBeenCalledWith(400);
});

test('preserves Unicode, apostrophes, and SQL-like text as parameter values', () => {
  const input = { first_name: "O'Fixture", last_name: 'Pe?a', present_address: "'; DROP TABLE example; --", date_of_birth: '2000-02-29', middle_name: '', suffix: null };
  expect(validatePersonalInput(input, res())).toBe(input);
});
