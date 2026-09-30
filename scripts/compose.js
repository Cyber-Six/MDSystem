#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
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

const fileEnv = readEnvFile(path.resolve(process.cwd(), '.env'));
const nodeEnv = process.env.NODE_ENV || fileEnv.NODE_ENV || 'production';
const env = { ...process.env, NODE_ENV: nodeEnv };

if (nodeEnv === 'test') {
  env.PATIENT_BIND_ADDRESS = '0.0.0.0';
  env.STAFF_BIND_ADDRESS = '0.0.0.0';
} else {
  env.PATIENT_BIND_ADDRESS ??= fileEnv.PATIENT_BIND_ADDRESS || '127.0.0.1';
  env.STAFF_BIND_ADDRESS ??= fileEnv.STAFF_BIND_ADDRESS || env.PATIENT_BIND_ADDRESS;
}

const result = spawnSync('docker', ['compose', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run Docker Compose: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
