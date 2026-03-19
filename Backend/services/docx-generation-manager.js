/**
 * Lifecycle manager for the MDS Document Service (Python/FastAPI).
 *
 * Provides helper functions to auto-start, health-check, and stop the
 * Python document service from the Node.js backend using child_process.
 *
 * Usage (in staff.js or server.js):
 *   const docService = require('./services/docx-generation-manager');
 *
 *   // Start on server boot (non-blocking, waits for health check)
 *   await docService.start();
 *
 *   // Graceful shutdown
 *   process.on('SIGTERM', () => docService.stop());
 */

const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SERVICE_DIR = path.resolve(__dirname, 'docx-generation');
const VENV_PYTHON = path.join(SERVICE_DIR, 'venv', 'bin', 'python');
const ENTRY_POINT = path.join(SERVICE_DIR, 'main.py');
const PORT = process.env.DOCX_GENERATED_PORT || 3002;
const HOST = process.env.DOCX_SERVICE_HOST || '127.0.0.1';
const HEALTH_URL = `http://${HOST}:${PORT}/health`;

const HEALTH_RETRIES = 15;      // max attempts
const HEALTH_INTERVAL_MS = 1000; // ms between retries

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let childProcess = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the /health endpoint to respond 200.
 * Resolves when healthy, rejects after max retries.
 */
async function waitForHealthy() {
  for (let i = 1; i <= HEALTH_RETRIES; i++) {
    try {
      const res = await axios.get(HEALTH_URL, { timeout: 2000 });
      if (res.status === 200) {
        return true;
      }
    } catch {
      // service not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  throw new Error(`Document Service did not become healthy after ${HEALTH_RETRIES} attempts`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the Python FastAPI document service as a child process.
 * If the service is already running (healthy), this is a no-op.
 */
async function start() {
  // Already running?
  try {
    const res = await axios.get(HEALTH_URL, { timeout: 2000 });
    if (res.status === 200) {
      logger.info('Document Service already running');
      return;
    }
  } catch {
    // not running — proceed to spawn
  }

  logger.info('Starting Document Service ...');

  childProcess = spawn(VENV_PYTHON, [ENTRY_POINT], {
    cwd: SERVICE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  childProcess.stdout.on('data', (data) => {
    logger.info(`[DocxService] ${data.toString().trim()}`);
  });

  childProcess.stderr.on('data', (data) => {
    logger.warn(`[DocxService] ${data.toString().trim()}`);
  });

  childProcess.on('exit', (code, signal) => {
    logger.info(`Document Service exited (code=${code}, signal=${signal})`);
    childProcess = null;
  });

  childProcess.on('error', (err) => {
    logger.error('Failed to spawn Document Service', { error: err.message });
    childProcess = null;
  });

  try {
    await waitForHealthy();
    logger.info('Document Service is healthy');
  } catch (err) {
    logger.error(err.message);
    stop();
    throw err;
  }
}

/**
 * Gracefully stop the Python service.
 */
function stop() {
  if (!childProcess) return;
  logger.info('Stopping Document Service ...');
  childProcess.kill('SIGTERM');
  childProcess = null;
}

/**
 * Check if the service is running and healthy.
 */
async function isHealthy() {
  try {
    const res = await axios.get(HEALTH_URL, { timeout: 2000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

module.exports = { start, stop, isHealthy };
