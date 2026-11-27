'use strict';

function finishUpdateEligibility(role, pending, failures, blockers, skip) {
  if (pending.length && !failures.length) {
    skip(`${role} update awaits manual staff approval; initial ticket status is Pending. No update submitted.`);
    return;
  }
  throw new Error(`No eligible ${role} QA account. ${blockers.join(' | ')}`);
}

module.exports = { finishUpdateEligibility };
