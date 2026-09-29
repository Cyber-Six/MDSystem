/**
 * jest.setup.js — Shared global setup file for the MDSystem monorepo.
 *
 * This file is the opt-in shared setup entry point. Sub-projects that need
 * global mocks or shared utilities can reference it via:
 *
 *   // In their jest.config.js:
 *   // setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
 *
 * Do not add anything here unless it is genuinely needed across multiple
 * sub-projects. Prefer keeping setup logic in the sub-project's own
 * setupFilesAfterEnv file.
 */
