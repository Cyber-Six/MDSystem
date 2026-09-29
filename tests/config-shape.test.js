/**
 * Config-shape verification tests.
 * Loads each jest.config file via require() and asserts structural invariants
 * without running the Jest runner itself.
 */
const path = require('path');
const root = path.resolve(__dirname, '..');

describe('Root jest.config.js', () => {
  const rootConfig = require(path.join(root, 'jest.config.js'));

  test('exports a projects array with at least 4 entries', () => {
    expect(Array.isArray(rootConfig.projects)).toBe(true);
    expect(rootConfig.projects.length).toBeGreaterThanOrEqual(4);
  });

  test('coverageDirectory ends with /coverage', () => {
    expect(rootConfig.coverageDirectory).toMatch(/\/coverage$/);
  });

  test('coverageReporters is [text, lcov]', () => {
    expect(rootConfig.coverageReporters).toEqual(['text', 'lcov']);
  });
});

describe('Backend jest.config.js', () => {
  const config = require(path.join(root, 'Backend', 'jest.config.js'));

  test('displayName is backend', () => expect(config.displayName).toBe('backend'));
  test('testEnvironment is node', () => expect(config.testEnvironment).toBe('node'));
  test('coverageDirectory is relative coverage', () => expect(config.coverageDirectory).toBe('coverage'));
});

describe('mds-mobile jest.config.js', () => {
  const config = require(path.join(root, 'mds-mobile', 'jest.config.js'));

  test('preset is jest-expo when jest-expo is installed, or undefined', () => {
    // preset is conditionally set based on whether jest-expo is resolvable
    expect([undefined, 'jest-expo']).toContain(config.preset);
  });
  test('displayName is mobile', () => expect(config.displayName).toBe('mobile'));
  test('coverageDirectory is relative coverage', () => expect(config.coverageDirectory).toBe('coverage'));
});

describe('mds-patient jest.config.cjs', () => {
  const config = require(path.join(root, 'mds-patient', 'jest.config.cjs'));

  test('displayName is patient', () => expect(config.displayName).toBe('patient'));
  test('testEnvironment is node', () => expect(config.testEnvironment).toBe('node'));
  test('moduleNameMapper has node:test shim', () => {
    expect(config.moduleNameMapper).toHaveProperty('^node:test$');
  });
  test('moduleNameMapper has node:assert/strict shim', () => {
    expect(config.moduleNameMapper).toHaveProperty('^node:assert/strict$');
  });
  test('coverageDirectory is relative coverage', () => expect(config.coverageDirectory).toBe('coverage'));
});

describe('mds-staff jest.config.cjs', () => {
  const config = require(path.join(root, 'mds-staff', 'jest.config.cjs'));

  test('displayName is staff', () => expect(config.displayName).toBe('staff'));
  test('testEnvironment is node', () => expect(config.testEnvironment).toBe('node'));
  test('moduleNameMapper has node:test shim', () => {
    expect(config.moduleNameMapper).toHaveProperty('^node:test$');
  });
  test('moduleNameMapper has node:assert/strict shim', () => {
    expect(config.moduleNameMapper).toHaveProperty('^node:assert/strict$');
  });
  test('coverageDirectory is relative coverage', () => expect(config.coverageDirectory).toBe('coverage'));
});

describe('tests/jest.config.js (integration)', () => {
  const config = require(path.join(root, 'tests', 'jest.config.js'));

  test('displayName is integration', () => expect(config.displayName).toBe('integration'));
});

describe('package.json scripts', () => {
  test('root package.json has test script starting with "jest"', () => {
    const pkg = require(path.join(root, 'package.json'));
    expect(pkg.scripts.test).toMatch(/^jest/);
  });

  test('mds-mobile/package.json has no "jest" key', () => {
    const pkg = require(path.join(root, 'mds-mobile', 'package.json'));
    expect(pkg.jest).toBeUndefined();
  });

  test('mds-patient/package.json has jest in devDependencies', () => {
    const pkg = require(path.join(root, 'mds-patient', 'package.json'));
    expect(pkg.devDependencies).toHaveProperty('jest');
    expect(pkg.devDependencies).toHaveProperty('babel-jest');
    expect(pkg.devDependencies).toHaveProperty('@babel/core');
    expect(pkg.devDependencies).toHaveProperty('@babel/preset-env');
    expect(pkg.scripts.test).toBe('jest');
  });

  test('mds-staff/package.json has jest in devDependencies', () => {
    const pkg = require(path.join(root, 'mds-staff', 'package.json'));
    expect(pkg.devDependencies).toHaveProperty('jest');
    expect(pkg.devDependencies).toHaveProperty('babel-jest');
    expect(pkg.devDependencies).toHaveProperty('@babel/core');
    expect(pkg.devDependencies).toHaveProperty('@babel/preset-env');
    expect(pkg.scripts.test).toBe('jest');
  });
});