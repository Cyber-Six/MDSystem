'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sections } = require('./workflow');

test('saved-value assertions request nested notes from the matching records', () => {
  assert.match(sections.allergies, /allergies\s*\{[^}]*\bnotes\b/s);
  assert.match(sections.hospitalization, /hospitalizations\s*\{[^}]*\bnotes\b/s);
  assert.match(sections.operation, /operations\s*\{[^}]*\bnotes\b/s);
});

test('pending section readback remains scoped to the pending ticket', () => {
  for (const query of Object.values(sections)) assert.match(query, /pending:\s*true/);
});
