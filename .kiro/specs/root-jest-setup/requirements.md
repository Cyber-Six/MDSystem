# Requirements Document

## Introduction

This feature introduces a root-level Jest multi-project configuration for the MDSystem monorepo. The goal is a single `npm test` command at the repository root that discovers and runs tests across all sub-projects (Backend, mds-mobile, mds-patient, mds-staff, and a root-level integration/e2e project), aggregates coverage, and outputs a unified coverage report. Each sub-project retains its own `jest.config.js` that the root orchestrator references as a project entry.

## Glossary

- **Root_Runner**: The Jest process invoked from the repository root via `npm test`, configured in `jest.config.js` at the workspace root.
- **Project_Config**: A per-sub-project `jest.config.js` file that defines that project's test environment, transforms, and coverage sources; referenced by the Root_Runner as a `projects` entry.
- **Backend_Project**: The `Backend/` Node.js/Express sub-project; uses Jest ^30, CommonJS, no JSX.
- **Mobile_Project**: The `mds-mobile/` React Native/Expo sub-project; currently uses Jest ^29 via `jest-expo` preset.
- **Patient_Project**: The `mds-patient/` React/Vite SPA; currently uses `node:test`; will be migrated to Jest.
- **Patient_Jest_Config**: The `mds-patient/jest.config.js` introduced by this feature.
- **Staff_Project**: The `mds-staff/` React/Vite SPA; currently uses `node:test`; will be migrated to Jest.
- **Staff_Jest_Config**: The `mds-staff/jest.config.js` introduced by this feature.
- **Integration_Project**: A new `tests/` directory at the workspace root for cross-domain integration and e2e tests; initially contains a placeholder test.
- **Coverage_Aggregator**: The Root_Runner's coverage collection pass that merges coverage data from all projects into `<rootDir>/coverage`.
- **Root_Setup_File**: A `jest.setup.js` at the workspace root providing global mocks and utilities shared across projects that opt in.
- **ESM_Transform**: The Jest transformer configuration using `babel-jest` + `@babel/core` + `@babel/preset-env` (targeting CommonJS output) to handle ESM modules in mds-patient and mds-staff.

---

## Requirements

### Requirement 1: Root Jest Orchestration

**User Story:** As a developer, I want to run all monorepo tests with one command from the repository root, so that I can verify the full system without switching directories.

#### Acceptance Criteria

1. THE Root_Runner SHALL be configured via a `jest.config.js` file located at `<rootDir>/jest.config.js` (i.e., `d:\projects\Mdsystem\jest.config.js`).
2. THE Root_Runner SHALL declare a `projects` array containing five entries specified as relative paths: `'<rootDir>/Backend'`, `'<rootDir>/mds-mobile'`, `'<rootDir>/mds-patient'`, `'<rootDir>/mds-staff'`, and `'<rootDir>/tests'`; each path SHALL resolve to a directory containing a `jest.config.js`.
3. WHEN `npm test` is executed at the repository root, THE Root_Runner SHALL invoke all five Project_Configs and exit with code 0 if all tests pass, or with a non-zero code if any test fails or any Project_Config cannot be resolved.
4. THE Root_Runner SHALL set `coverageReporters` to `['text', 'lcov']`.
5. THE Root_Runner SHALL set `coverageDirectory` to `'<rootDir>/coverage'`.
6. THE `package.json` at the workspace root SHALL define a `"test"` script equal to `"jest"`.
7. IF any entry in the `projects` array cannot be resolved to a valid `jest.config.js`, THEN THE Root_Runner SHALL exit with a non-zero code and emit an error message identifying the unresolvable project path.

---

### Requirement 2: Backend Project Config

**User Story:** As a developer, I want the Backend sub-project to have its own Jest config, so that its Node.js integration tests run with the correct environment and remain independently executable.

#### Acceptance Criteria

