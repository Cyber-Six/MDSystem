const { defineConfig } = require('@playwright/test');

const coreMode = process.env.E2E_CORE === '1';
const recordE2EVideo = process.env.E2E_VISUAL_RECORDING === '1';

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: !coreMode,
  workers: coreMode ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: coreMode ? 0 : process.env.CI ? 1 : 0,
  reporter: coreMode
    ? [['html', { outputFolder: 'e2e-results/playwright-report', open: 'never' }], ['list']]
    : process.env.CI ? 'github' : 'list',
  outputDir: coreMode ? 'e2e-results/test-results' : 'test-results',
  use: {
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'smoke', testMatch: 'login-smoke.spec.js' },
    {
      name: 'core',
      testMatch: 'core/**/*.spec.js',
      use: { trace: 'off', screenshot: 'off', video: recordE2EVideo ? 'on' : 'off' },
    },
    {
      name: 'full',
      testMatch: ['core/**/*.spec.js', 'flows/**/*.spec.js'],
      use: { trace: 'off', screenshot: 'off', video: recordE2EVideo ? 'on' : 'off' },
    },
  ],
  webServer: coreMode ? undefined : [
    {
      command: 'node node_modules/vite/bin/vite.js preview --outDir mds-patient/dist --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js preview --outDir mds-staff/dist --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
