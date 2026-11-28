const { throwGraphQLError } = require('../../utils/graphql-helper');

const limits = {
  first_name: 50, middle_name: 50, last_name: 50, suffix: 10,
  nationality: 50, religion: 50, contactNumber: 15,
  present_address: 10000, province_address: 10000,
};
const enums = {
  sex: ['Male', 'Female'],
  civil_status: ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'],
};

// Validate supplied fields for both full submissions and partial revisions.
// SQL values remain parameterized; text is preserved for names and addresses.
function validatePersonalInput(input, res) {
  const fail = field => throwGraphQLError(res).message('Invalid personal record field: ' + field).status(400).throw();
  for (const [field, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Object.hasOwn(limits, field)) {
      if (typeof value !== 'string' || [...value].length > limits[field] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(field);
    } else if (Object.hasOwn(enums, field)) {
      if (!enums[field].includes(value)) fail(field);
    } else if (field === 'date_of_birth') {
      const date = value instanceof Date ? value : new Date(value);
      const text = value instanceof Date ? (Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)) : value;
      if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text || date.getTime() > Date.now()) fail(field);
    } else if (!['identifier', 'branch'].includes(field)) {
      fail(field);
    }
  }
  return input;
}
module.exports = { validatePersonalInput };
