#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const configPath = path.resolve(process.env.E2E_CONFIG_PATH || path.join(__dirname, '..', 'e2e.private.env'));
const stateDir = process.env.E2E_STATE_DIR || path.join(path.dirname(configPath), 'e2e-state');
const projectNamePattern = /^mdse2e-\d{13}-[a-f0-9]{10}$/;

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(result.stderr || `docker ${args[0]} failed`);
  return (result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
}

function removeLabelResources(project, listArgs, removeArgs, label = 'com.docker.compose.project') {
  const resources = docker([...listArgs, '--filter', `label=${label}=${project}`]);
  for (const resource of resources) docker([...removeArgs, resource]);
}

function cleanupProject(project) {
  if (!projectNamePattern.test(project)) throw new Error('Refusing cleanup: invalid disposable Compose project name.');
  removeLabelResources(project, ['ps', '-aq'], ['rm', '-f']);
  removeLabelResources(project, ['volume', 'ls', '-q'], ['volume', 'rm', '-f']);
  removeLabelResources(project, ['network', 'ls', '-q'], ['network', 'rm']);
  removeLabelResources(project, ['image', 'ls', '-q'], ['image', 'rm', '-f'], 'com.mdsystem.e2e.project');
  process.stdout.write(`Removed only Compose resources labeled for ${project}.\n`);
}

function main() {
  if (process.argv[2] !== '--registered') {
    process.stderr.write('Usage: node scripts/e2e-cleanup.js --registered\n');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(stateDir)) return;
  const files = fs.readdirSync(stateDir).filter(file => /^\d{13}-[a-f0-9]{10}\.project$/.test(file));
  for (const file of files) {
    const stateFile = path.join(stateDir, file);
    cleanupProject(fs.readFileSync(stateFile, 'utf8').trim());
    fs.rmSync(stateFile, { force: true });
  }
  if (files.length === 0) process.stdout.write('No interrupted disposable E2E projects are registered.\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { cleanupProject };
