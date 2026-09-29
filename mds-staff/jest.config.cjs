/** @type {import('jest').Config} */
module.exports = {
  displayName: 'staff',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Pre-existing empty placeholder files — no tests written yet
    'src/modules/analytics/__tests__/',
  ],
  moduleNameMapper: {
    '^node:test$': '<rootDir>/__mocks__/node-test.cjs',
    '^node:assert/strict$': '<rootDir>/__mocks__/node-assert-strict.cjs',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.config.*',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
};