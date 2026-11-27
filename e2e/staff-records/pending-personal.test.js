'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { graphql, buildSchema } = require('../../Backend/node_modules/graphql');
const api = require('./api');
const { fixture, staffRecord } = require('./fixtures');
const { compareSaved } = require('./assertions');
const profileSchema = buildSchema(fs.readFileSync(path.resolve(__dirname, '../../Backend/routes/profile/schema.graphql'), 'utf8'));

function session(role, approved = false) {
  const manifest = fixture(role), record = staffRecord(manifest), requests = [];
  const personal = { id: manifest.ticketId, ...manifest.record.personalInfo };
  // Reproduce the deployed initial-account placeholder: approved fields are
  // null until staff approves, while the Pending log has the submitted names.
  const mainRecord = approved ? personal : { id: manifest.patientId, first_name: null };
  const rootValue = {
    getCredentialStatus: () => approved ? 'Active' : 'Unverified',
    getPersonalRecord: () => mainRecord,
    getUserPersonalRecord: () => mainRecord,
    getPersonalRecordLog: () => personal,
    getUserPersonalRecordLog: () => [personal],
  };
  const evidence = { network: [] };
  const client = { url: manifest.url, token: 'mock-private-token', evidence, page: { request: { post: async (url, options) => {
    requests.push(options.data.query);
    const body = url.endsWith('/profile/patient') || url.endsWith('/profile/medical')
      ? await graphql({ schema: profileSchema, source: options.data.query, variableValues: options.data.variables, rootValue })
      : { data: { basicInfo: { id: manifest.patientId, profile_type: role },
        ...Object.fromEntries(Object.keys(api.fields).map(key => [key, record[key] ? [record[key]] : []])) } };
    return { ok: () => true, status: () => 200, json: async () => body };
  } } } };
  return { client, manifest, requests, personal };
}

for (const role of ['Student', 'Employee']) {
  test(`${role}: initial eligibility reads Pending personal information without requiring approval`, async () => {
    const { client, requests, personal } = session(role);
    const result = await api.patientPersonal(client, { includeApproved: false });
    assert.equal(result.getCredentialStatus, 'Unverified');
    assert.equal(result.pending.first_name, personal.first_name);
    assert.equal(result.approved, undefined);
    assert.doesNotMatch(requests.join('\n'), /getPersonalRecord\s*\{/);
  });

  test(`${role}: initial staff snapshot compares all original values without reading an approved placeholder`, async () => {
    const { client, manifest, requests } = session(role);
    const saved = await api.snapshot(client, manifest.patientId, manifest.ticketId, { includeApproved: false });
    assert.doesNotThrow(() => compareSaved(manifest, saved, []));
    assert.doesNotMatch(requests.join('\n'), /getUserPersonalRecord\s*\(/);
    assert.ok(requests.some(query => query.includes('getUserPersonalRecordLog')));
  });

  test(`${role}: update and approved reads retain the full approved baseline checks`, async () => {
    const { client, manifest, requests, personal } = session(role, true);
    const patient = await api.patientPersonal(client);
    assert.equal(patient.approved.first_name, personal.first_name);
    const saved = await api.snapshot(client, manifest.patientId, manifest.ticketId);
    assert.equal(saved.personal.approved.first_name, personal.first_name);
    assert.ok(requests.some(query => /getUserPersonalRecord\s*\(/.test(query)));
    assert.doesNotThrow(() => compareSaved(manifest, saved, []));
  });
}

test('required approved reads still fail on GraphQL errors instead of suppressing them', async () => {
  const { client } = session('Student');
  await assert.rejects(api.patientPersonal(client), /Cannot return null for non-nullable field userProfile.first_name/);
});
