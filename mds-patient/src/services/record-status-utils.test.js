import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getUnverifiedWaitingScreen,
  isInactiveRevisionNeeded,
  isInactiveUpdateSubmitted,
  normalizeCredentialStatus,
  shouldRequireInitialRecordFromTicketStatus,
  shouldRestrictInactiveFlow,
} from './record-status-utils.js';

const TICKET_STATUSES = [
  'InProgress',
  'Pending',
  'Revision',
  'RevisionSubmitted',
  'Cancelled',
  'Expired',
  'Approved',
  'Rejected',
  null,
  undefined,
  'UnexpectedStatus',
];

const CREDENTIAL_STATUSES = [
  'Active',
  'Inactive',
  'Unverified',
  'Locked',
  'Disabled',
  null,
  undefined,
  '',
];

test('shouldRequireInitialRecordFromTicketStatus handles all status permutations', () => {
  for (const status of TICKET_STATUSES) {
    const expected = !(status === 'Pending' || status === 'Approved' || status === 'RevisionSubmitted');
    const actual = shouldRequireInitialRecordFromTicketStatus(status);
    assert.equal(
      actual,
      expected,
      `status=${String(status)} expected=${expected} actual=${actual}`
    );
  }
});

test('getUnverifiedWaitingScreen handles all ticket-status permutations', () => {
  const verificationStates = [true, false, null, undefined];

  for (const status of TICKET_STATUSES) {
    for (const isVerified of verificationStates) {
      const actual = getUnverifiedWaitingScreen({ recordStatus: status, isVerified });

      let expected = 'none';
      if (isVerified === false && status === 'RevisionSubmitted') {
        expected = 'revision-submitted';
      } else if (isVerified === false && status === 'Pending') {
        expected = 'pending-approval';
      }

      assert.equal(
        actual,
        expected,
        `recordStatus=${String(status)} isVerified=${String(isVerified)}`
      );
    }
  }
});

test('shouldRestrictInactiveFlow covers credential x status x lock permutations', () => {
  for (const credentialStatus of CREDENTIAL_STATUSES) {
    const normalized = normalizeCredentialStatus(credentialStatus);

    for (const recordStatus of TICKET_STATUSES) {
      const isWorkflowStatus = (
        recordStatus === 'Pending'
        || recordStatus === 'Revision'
        || recordStatus === 'RevisionSubmitted'
      );

      for (const inactiveLockPersisted of [false, true]) {
        const expected = normalized === 'inactive'
          || (
            inactiveLockPersisted
            && (normalized !== 'active' || isWorkflowStatus)
          );

        const actual = shouldRestrictInactiveFlow({
          credentialStatus,
          inactiveLockPersisted,
          recordStatus,
        });

        assert.equal(
          actual,
          expected,
          `credentialStatus=${String(credentialStatus)} recordStatus=${String(recordStatus)} lock=${String(inactiveLockPersisted)}`
        );
      }
    }
  }
});

test('inactive state helpers map submitted and revision statuses correctly', () => {
  for (const status of TICKET_STATUSES) {
    assert.equal(
      isInactiveUpdateSubmitted(status),
      status === 'Pending' || status === 'RevisionSubmitted',
      `submitted-status mismatch for ${String(status)}`
    );

    assert.equal(
      isInactiveRevisionNeeded(status),
      status === 'Revision',
      `revision-status mismatch for ${String(status)}`
    );
  }
});
