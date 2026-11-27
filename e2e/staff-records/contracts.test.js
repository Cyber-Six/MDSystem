const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSchema, parse, validate } = require('../../Backend/node_modules/graphql');
const { fields, personalFields } = require('./api');
test('saved-read queries request schema-supported fields used by complete-value assertions', () => {
  const schema = buildSchema(fs.readFileSync(path.resolve('Backend/routes/emr/schema.graphql'), 'utf8'));
  const query = `query($userId: ID!) { ${Object.entries(fields).map(([alias, [name, selection]]) => `${alias}: getUser${name}(userId: $userId, limit: 1000) { ${selection} }`).join('\n')} }`;
  assert.deepEqual(validate(schema, parse(query)).map(error => error.message), []);
  for (const key of ['allergyProfile', 'hospitalizationProfile', 'operationProfile']) assert.match(fields[key][1], /notes/);
  const profileSchema = buildSchema(fs.readFileSync(path.resolve('Backend/routes/profile/schema.graphql'), 'utf8'));
  assert.deepEqual(validate(profileSchema, parse(`query($userId:ID!){getUserPersonalRecordLog(userId:$userId,limit:100){${personalFields}} getUserPersonalRecord(userId:$userId){${personalFields}}}`)).map(error => error.message), []);
});
