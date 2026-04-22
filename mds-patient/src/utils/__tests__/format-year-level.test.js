import test from 'node:test';
import assert from 'node:assert/strict';
import { formatYearLevel } from '../format-year-level.js';

test('formatYearLevel returns null for empty values', () => {
  assert.equal(formatYearLevel(null), null);
  assert.equal(formatYearLevel(undefined), null);
  assert.equal(formatYearLevel(''), null);
});

test('formatYearLevel maps all STUDENT_YEAR enum values', () => {
  const cases = [
    ['Grade11',   'Grade 11'],
    ['Grade12',   'Grade 12'],
    ['Freshman',  'Freshman'],
    ['Sophomore', 'Sophomore'],
    ['Junior',    'Junior'],
    ['Senior',    'Senior'],
    ['Masteral',  'Masters'],
    ['Doctorate', 'Doctorate'],
    ['Transferee','Transferee'],
    ['Returnee',  'Returnee'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(formatYearLevel(input), expected, `Expected formatYearLevel('${input}') === '${expected}'`);
  }
});

test('formatYearLevel passes through unknown values unchanged', () => {
  assert.equal(formatYearLevel('UnknownLevel'), 'UnknownLevel');
});
