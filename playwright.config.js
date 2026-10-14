const { defineConfig } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Load local Playwright targets without adding a runtime dependency. Shell
// environment variables take precedence over values in .env.e2e.
const targetFile = path.join(__dirname, '.env.e2e');
if (fs.existsSync(targetFile)) {
  for (const line of fs.readFileSync(targetFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

const coreMode = process.env.E2E_CORE === '1';
const recordE2EVideo = process.env.E2E_VISUAL_RECORDING === '1';
const patientTarget = process.env.E2E_PATIENT_URL;
const staffTarget = process.env.E2E_STAFF_URL;
const localWebServers = [];

if (!coreMode && !patientTarget) {
  localWebServers.push({
    command: 'node node_modules/vite/bin/vite.js preview --outDir mds-patient/dist --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}
if (!coreMode && !staffTarget) {
  localWebServers.push({
    command: 'node node_modules/vite/bin/vite.js preview --outDir mds-staff/dist --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}

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
    { name: 'smoke', testMatch: ['login-smoke.spec.js', 'smoke/**/*.spec.js'] },
    {
      name: 'recorded',
      testMatch: 'recorded/**/*.spec.js',
      use: { trace: 'off', screenshot: 'off', video: recordE2EVideo ? 'on' : 'off' },
    },
    {
      name: 'registration',
      testMatch: 'registration/**/*.spec.js',
      workers: 1,
      retries: 0,
      use: { trace: 'off', screenshot: 'off', video: recordE2EVideo ? 'on' : 'off' },
    },
    {
      name: 'custom-choices',
      testMatch: 'custom-choices/*.spec.js',
      workers: 1,
      retries: 0,
      use: { trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block' },
    },
    {
      name: 'review',
      testMatch: 'review/**/*.spec.js',
      use: { trace: 'off', screenshot: 'off', video: recordE2EVideo ? 'on' : 'off' },
    },
  ],
  webServer: localWebServers.length ? localWebServers : undefined,
});