1. THE Backend_Project SHALL be configured via `Backend/jest.config.js`.
2. THE Backend_Project config SHALL set `testEnvironment` to `'node'`.
3. THE Backend_Project config SHALL set `testMatch` to include `**/__tests__/**/*.test.js` and `**/*.integration.test.js` patterns within `Backend/`.
4. THE Backend_Project config SHALL set `displayName` to `'backend'` so test output identifies the project.
5. WHEN `jest` is executed inside the `Backend/` directory, THE Backend_Project SHALL run only tests matched by the `testMatch` patterns defined in `Backend/jest.config.js`, without requiring the root config to be present.
6. THE Backend_Project config SHALL collect coverage from `Backend/routes/**/*.js` and `Backend/config/**/*.js`, excluding `node_modules` and `__tests__` directories.
7. IF `Backend/jest.config.js` is absent or malformed when the Root_Runner attempts to load it, THE Root_Runner SHALL exit with a non-zero code and emit an error message identifying the config file path that could not be loaded.
8. THE Backend test suite SHALL complete within 120 seconds when run via the Root_Runner.

---

### Requirement 3: Mobile Project Config

**User Story:** As a developer, I want the mds-mobile sub-project to have its own Jest config file, so that the jest-expo preset is applied consistently whether tests run standalone or via the root orchestrator.

#### Acceptance Criteria

1. THE Mobile_Project SHALL be configured via `mds-mobile/jest.config.js`.
2. THE Mobile_Project config SHALL set `preset` to `'jest-expo'`.
3. THE Mobile_Project config SHALL set `setupFilesAfterEnv` to `['<rootDir>/jest.setup.ts']`, migrating the existing inline config from `mds-mobile/package.json`.
4. THE Mobile_Project config SHALL declare the following `moduleNameMapper` entries exactly:
   - `'^expo/src/winter(.*)$'` mapped to `'<rootDir>/__mocks__/expo-winter.js'`
   - `'^@mdsystem/core(.*)$'` mapped to `'<rootDir>/../packages/core/src$1'`
5. THE Mobile_Project config SHALL set `displayName` to `'mobile'`.
6. THE Mobile_Project config SHALL set `collectCoverageFrom` to `['src/**/*.{ts,tsx}', '!src/**/*.d.ts']`.
7. WHEN the Root_Runner runs, it SHALL reference the Mobile_Project via the `'<rootDir>/mds-mobile'` entry in its `projects` array, resolving to `mds-mobile/jest.config.js`.
8. IF `mds-mobile/jest.config.js` exists, THEN the `"jest"` key SHALL be removed from `mds-mobile/package.json` so that Jest configuration is not duplicated.
9. THE `mds-mobile` Jest devDependency SHALL remain at `^29.x` (pinned to the version compatible with `jest-expo ^54`); the root orchestrator SHALL NOT require mds-mobile to upgrade to Jest ^30.

---

### Requirement 4: Patient Project Jest Migration

**User Story:** As a developer, I want the mds-patient sub-project's tests to run under Jest instead of node:test, so that they participate in unified coverage reporting and benefit from the same assertions and mocking APIs used across the monorepo.

#### Acceptance Criteria

1. THE Patient_Jest_Config SHALL be created at `mds-patient/jest.config.js`.
2. THE Patient_Jest_Config SHALL set `testEnvironment` to `'node'` for pure logic tests (the current test files contain no DOM assertions).
3. THE Patient_Jest_Config SHALL configure `transform` to use `babel-jest` with `@babel/preset-env` targeting CommonJS output (`modules: 'commonjs'`) so that ES module syntax in `mds-patient/src` is transpiled at test time.
4. THE Patient_Jest_Config SHALL set `testMatch` to discover `**/__tests__/**/*.test.js` and `**/*.test.js` within `mds-patient/src`.
5. THE Patient_Jest_Config SHALL set `displayName` to `'patient'`.
6. THE Patient_Jest_Config SHALL set `collectCoverageFrom` to `['src/**/*.{js,jsx}', '!src/**/*.config.*', '!src/**/__tests__/**']`.
7. THE `mds-patient/package.json` SHALL add `jest` ^30, `babel-jest`, `@babel/core`, and `@babel/preset-env` as `devDependencies`.
8. WHEN `npm test` is run inside `mds-patient/`, all pre-existing test cases in `src/modules/appointment/__tests__/appointment-purpose.test.js` SHALL report passing status; any import of `node:test` or `node:assert/strict` SHALL be handled via `moduleNameMapper` entries in the Patient_Jest_Config so test files are not modified.
9. THE `mds-patient/package.json` `"test"` script SHALL be updated to `"jest"` to replace the previous `node --test` invocation.
10. THE existing test files under `mds-patient/src` SHALL NOT be modified as part of this migration; only config files, a Babel config file (e.g., `babel.config.js`), and `devDependency` additions to `package.json` are permitted.

