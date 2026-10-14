'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectBatchSubmission } = require('./submission-result');

test('includes HTTP 400 GraphQL failures in the submission result', () => {
  const result = inspectBatchSubmission(400, { errors: [{ message: 'Missing column' }], data: { submitTicket: null } });
  assert.equal(result.ok, false);
  assert.match(result.details, /HTTP 400/);
  assert.match(result.details, /Missing column/);
  assert.match(result.details, /submitTicket: null\/missing/);
});

test('fails on GraphQL errors even when the HTTP response succeeds', () => {
  const result = inspectBatchSubmission(200, { errors: [{ message: 'One section failed' }], data: { submitTicket: 'Pending' } });
  assert.equal(result.ok, false);
  assert.match(result.details, /One section failed/);
});

test('accepts a complete submission whose ticket is Pending', () => {
  const result = inspectBatchSubmission(200, { data: { submitTicket: 'Pending' } });
  assert.equal(result.ok, true);
  assert.equal(result.ticketStatus, 'Pending');
});
