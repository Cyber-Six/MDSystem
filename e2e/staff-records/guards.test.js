const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installGuard } = require('./workflow');
const { fixture } = require('./fixtures');
function session(latest, state) {
  const handlers = [];
  return { url: 'https://qa.invalid', token: 'private-token', evidence: state, handlers, page: {
    route: async (_, handler) => handlers.push(handler),
    request: { post: async () => ({ ok: () => true, status: () => 200, json: async () => ({ data: { ticket: latest } }) }) },
  } };
}
function route(query, variables) {
  const result = { continued: false, aborted: false };
  return { result, request: () => ({ postDataJSON: () => ({ query, variables }) }), continue: async () => { result.continued = true; }, abort: async () => { result.aborted = true; } };
}
test('mutation guard blocks premature decisions, another patient, and a newer ticket', async () => {
  const manifest = fixture(), state = { network: [], guardErrors: [], actionableStatuses: ['Pending'], permitStaffWrites: false };
  const latest = { id: manifest.ticketId, patientId: manifest.patientId, status: 'Pending', scope: 'Both' };
  const staff = session(latest, state), patient = session(latest, state);
  await installGuard(staff, patient, manifest, state);
  for (const [permitted, userId, ticketId, allowed] of [[false, '7001', '9001', false], [true, 'other', '9001', false], [true, '7001', 'new-ticket', false], [true, '7001', '9001', true]]) {
    state.permitStaffWrites = permitted; latest.id = ticketId;
    const request = route('mutation { staffUpdateTicket }', { userId });
    await staff.handlers[0](request);
    assert.equal(request.result.continued, allowed); assert.equal(request.result.aborted, !allowed);
  }
  const patientRequest = route('mutation { createUpdateTicket }', {});
  state.permitPatientWrites = true;
  await patient.handlers[0](patientRequest);
  assert.equal(patientRequest.result.aborted, true);
});
