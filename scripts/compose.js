#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[match[1]] = value;
  }
  return values;
}

function discoverLanAddress() {
  if (process.platform === 'linux') {
    const route = spawnSync('ip', ['-4', 'route', 'get', '1.1.1.1'], { encoding: 'utf8' });
    const routeAddress = route.stdout?.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)/)?.[1];
    if (route.status === 0 && routeAddress) return routeAddress;
  }
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (/^(lo|docker|br-|veth)/i.test(name)) continue;
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) candidates.unshift(address.address);
      else candidates.push(address.address);
    }
  }
  return candidates[0];
}

const projectDir = process.cwd();
const envFilePath = path.join(projectDir, '.env');
const fileEnv = readEnvFile(envFilePath);
const args = process.argv.slice(2);
const nodeEnv = process.env.NODE_ENV || fileEnv.NODE_ENV || 'production';
const env = { ...process.env, NODE_ENV: nodeEnv };

function value(name) {
  return process.env[name] ?? fileEnv[name] ?? '';
}

function fail(message) {
  console.error(`Docker setup validation failed: ${message}`);
  process.exit(1);
}

function validateEnv(required) {
  if (!fs.existsSync(envFilePath)) fail(`.env file not found at ${envFilePath}. Copy .env.example to .env and configure it.`);
  const missing = required.filter(name => !value(name).trim());
  if (missing.length) fail(`set required values in .env: ${missing.join(', ')}`);
}

function validateRuntimeEnv() {
  const required = [
    'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD',
    'JWT_SECRET', 'SMTP_USER', 'SMTP_PASS', 'TOTP_ENCRYPTION_KEY',
  ];
  if (nodeEnv !== 'test') required.push('CORS_ALLOWED_ORIGINS', 'SOCKET_CORS_ORIGIN');
  validateEnv(required);
  const totpKey = value('TOTP_ENCRYPTION_KEY').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(totpKey)) fail('TOTP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
}

function resolveSqlPath(name, configured) {
  const absolutePath = path.resolve(projectDir, configured);
  let isFile = false;
  try {
    isFile = fs.statSync(absolutePath).isFile();
  } catch {}
  if (!isFile) {
    fail(`${name} points to a missing SQL file: ${absolutePath}`);
  }
  return absolutePath;
}

const startsServices = args.some(arg => ['up', 'start', 'restart', 'run'].includes(arg));
const hasSetupProfile = args.some((arg, index) => arg === 'setup' && args[index - 1] === '--profile' || arg === '--profile=setup');
const command = args.find(arg => ['up', 'start', 'restart', 'run'].includes(arg));
const composeServices = new Set(['postgres', 'redis', 'schema-init', 'patient', 'staff', 'email-worker']);
const hasExplicitService = args.some(arg => composeServices.has(arg));
const initializesSchema = ['up', 'start', 'run'].includes(command)
  && (args.includes('schema-init') || (hasSetupProfile && command === 'up' && !hasExplicitService));
const appServices = new Set(['patient', 'staff', 'email-worker']);
const hasExplicitAppService = args.some(arg => appServices.has(arg));
if (startsServices && command !== 'run' && (hasExplicitAppService || !args.some(arg => ['postgres', 'redis', 'schema-init'].includes(arg)))) {
  validateRuntimeEnv();
}
if (initializesSchema) {
  validateEnv(['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'SCHEMA_SQL_PATH', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH']);
  resolveSqlPath('SCHEMA_SQL_PATH', value('SCHEMA_SQL_PATH').trim());
  resolveSqlPath('STARTUP_SQL_PATH', value('STARTUP_SQL_PATH').trim() || './startup.sql');
  resolveSqlPath('POST_BUILD_SETUP_SQL_PATH', './Backend/config/data/post_build_setup.sql');
}

if (nodeEnv === 'test') {
  env.PATIENT_BIND_ADDRESS = '0.0.0.0';
  env.STAFF_BIND_ADDRESS = '0.0.0.0';
  const lanAddress = process.env.TEST_LAN_IP || fileEnv.TEST_LAN_IP || discoverLanAddress();
  if (!lanAddress) {
    console.error('Could not detect a LAN IPv4 address. Set TEST_LAN_IP in .env and retry.');
    process.exit(1);
  }
  const patientPort = process.env.PATIENT_PORT || fileEnv.PATIENT_PORT || '3000';
  const staffPort = process.env.MEDICAL_PORT || fileEnv.MEDICAL_PORT || '3001';
  env.VITE_PATIENT_BACKEND_URL = process.env.TEST_VITE_PATIENT_BACKEND_URL || fileEnv.TEST_VITE_PATIENT_BACKEND_URL || `http://${lanAddress}:${patientPort}`;
  env.VITE_STAFF_BACKEND_URL = process.env.TEST_VITE_STAFF_BACKEND_URL || fileEnv.TEST_VITE_STAFF_BACKEND_URL || `http://${lanAddress}:${staffPort}`;
  console.log(`Test mode: binding published ports to all interfaces; frontend APIs use ${lanAddress}.`);
} else {
  env.PATIENT_BIND_ADDRESS ??= fileEnv.PATIENT_BIND_ADDRESS || '127.0.0.1';
  env.STAFF_BIND_ADDRESS ??= fileEnv.STAFF_BIND_ADDRESS || env.PATIENT_BIND_ADDRESS;
}

const result = spawnSync('docker', ['compose', ...args], {
  cwd: projectDir,
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run Docker Compose: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
