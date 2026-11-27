const path = require('path');

/** @type {import('jest').Config} */
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
  collectCoverageFrom: [
    '{config,routes,services,utils}/**/*.js',
    'server.js',
    'staff.js',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.{test,spec}.js',
  ],
  coverageThreshold: {
    global: {
      statements: 29, branches: 20, functions: 21, lines: 30,
    },
    [path.join(__dirname, 'routes', 'auth') + path.sep]: {
      branches: 90, functions: 90, lines: 90, statements: 90,
    },
  },
  coverageDirectory: 'coverage',
};
