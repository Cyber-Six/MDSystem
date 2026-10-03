const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const root = path.resolve(__dirname, '..');

async function runScenario(schemaExitCode) {
  const files = new Map();
  const calls = [];
  const sqlPath = path.join(root, 'fixture.sql');
  const configPath = path.join(root, 'fixture.env');
  files.set(configPath, ['E2E_SCHEMA_SQL', 'E2E_POST_BUILD_SQL', 'E2E_STARTUP_SQL']
    .map(key => `${key}=${sqlPath}`).join('\n'));
  files.set(sqlPath, 'SELECT 1;');
  const fakeFs = {
    existsSync: file => files.has(file),
    statSync: () => ({ isFile: () => true, size: 9 }),
    readFileSync: file => files.get(file),
    writeFileSync: (file, value) => files.set(file, value),
    mkdirSync: () => {}, chmodSync: () => {}, rmSync: () => {},
    mkdtempSync: prefix => `${prefix}fixture`,
  };
  const fakeProcess = {
    argv: ['node', 'e2e.js', 'core'], env: { E2E_CONFIG_PATH: configPath },
    on: () => {}, stdout: { write: () => {} }, stderr: { write: () => {} },
  };
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const source = fs.readFileSync(path.join(root, 'scripts/e2e.js'), 'utf8')
    .replace('main().catch', 'const mainPromise = main().catch');
  vm.runInNewContext(`${source}\nmainPromise.then(finish);`, {
    __dirname: path.join(root, 'scripts'), process: fakeProcess, finish,
    require: name => {
      if (name === 'node:fs') return fakeFs;
      if (name === '../Backend/node_modules/bcrypt') return { hash: async () => 'secret-hash' };
      if (name === './e2e-cleanup') return { cleanupProject: () => {} };
      if (name === 'node:child_process') return {
        spawn: (command, args) => {
          calls.push(args);
          const child = new EventEmitter();
          child.stdout = new EventEmitter();
          child.stderr = new EventEmitter();
          queueMicrotask(() => {
            const isLogs = args.includes('logs');
            if (isLogs) child.stdout.emit('data', 'schema-init | SQL ERROR secret-hash');
            child.emit('exit', args.includes('--exit-code-from') ? schemaExitCode : 0);
          });
          return child;
        },
      };
      return require(name);
    },
  }, { filename: 'e2e.js' });
  await done;
  return { calls, files, process: fakeProcess };
}

test('initializes once and starts later stages without restarting dependencies', async () => {
  const { calls, process } = await runScenario(0);
  expect(process.exitCode).toBeUndefined();
  const stages = calls.map(args => args.slice(args.indexOf('--env-file') + 4));
  expect(stages.slice(0, 5)).toEqual([
    ['up', '-d', '--wait', 'postgres', 'redis', 'smtp'],
    ['up', '--no-deps', '--exit-code-from', 'schema-init', 'schema-init'],
    ['run', '--rm', '--no-deps', 'seed'],
    ['up', '-d', '--wait', '--no-deps', 'patient', 'staff', 'email-worker'],
    ['run', '--rm', '--no-deps', 'test-runner', 'npx', 'playwright', 'test', '--project=core'],
  ]);
});

test('schema failure prevents seeding and preserves sanitized SQL diagnostics before cleanup', async () => {
  const { calls, files, process } = await runScenario(3);
  expect(process.exitCode).toBe(1);
  expect(calls.some(args => args.includes('seed'))).toBe(false);
  const logIndex = calls.findIndex(args => args.includes('logs'));
  expect(calls[logIndex]).toContain('schema-init');
  expect(calls.findIndex(args => args.includes('down'))).toBeGreaterThan(logIndex);
  const log = [...files].find(([file]) => file.endsWith('services.log'))[1];
  expect(log).toBe('schema-init | SQL ERROR [REDACTED]');
});
