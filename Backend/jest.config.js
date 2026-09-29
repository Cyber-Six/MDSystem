/** @type {import('jest').Config} */
const { listSources, coverageThresholds } = require('./test-support/source-inventory.cjs');
module.exports = {
  displayName: 'backend',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
  testMatch: [
    '**/?(*.)+(test).[jt]s',          // <-- this line adds support for icddb.test.js, icdapi.test.js, etc.
    '**/__tests__/**/*.test.js',
    '**/*.integration.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  collectCoverageFrom: listSources(),
  coverageThreshold: coverageThresholds(),
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage',
};
