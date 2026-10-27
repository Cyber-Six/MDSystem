'use strict';
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { acquireExecutionLease } = require('../e2e/staff-records/selection');

function parse(args) {
  let runId;
  const forwarded = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' || args[i].startsWith('--run-id=')) {
      if (runId) throw new Error('Supply --run-id once');
      runId = args[i] === '--run-id' ? args[++i] : args[i].slice(9);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(runId || '')) throw new Error('Supply a valid --run-id');
    } else {
      if (['--grep', '--grep-invert', '-g'].includes(args[i])) {
        const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error('Supply a value for the test filter');
        forwarded.push(args[i - 1], value);
        continue;
      }
      if (!['--headed', '--list'].includes(args[i]) && !/^--grep(?:-invert)?=.+/.test(args[i])) {
        throw new Error('Lifecycle concurrency, artifacts, projects, retries, and reporter are fixed; use --headed, --grep, or --list');
      }
      forwarded.push(args[i]);
    }
  }
  return { runId, forwarded };
}
function main(args = process.argv.slice(2)) {
  const { runId, forwarded } = parse(args);
  const id = runId || `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const listing = forwarded.includes('--list');
  let release;
  try {
    if (!listing) release = acquireExecutionLease();
    console.log(`Lifecycle run ID: ${id}${runId ? ' (resume)' : ''}`);
    const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--project=lifecycle', '--workers=1', '--retries=0',
      '--reporter=list,./e2e/lifecycle/reporter.js', ...forwarded], {
      cwd: require('node:path').resolve(__dirname, '..'), stdio: 'inherit',
      env: { ...process.env, E2E_LIFECYCLE_RUN_ID: id, E2E_LIFECYCLE_RESUME: runId ? '1' : '0', E2E_LIFECYCLE_LEASE: listing ? '' : '1' },
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally { release?.(); }
}
if (require.main === module) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { parse, main };
