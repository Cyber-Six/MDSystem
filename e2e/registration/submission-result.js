'use strict';

function inspectBatchSubmission(status, body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const ticketStatus = body?.data?.submitTicket ?? null;
  const ok = status >= 200 && status < 300 && errors.length === 0 && ticketStatus === 'Pending';
  const details = [
    `HTTP ${status}`,
    `GraphQL errors: ${errors.length ? errors.map(error => error.message || JSON.stringify(error)).join(' | ') : 'none'}`,
    `submitTicket: ${ticketStatus ?? 'null/missing'}`,
  ].join('; ');
  return { ok, status, errors, ticketStatus, details };
}

module.exports = { inspectBatchSubmission };
