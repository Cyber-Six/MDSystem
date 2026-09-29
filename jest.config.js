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
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx,cjs,mjs}',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.d.ts',
    '!**/coverage/**',
    '!**/build/**',
    '!**/dist/**',
    '!**/*.config.{js,cjs,mjs}',
    '!**/test-*.js',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    ...require('./Backend/test-support/source-inventory.cjs').coverageThresholds(),
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  passWithNoTests: false,
};
