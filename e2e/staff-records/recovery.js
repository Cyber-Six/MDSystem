'use strict';
const { submittedRecord, incompleteReason } = require('./manifest');

// Legacy reports may contain original GraphQL inputs but lack credentials.
// Match them only after authenticating the saved account and verifying all
// three identities against patient reads: patient, ticket, and identifier.
function recoverInputManifest(account, report, identity) {
  if (report.status !== 'passed' || !account.ready || report.evidence?.role !== account.role) return null;
  const evidence = report.evidence;
  if (String(evidence.ticket?.id) !== String(identity.ticket?.id) || String(evidence.ticket?.patientId) !== String(identity.ticket?.patientId)
    || String(account.ticketId) !== String(identity.ticket?.id)) return null;
  const { record, labels } = submittedRecord(evidence.network);
  if (!record.personalInfo?.identifier || String(record.personalInfo.identifier) !== String(identity.personal?.identifier)) return null;
  if (record.personalInfo.first_name !== identity.personal?.first_name || record.personalInfo.last_name !== identity.personal?.last_name) return null;
  const manifest = { version: 1, verified: true, role: account.role, kind: evidence.mode, scope: evidence.ticket.scope,
    url: account.url, patientId: String(identity.ticket.patientId), ticketId: String(identity.ticket.id), record, labels,
    createdAt: report.recordedAt, controls: evidence.inputControls || [], review: evidence.inputReview || [], baseline: evidence.baselineSnapshot || null };
  return incompleteReason(manifest) ? null : manifest;
}
module.exports = { recoverInputManifest };
