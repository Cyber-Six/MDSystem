/** @type {import('jest').Config} */
export default {
  displayName: 'staff',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^node:test$': '<rootDir>/__mocks__/node-test.cjs',
    '^node:assert/strict$': '<rootDir>/__mocks__/node-assert-strict.cjs',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.config.*',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
};
