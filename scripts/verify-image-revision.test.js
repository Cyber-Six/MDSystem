'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyImageRevisions } = require('./verify-image-revision');

test('accepts patient and staff containers running the expected revision', () => {
  assert.equal(verifyImageRevisions('abc123', [{ name: 'patient', id: 'patient-id' }, { name: 'staff', id: 'staff-id' }], () => 'abc123'), true);
});

test('rejects an older or unlabelled running image', () => {
  const containers = [{ name: 'patient', id: 'patient-id' }, { name: 'staff', id: 'staff-id' }];
  assert.throws(() => verifyImageRevisions('abc123', containers, id => id === 'patient-id' ? 'old456' : 'abc123'), /patient runs image revision old456/);
  assert.throws(() => verifyImageRevisions('abc123', containers, () => ''), /patient runs image revision unknown/);
});
