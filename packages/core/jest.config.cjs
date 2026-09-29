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
};
