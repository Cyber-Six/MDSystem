/** @type {import('jest').Config} */
let preset = 'jest-expo';
try { require.resolve('jest-expo'); } catch (e) { preset = undefined; }

module.exports = {
  ...(preset ? { preset } : {}),
  displayName: 'mobile',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js', '<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^expo/src/winter(.*)$': '<rootDir>/__mocks__/expo-winter.js',
    '^@mdsystem/core(.*)$': '<rootDir>/../packages/core/src$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
};
