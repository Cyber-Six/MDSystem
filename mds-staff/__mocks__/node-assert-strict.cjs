/**
 * Shim for node:assert/strict — re-exports Node's assert module in strict mode.
 * Required because mds-staff test files import from 'node:assert/strict'.
 */
const assert = require('assert');

module.exports = assert.strict;
