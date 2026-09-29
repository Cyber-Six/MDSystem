const { missingCounterparts, counterpartPaths, listSources } = require('./source-inventory.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('inventory excludes test infrastructure and generated/dependency trees', () => {
  const sources = listSources();
  expect(sources).not.toContain('jest.config.js');
  expect(sources).not.toContain('test-patient-management.js');
  expect(sources.some(source => source.includes('test-support/'))).toBe(false);
  expect(sources.some(source => source.includes('node_modules/'))).toBe(false);
});

test('inventory discovers nested sources and detects a newly added source until its counterpart exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-inventory-'));
  try {
    fs.mkdirSync(path.join(root, 'config', 'sockets'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'dependency'), { recursive: true });
    fs.writeFileSync(path.join(root, 'config', 'sockets', 'notify.js'), 'module.exports = true;');
    fs.writeFileSync(path.join(root, 'node_modules', 'dependency', 'vendor.js'), '');
    expect(listSources(root)).toEqual(['config/sockets/notify.js']);
    expect(missingCounterparts(root)).toEqual(['config/sockets/notify.js']);
    expect(counterpartPaths('config/sockets/notify.js')).toEqual([
      'config/sockets/notify.test.js', 'config/sockets/__tests__/notify.test.js'
    ]);
    fs.writeFileSync(path.join(root, 'config', 'sockets', 'notify.test.js'), '');
    expect(missingCounterparts(root)).toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every backend application source has its own Jest counterpart', () => {
  const missing = missingCounterparts();
  if (missing.length) {
    throw new Error(`Missing ${missing.length} backend test counterparts:\n${missing.map(source => `${source} -> ${counterpartPaths(source)[0]}`).join('\n')}`);
  }
});
