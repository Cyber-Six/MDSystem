const { test } = require('node:test');
const assert = require('node:assert/strict');
const { finishUpdateEligibility } = require('./update-readiness');

test('Pending initial record produces an actionable skip, not an update failure', () => {
  let reason;
  finishUpdateEligibility('Student', ['Pending'], [], ['Pending'], value => { reason = value; });
  assert.match(reason, /manual staff approval/);
  assert.match(reason, /No update submitted/);
});

test('Pending candidate cannot hide authentication, schema, or other eligibility failures', () => {
  for (const failure of ['Invalid credentials', 'Missing schema column', 'Inactive account']) {
    assert.throws(() => finishUpdateEligibility('Employee', ['Pending'], [failure], [failure], () => {
      assert.fail('Real failures must not be skipped');
    }), /No eligible Employee/);
  }
});

test('missing or stale credentials without a valid Pending account remain failures', () => {
  assert.throws(() => finishUpdateEligibility('Student', [], [], ['Invalid credentials'], () => {
    assert.fail('No authenticated Pending account was found');
  }), /Invalid credentials/);
});

test('Playwright skip control flow propagates to the runner', () => {
  const skip = new Error('skip control flow');
  assert.throws(() => finishUpdateEligibility('Employee', ['Pending'], [], [], () => { throw skip; }), error => error === skip);
});