---

### Requirement 5: Staff Project Jest Migration

**User Story:** As a developer, I want the mds-staff sub-project's tests to run under Jest instead of node:test, so that they participate in unified coverage reporting.

#### Acceptance Criteria

1. THE Staff_Jest_Config SHALL be created at `mds-staff/jest.config.js`.
2. THE Staff_Jest_Config SHALL set `testEnvironment` to `'node'` for the current pure logic test files.
3. THE Staff_Jest_Config SHALL configure `transform` to use `babel-jest` with `@babel/core` and `@babel/preset-env` (targeting CommonJS output with `modules: 'commonjs'`), matching the ESM_Transform approach defined in Requirement 4.
4. THE Staff_Jest_Config SHALL set `testMatch` to discover `**/__tests__/**/*.test.js` and `**/*.test.js` within `mds-staff/src`.
5. THE Staff_Jest_Config SHALL set `displayName` to `'staff'`.
6. THE Staff_Jest_Config SHALL set `collectCoverageFrom` to `['src/**/*.{js,jsx}', '!src/**/*.config.*', '!src/**/__tests__/**']`.
7. THE `mds-staff/package.json` SHALL add `jest` ^30, `babel-jest`, `@babel/core`, and `@babel/preset-env` as `devDependencies`.
8. WHEN `npm test` is run inside `mds-staff/`, all pre-existing test cases SHALL report passing status; any import of `node:test` or `node:assert/strict` in existing test files SHALL be handled via `moduleNameMapper` entries in the Staff_Jest_Config so test files are not modified.
9. THE `mds-staff/package.json` `"test"` script SHALL be updated to `"jest"` to replace the previous `node --test` invocation.
10. THE existing test files under `mds-staff/src` SHALL NOT be modified as part of this migration.

---

### Requirement 6: Root Integration/E2E Project

**User Story:** As a developer, I want a dedicated `tests/` directory at the repository root for cross-domain integration and e2e tests, so that there is a clear home for tests that exercise multiple sub-systems together.

#### Acceptance Criteria

1. A `tests/` directory SHALL be created at `<rootDir>/tests/`.
2. THE Integration_Project SHALL be configured via `<rootDir>/tests/jest.config.js`.
3. THE Integration_Project config SHALL set `testEnvironment` to `'node'`.
4. THE Integration_Project config SHALL set `displayName` to `'integration'`.
5. THE Integration_Project config SHALL set `testMatch` to `['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.integration.test.js']` so only files within the `tests/` directory are matched.
6. THE Integration_Project SHALL contain a placeholder test file at `<rootDir>/tests/smoke.test.js` with exactly one test described as `'smoke: test runner is operational'` that calls `expect(true).toBe(true)`.
7. THE Integration_Project config SHALL set `passWithNoTests` to `true` so that the Root_Runner does not fail if the `tests/` directory contains no test files.

---

### Requirement 7: Shared Root Setup File

**User Story:** As a developer, I want a shared Jest setup file at the repository root, so that global mocks and utilities needed across multiple projects can be maintained in one place.

#### Acceptance Criteria

1. THE Root_Setup_File SHALL be created at `<rootDir>/jest.setup.js`.
2. WHEN Jest requires the Root_Setup_File, it SHALL complete without throwing any uncaught exceptions and the Jest process SHALL NOT exit with a non-zero code attributable to the setup file.
3. THE Root_Setup_File SHALL initially contain: (a) a comment block describing its purpose as the shared global setup file for the monorepo, and (b) a commented-out code example showing how a Project_Config opts in via `setupFilesAfterEnv: ['<rootDir>/../jest.setup.js']`.
4. A Project_Config SHALL include the Root_Setup_File in its `setupFilesAfterEnv` array only if it explicitly needs the shared mocks or utilities; a Project_Config that does not need shared globals SHALL NOT reference the Root_Setup_File.

