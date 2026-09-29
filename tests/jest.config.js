/** @type {import('jest').Config} */
module.exports = {
  displayName: 'integration',
  rootDir: '.',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
  testMatch: [
    '<rootDir>/*.test.js',
    '<rootDir>/*.integration.test.js',
  ],
  coverageDirectory: 'coverage',
};
