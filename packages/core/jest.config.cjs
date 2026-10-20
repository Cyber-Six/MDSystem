/** @type {import('jest').Config} */
module.exports = {
  displayName: 'core',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  // Project regression gates, not an OWASP conformance score.
  coverageThreshold: {
    './src/internal/api-url.js': {
      branches: 100, functions: 100, lines: 100, statements: 100,
    },
    './src/services/': {
      branches: 85, functions: 95, lines: 95, statements: 95,
    },
  },
};
