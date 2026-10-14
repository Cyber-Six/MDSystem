'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fillUpdateProfileFields } = require('./update-profile-workflow');

function mockedPage() {
  const actions = [];
  const locator = (name) => ({
    fill: async value => actions.push(['fill', name, value]),
    selectOption: async value => actions.push(['select', name, value]),
    locator: () => ({ getByRole: role => ({ first: () => ({ click: async () => actions.push(['click', role]) }) }) }),
  });
  return {
    actions,
    getByPlaceholder: name => locator(name),
    getByLabel: name => locator(name),
  };
}

test('mocked Student update uses program and student category fields', async () => {
  const page = mockedPage();
  await fillUpdateProfileFields(page, 'Student', { programSearch: 'Computer Science' });
  assert.deepEqual(page.actions, [
    ['fill', 'Type to search for your program...', 'Computer Science'],
    ['click', 'button'],
    ['select', 'Student Category', 'Freshman'],
  ]);
});

test('mocked Employee update uses department, employment category, and position fields', async () => {
  const page = mockedPage();
  await fillUpdateProfileFields(page, 'Employee', { department: 'Facilities QA' });
  assert.deepEqual(page.actions, [
    ['fill', 'Department', 'Facilities QA'],
    ['select', 'Employment Category', 'Non-Teaching'],
    ['fill', 'Position', 'Consultant'],
  ]);
});
