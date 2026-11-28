const { throwGraphQLError } = require('../../utils/graphql-helper');

function validateIdentifier(identifier, res) {
  const value = String(identifier ?? '').trim();
  if (!/^[0-9]+$/.test(value) || Number(value) > 2147483647) {
    throwGraphQLError(res).message('Identifier must contain digits only and be between 0 and 2147483647.').status(400).throw();
  }
  return value;
}

module.exports = { validateIdentifier };
