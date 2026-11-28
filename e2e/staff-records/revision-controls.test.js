'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { captureControls } = require('./manifest');
const { control } = require('./revision');

test('revision checks distinguish identically named dental controls', async () => {
  const inputs = [true, false].map(checked => ({
    tagName: 'INPUT', type: 'checkbox', name: '', value: 'on', checked,
    labels: [{ textContent: 'Dental Bridge' }],
    closest: () => null,
    getClientRects: () => [{}],
  }));
  const capturePage = {
    locator: () => ({ evaluateAll: evaluate => evaluate(inputs) }),
  };
  const { fields } = await captureControls(capturePage, 'dental');
  assert.deepEqual(fields.map(field => field.labelIndex), [0, 1]);

  // Model the two visible, identically named checkboxes returned by Playwright.
  const matches = {
    filter: () => matches,
    and: () => matches,
    nth: index => inputs[index],
  };
  const revisionPage = {
    getByRole: (role, options) => {
      assert.equal(role, 'checkbox');
      assert.equal(options.name, 'Dental Bridge');
      return matches;
    },
    locator: () => ({}),
  };
  assert.equal(control(revisionPage, fields[0]).checked, true);
  assert.equal(control(revisionPage, fields[1]).checked, false);
});
