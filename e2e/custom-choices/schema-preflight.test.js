'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkInitialSchema } = require('./schema-preflight');
const { query } = require('./evidence');

function apiFixture(status, body) {
  const requests = [];
  const state = { url: 'https://qa.invalid', headers: { authorization: 'Bearer synthetic-test-token' }, network: [] };
  const page = { request: { post: async (url, options) => {
    requests.push({ url, ...options });
    return { ok: () => status >= 200 && status < 300, status: () => status, json: async () => body };
  } } };
  return { requests, state, read: document => query(page, state, '/emr/patient', document) };
}

test('HTTP 200 missing-column response blocks the real readback pipeline before mutation', async () => {
  const fixture = apiFixture(200, {
    data: { getMyProfile: null },
    errors: [{ message: 'column ep.employmentCategoryOther does not exist', path: ['getMyProfile'] }],
  });
  let submitted = false;
  await assert.rejects(async () => {
    await checkInitialSchema(fixture.read);
    submitted = true;
  }, /post_build_setup.sql/);
  assert.equal(submitted, false);
  assert.equal(fixture.requests.length, 1);
  assert.match(fixture.requests[0].data.query, /^query\s/);
  assert.doesNotMatch(fixture.requests[0].data.query, /mutation|submitTicket|createDomainCatalogs/);
  assert.equal(fixture.state.network[0].status, 200);
  assert.match(fixture.state.network[0].response.errors[0].message, /employmentCategoryOther/);
  assert.equal(JSON.stringify(fixture.state.network).includes('synthetic-test-token'), false);
});

test('successful schema read allows a fresh patient with no profile to continue', async () => {
  const fixture = apiFixture(200, { data: { getMyProfile: null } });
  await checkInitialSchema(fixture.read);
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.state.network[0].response, { data: { getMyProfile: null } });
});

test('HTTP authentication failure remains an authentication error rather than a migration instruction', async () => {
  const fixture = apiFixture(401, { errors: [{ message: 'Unauthorized' }] });
  await assert.rejects(checkInitialSchema(fixture.read), error => {
    assert.match(error.message, /HTTP 401/);
    assert.doesNotMatch(error.message, /post_build_setup.sql/);
    return true;
  });
});

test('allows a newly registered patient without an existing profile', async () => {
  await checkInitialSchema(async document => {
    assert.match(document, /getMyProfile/);
    return { getMyProfile: null };
  });
});

test('missing Employee column stops initial work before catalog or ticket writes', async () => {
  let writes = 0;
  await assert.rejects(async () => {
    await checkInitialSchema(async () => {
      throw new Error('GraphQL errors: column ep.employmentCategoryOther does not exist');
    });
    writes++;
  }, /post_build_setup.sql/);
  assert.equal(writes, 0);
});

test('does not disguise unrelated authentication or network failures as migration errors', async () => {
  const failure = new Error('HTTP 401 Unauthorized');
  await assert.rejects(checkInitialSchema(async () => { throw failure; }), error => error === failure);
});