---

### Requirement 8: Coverage Aggregation

**User Story:** As a developer, I want unified coverage output in a single directory when running tests from the root, so that I can view the full system's test coverage in one report.

#### Acceptance Criteria

1. WHEN `npm test -- --coverage` is executed at the repository root, THE Coverage_Aggregator SHALL write all coverage output files to `<rootDir>/coverage/`.
2. THE Root_Runner SHALL set `coverageReporters` to `['text', 'lcov']`.
3. THE `coverage/` directory SHALL be present in the `.gitignore` file at the repository root; if it is already listed, no duplicate entry SHALL be added.
4. WHEN coverage is collected, THE Coverage_Aggregator SHALL include sources from all five projects: Backend, mds-mobile, mds-patient, mds-staff, and tests.
5. IF a sub-project's `collectCoverageFrom` glob matches no files, THEN THE Root_Runner SHALL NOT exit with a non-zero code; the project's coverage contribution SHALL appear as an empty set in the report rather than causing a failure.

---

### Requirement 9: Independent Sub-Project Execution

**User Story:** As a developer, I want to run tests for a single sub-project without invoking the root orchestrator, so that local iteration is fast and does not require the full monorepo context.

#### Acceptance Criteria

1. WHEN `jest` is executed inside `Backend/`, the process SHALL exit with code 0 when all Backend tests pass, using only `Backend/jest.config.js` and without referencing `<rootDir>/jest.config.js`.
2. WHEN `jest` is executed inside `mds-mobile/`, the process SHALL exit with code 0 when all mobile tests pass, applying the `jest-expo` preset from `mds-mobile/jest.config.js` and without referencing the root config.
3. WHEN `jest` is executed inside `mds-patient/`, the process SHALL exit with code 0 when all patient tests pass, using only `mds-patient/jest.config.js` and without referencing the root config.
4. WHEN `jest` is executed inside `mds-staff/`, the process SHALL exit with code 0 when all staff tests pass, using only `mds-staff/jest.config.js` and without referencing the root config.
5. EACH sub-project's `jest.config.js` SHALL set `coverageDirectory` to a path that is distinct from `<rootDir>/coverage` (e.g., `coverage` relative to the sub-project directory) so that coverage output from independent runs does not overwrite the root-level aggregated report.

---

### Requirement 10: No Disruption to Existing Workflows

**User Story:** As a developer, I want the existing test commands and CI scripts for each sub-project to continue working, so that introducing the root config does not break anything that currently passes.

#### Acceptance Criteria

1. THE `Backend/package.json` `"test"` script SHALL remain `"jest --runInBand"` unchanged; the addition of `Backend/jest.config.js` SHALL only add new configuration and SHALL NOT remove or alter any existing `devDependencies` or scripts in `Backend/package.json`.
2. THE `mds-mobile/package.json` `"test"`, `"test:watch"`, and `"test:coverage"` scripts SHALL produce the same pass/fail result per test after migration to `mds-mobile/jest.config.js` as they did before, with no change in exit code for a passing suite.
3. THE `mds-patient/package.json` `"test"` script SHALL be updated from `"node --test src/modules/record-forms/update-record/__tests__/*.test.js"` to `"jest"`; all test cases that passed before the migration SHALL still pass under Jest.
4. THE `mds-staff/package.json` `"test"` script SHALL be updated from `"node --test \"src/**/*.test.js\""` to `"jest"`; all test cases that passed before the migration SHALL still pass under Jest.
5. THE `packages/core/package.json` SHALL NOT be modified by this feature.
6. THE Root_Runner configuration SHALL NOT modify any application source files, route handlers, services, middleware, or any file outside of `jest.config.js`, `babel.config.js`, `package.json`, `.gitignore`, and `jest.setup.*` files.
