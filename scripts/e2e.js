#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const bcrypt = require('../Backend/node_modules/bcrypt');

const root = path.resolve(__dirname, '..');
const composeFile = path.join(root, 'e2e', 'compose.yaml');
let activeChild;
let receivedSignal;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    receivedSignal = signal;
    activeChild?.kill(signal);
  });
}
const suite = process.argv[2] || 'core';
if (!['core', 'full'].includes(suite)) {
  process.stderr.write('Usage: node scripts/e2e.js <core|full>\n');
  process.exit(2);
}

function readEnvFile(file) {
  const values = {};
  for (const [index, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`Invalid setting at ${file}:${index + 1}`);
    let value = match[2].trim();
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
    else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    activeChild = child;
    child.once('error', reject);
    child.once('exit', code => {
      activeChild = undefined;
      code === 0 ? resolve() : reject(new Error(`${command} ${args[0]} exited with code ${code}`));
    });
  });
}

function composeArgs(project, envFiles, args) {
  return ['compose', '-p', project, '-f', composeFile,
    ...envFiles.flatMap(file => ['--env-file', file]), ...args];
}

function dotenvValue(value) {
  if (/[\r\n']/.test(value)) throw new Error('Generated environment value contains unsupported characters.');
  return `'${value}'`;
}

function redact(text, secrets) {
  let result = text.replace(/\b\d{6}\b/g, '[OTP REDACTED]');
  for (const secret of secrets.filter(Boolean)) result = result.split(secret).join('[REDACTED]');
  return result;
}

async function main() {
  const configPath = path.resolve(process.env.E2E_CONFIG_PATH || path.join(root, 'e2e.private.env'));
  if (!fs.existsSync(configPath)) throw new Error(`E2E config missing: ${configPath}. Copy e2e/config.example.env to this Pi-local file and set SQL paths.`);
  const config = readEnvFile(configPath);
  const sqlKeys = ['E2E_SCHEMA_SQL', 'E2E_POST_BUILD_SQL', 'E2E_STARTUP_SQL'];
  for (const key of sqlKeys) {
    const file = config[key];
    if (!file || !path.isAbsolute(file) || !fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
      throw new Error(`${key} must be an absolute path to a non-empty SQL file: ${file || '(unset)'}`);
    }
  }

  const runId = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  const project = `mdse2e-${runId}`;
  const artifactDir = path.join(root, 'e2e-results', runId);
  fs.mkdirSync(path.join(artifactDir, 'test-results'), { recursive: true });
  fs.mkdirSync(path.join(artifactDir, 'playwright-report'), { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdsystem-e2e-'));
  try { fs.chmodSync(tmpDir, 0o700); } catch { /* Windows ACLs apply instead. */ }
  const generatedEnv = path.join(tmpDir, 'run.env');
  const password = crypto.randomBytes(24).toString('base64url');
  const adminPassword = password;
  const adminEmail = `e2e.admin${runId.replace(/-/g, '')}@tip.edu.ph`;
  const patientEmail = `mtest${Date.now().toString().slice(-8)}@tip.edu.ph`;
  const altPatientEmail = `qtest${crypto.randomBytes(4).readUInt32BE(0)}@tip.edu.ph`;
  const staffEmail = `e2e.staff${runId.replace(/-/g, '')}@tip.edu.ph`;
  const restrictedEmail = `e2e.limited${runId.replace(/-/g, '')}@tip.edu.ph`;
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const generated = {
    E2E_POSTGRES_USER: 'e2e',
    E2E_POSTGRES_PASSWORD: crypto.randomBytes(24).toString('base64url'),
    E2E_REDIS_PASSWORD: crypto.randomBytes(24).toString('base64url'),
    E2E_JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    E2E_TOTP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    E2E_ACCOUNT_PASSWORD: password,
    E2E_ADMIN_PASSWORD: adminPassword,
    E2E_ADMIN_PASSWORD_HASH: adminHash,
    E2E_ADMIN_EMAIL: adminEmail,
    E2E_PATIENT_EMAIL: patientEmail,
    E2E_ALT_PATIENT_EMAIL: altPatientEmail,
    E2E_STAFF_EMAIL: staffEmail,
    E2E_RESTRICTED_STAFF_EMAIL: restrictedEmail,
    E2E_ARTIFACT_DIR: artifactDir,
    E2E_RUN_ID: runId,
    E2E_RUN_PROJECT: project,
    E2E_VISUAL_RECORDING: process.env.E2E_VISUAL_RECORDING === '1' ? '1' : '0',
    E2E_APP_IMAGE: `mdsystem:e2e-${runId}`,
    E2E_RUNNER_IMAGE: `mdsystem:e2e-runner-${runId}`,
  };
  fs.writeFileSync(generatedEnv, Object.entries(generated).map(([key, value]) => `${key}=${dotenvValue(String(value))}`).join('\n'), { mode: 0o600 });

  const envFiles = [configPath, generatedEnv];
  const compose = args => run('docker', composeArgs(project, envFiles, args));
  const stateDir = process.env.E2E_STATE_DIR || path.join(path.dirname(configPath), 'e2e-state');
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const stateFile = path.join(stateDir, `${runId}.project`);
  fs.writeFileSync(stateFile, project, { mode: 0o600 });
  const sqlChecksums = Object.fromEntries(sqlKeys.map(key => [key, crypto.createHash('sha256').update(fs.readFileSync(config[key])).digest('hex')]));
  const metadata = { runId, project, suite, startedAt: new Date().toISOString(), sqlChecksums, status: 'running' };
  fs.writeFileSync(path.join(artifactDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  let passed = false;
  try {
    process.stdout.write(`Starting disposable Playwright ${suite} stack (${project}).\n`);
    await compose(['up', '-d', '--wait', 'postgres', 'redis', 'smtp']);
    await compose(['run', '--rm', 'schema-init']);
    await compose(['run', '--rm', 'seed']);
    await compose(['up', '-d', '--wait', 'patient', 'staff', 'email-worker']);
    await compose(['run', '--rm', 'test-runner', 'npx', 'playwright', 'test', `--project=${suite}`]);
    passed = true;
  } catch (error) {
    process.stderr.write(`${receivedSignal ? `Interrupted by ${receivedSignal}. ` : ''}${error.message}\n`);
    try {
      const result = await new Promise(resolve => {
        const child = spawn('docker', composeArgs(project, envFiles, ['logs', '--no-color', '--tail=250', 'patient', 'staff', 'email-worker', 'postgres', 'redis', 'smtp']), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', data => output += data);
        child.stderr.on('data', data => output += data);
        child.on('exit', () => resolve(output));
        child.on('error', () => resolve(output));
      });
      fs.writeFileSync(path.join(artifactDir, 'services.log'), redact(result, [password, adminPassword, adminHash, generated.E2E_POSTGRES_PASSWORD, generated.E2E_REDIS_PASSWORD, generated.E2E_JWT_SECRET]));
    } catch { /* Preserve the original test failure. */ }
  } finally {
    metadata.finishedAt = new Date().toISOString();
    metadata.status = passed ? 'passed' : 'failed';
    fs.writeFileSync(path.join(artifactDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    try { await compose(['down', '--volumes', '--remove-orphans']); }
    catch (cleanupError) {
      try { require('./e2e-cleanup').cleanupProject(project); }
      catch (fallbackError) {
        metadata.cleanupError = `${cleanupError.message}; targeted cleanup failed: ${fallbackError.message}`;
        fs.writeFileSync(path.join(artifactDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
        fs.rmSync(tmpDir, { recursive: true, force: true });
        throw fallbackError;
      }
    }
    try { require('./e2e-cleanup').cleanupProject(project); }
    catch (cleanupError) {
      metadata.cleanupError = cleanupError.message;
      fs.writeFileSync(path.join(artifactDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw cleanupError;
    }
    fs.rmSync(stateFile, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  if (!passed) throw new Error(`Playwright ${suite} suite failed. Sanitized run artifacts: ${artifactDir}`);
  process.stdout.write(`Disposable stack removed. Sanitized artifacts: ${artifactDir}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
