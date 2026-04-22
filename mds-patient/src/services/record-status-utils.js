export const COMPLETED_INITIAL_RECORD_FALLBACK_STATUSES = new Set([
  'Pending',
  'Approved',
  'RevisionSubmitted',
]);

export const INACTIVE_WORKFLOW_STATUSES = new Set([
  'Pending',
  'Revision',
  'RevisionSubmitted',
]);

export const INACTIVE_SUBMITTED_STATUSES = new Set([
  'Pending',
  'RevisionSubmitted',
]);

export const normalizeCredentialStatus = (status) => (
  typeof status === 'string' ? status.trim().toLowerCase() : null
);

export const shouldRequireInitialRecordFromTicketStatus = (ticketStatus) => (
  !COMPLETED_INITIAL_RECORD_FALLBACK_STATUSES.has(ticketStatus)
);

export const isInactiveWorkflowStatus = (ticketStatus) => (
  INACTIVE_WORKFLOW_STATUSES.has(ticketStatus)
);

export const shouldRestrictInactiveFlow = ({ credentialStatus, inactiveLockPersisted, recordStatus }) => {
  const normalizedCredentialStatus = normalizeCredentialStatus(credentialStatus);
  const keepInactiveLock = inactiveLockPersisted
    && (normalizedCredentialStatus !== 'active' || isInactiveWorkflowStatus(recordStatus));

  return normalizedCredentialStatus === 'inactive' || keepInactiveLock;
};

export const isInactiveUpdateSubmitted = (recordStatus) => (
  INACTIVE_SUBMITTED_STATUSES.has(recordStatus)
);

export const isInactiveRevisionNeeded = (recordStatus) => recordStatus === 'Revision';

export const getUnverifiedWaitingScreen = ({ recordStatus, isVerified }) => {
  if (isVerified !== false) return 'none';
  if (recordStatus === 'RevisionSubmitted') return 'revision-submitted';
  if (recordStatus === 'Pending') return 'pending-approval';
  return 'none';
};
