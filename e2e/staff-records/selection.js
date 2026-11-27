'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { incompleteReason } = require('./manifest');
const normalize = url => new URL(url).href.replace(/\/+$/, '');
const defaultFile = path.resolve(__dirname, '../../.e2e-private/staff-record-assignments.json');

function loadCandidates(accounts, scenario, url) {
  const candidates = [], reasons = [];
  for (const account of [...accounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (account.role !== scenario.role || normalize(account.url) !== normalize(url) || account.authInvalid) continue;
    for (const entry of account.recordManifests || []) {
      if (entry.kind !== scenario.kind) continue;
      let manifest;
      try { manifest = JSON.parse(fs.readFileSync(entry.path, 'utf8')); }
      catch { reasons.push('saved input manifest is unavailable'); continue; }
      const reason = incompleteReason(manifest, scenario.action === 'revise');
      if (reason) { reasons.push(reason); continue; }
      if (manifest.role !== scenario.role || normalize(manifest.url) !== normalize(url) || String(manifest.ticketId) !== String(entry.ticketId)) throw new Error('QA manifest identity mismatch');
      if (scenario.kind === 'update' && !manifest.baseline) { reasons.push('approved update baseline is unavailable'); continue; }
      candidates.push({ account, manifest });
    }
  }
  return { candidates, reasons: [...new Set(reasons)] };
}

function reserve(scenario, account, manifest, file = defaultFile) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  let descriptor;
  try { descriptor = fs.openSync(lock, 'wx', 0o600); }
  catch { throw new Error('Another staff-record suite is reserving QA records; do not run these accounts concurrently.'); }
  try {
    const assignments = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    const key = `${normalize(account.url)}:${manifest.patientId}`;
    const existing = assignments.find(row => row.key === key);
    if (existing && existing.scenario !== scenario.id) return false;
    if (!existing) assignments.push({ key, scenario: scenario.id, ticketId: manifest.ticketId, reservedAt: new Date().toISOString() });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(assignments, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    return true;
  } finally { fs.closeSync(descriptor); fs.unlinkSync(lock); }
}

function assertTicket(expected, actual, allowedStatuses = ['Pending']) {
  if (!actual || String(actual.id) !== String(expected.ticketId) || String(actual.patientId) !== String(expected.patientId)
    || !allowedStatuses.includes(actual.status) || actual.scope !== expected.scope) {
    throw new Error('Selected QA ticket changed or is not actionable; no staff decision is permitted.');
  }
}

function acquireExecutionLease(file = path.resolve(__dirname, '../../.e2e-private/staff-records-running.lock')) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch { throw new Error('A staff-record run already holds the QA execution lease. Stop that run before reusing its accounts.'); }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return () => { fs.closeSync(fd); fs.unlinkSync(file); };
}
module.exports = { loadCandidates, reserve, assertTicket, acquireExecutionLease };
