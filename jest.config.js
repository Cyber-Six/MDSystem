const backendConfig = require('./Backend/jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/Backend/jest.config.js',
    '<rootDir>/packages/core/jest.config.cjs',
    '<rootDir>/mds-mobile/jest.config.js',
    '<rootDir>/mds-patient/jest.config.js',
    '<rootDir>/mds-staff/jest.config.js',
    '<rootDir>/tests/jest.config.js',
  ],
  // Keep the normal test command fast; `npm run test:coverage` enables this
  // collection and enforces the thresholds below.
  collectCoverage: false,
  // Jest matches these patterns relative to each project's root.
  collectCoverageFrom: [
    ...backendConfig.collectCoverageFrom,
    'src/**/*.{js,jsx,ts,tsx}',
    'App.tsx',
    'index.ts',
    '!src/scripts/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.d.ts',
    '!**/*.{test,spec}.{js,jsx,ts,tsx}',
    '!**/*.config.*',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: backendConfig.coverageThreshold.global,
    './Backend/routes/auth/': {
      branches: 90, functions: 90, lines: 90, statements: 90,
    },
    './packages/core/src/internal/api-url.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './packages/core/src/services/': {
      functions: 95, lines: 95, statements: 95,
    },
    './packages/core/src/services/console-request-logger.js': {
      branches: 100,
    },
    './packages/core/src/services/google-oauth-service.js': {
      branches: 90,
    },
    './packages/core/src/services/recaptcha-service.js': {
      branches: 90,
    },
    './packages/core/src/services/socket-service.js': {
      branches: 90,
    },
    './packages/core/src/validation/': {
      branches: 90, functions: 90, lines: 90, statements: 90,
    },
  },
  passWithNoTests: false,
};
