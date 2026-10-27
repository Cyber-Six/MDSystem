'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const directory = path.resolve(__dirname, '../../.e2e-private/lifecycle');
const scenarios = ['Student', 'Employee'].flatMap(role => ['initial', 'update'].flatMap(kind =>
  ['approve', 'reject', 'revise'].map(action => ({ id: `${role.toLowerCase()}-${kind}-${action}`, role, kind, action }))));

function filename(id, root = directory) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id || '')) throw new Error('Invalid lifecycle run ID');
  return path.join(root, `${id}.json`);
}
function write(run, root = directory) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = filename(run.id, root), temporary = `${file}.${randomUUID()}.tmp`;
  run.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(temporary, JSON.stringify(run, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function read(id, root = directory) {
  const run = JSON.parse(fs.readFileSync(filename(id, root), 'utf8'));
  if (run.version !== 1 || run.id !== id || !Array.isArray(run.scenarios)) throw new Error('Invalid lifecycle manifest');
  return run;
}
function targets(env = process.env) {
  return Object.fromEntries(['E2E_PATIENT_URL', 'E2E_STAFF_URL'].map(key => {
    const url = new URL(env[key]);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error(`Configure ${key} as a portal origin without credentials or path`);
    }
    return [key, url.origin];
  }));
}
function open(id, urls, resume, root = directory) {
  if (resume) {
    const run = read(id, root);
    if (JSON.stringify(run.targets) !== JSON.stringify(urls)) throw new Error('Lifecycle run belongs to different deployment URLs');
    return run;
  }
  if (fs.existsSync(filename(id, root))) throw new Error('Lifecycle run already exists; use --run-id to resume it');
  const run = { version: 1, id, targets: urls, createdAt: new Date().toISOString(), scenarios: scenarios.map(item => ({ ...item, stages: {} })) };
  write(run, root);
  return run;
}
module.exports = { directory, scenarios, filename, read, write, targets, open };
