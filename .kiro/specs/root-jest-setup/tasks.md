# Implementation Plan: Root Jest Multi-Project Setup

## Overview

Create a root-level Jest orchestration layer for the MDSystem monorepo. This involves creating `jest.config.js` files for each sub-project, migrating mds-patient and mds-staff from `node:test` to Jest (with `babel-jest` + `node:test` shims), and wiring everything together under a single root runner.

No application source files are touched. All changes are confined to Jest/Babel config files, `package.json` devDependency and script fields, `__mocks__` shim files, and the `tests/` integration placeholder.

## Tasks

- [x] 1. Scaffold root-level artifacts
  - [x] 1.1 Create `jest.config.js` at the workspace root
    - Export `projects` array with 5 relative directory entries: `'<rootDir>/Backend'`, `'<rootDir>/mds-mobile'`, `'<rootDir>/mds-patient'`, `'<rootDir>/mds-staff'`, `'<rootDir>/tests'`
    - Set `coverageDirectory: '<rootDir>/coverage'` and `coverageReporters: ['text', 'lcov']`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.2 Create `jest.setup.js` at the workspace root
    - Include a JSDoc comment block describing it as the shared global setup file for the monorepo
    - Include a commented-out example showing how a sub-project opts in via `setupFilesAfterEnv: ['<rootDir>/../jest.setup.js']`
    - No executable code — must complete without throwing
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.3 Update root `package.json` to add `"test": "jest"` script
    - Add `"test": "jest"` to the `scripts` field (root `package.json` already has `jest` ^30 as a devDependency)
    - _Requirements: 1.6_

  - [x] 1.4 Verify `.gitignore` lists `coverage/`
    - Check the root `.gitignore` for an existing `coverage/` entry; add it only if absent
    - `.gitignore` already contains `coverage/` — this task is a read-and-confirm, no write needed
    - _Requirements: 8.3_

- [x] 2. Create Backend Jest config
  - [x] 2.1 Create `Backend/jest.config.js`
    - Set `displayName: 'backend'`, `testEnvironment: 'node'`
    - Set `testMatch: ['**/__tests__/**/*.test.js', '**/*.integration.test.js']`
    - Set `collectCoverageFrom: ['routes/**/*.js', 'config/**/*.js']` with `coveragePathIgnorePatterns` excluding `node_modules` and `__tests__`
    - Set `coverageDirectory: 'coverage'` (relative — stays inside `Backend/`)
    - Do not modify `Backend/package.json`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 9.5, 10.1_

- [x] 3. Create mds-mobile Jest config
  - [x] 3.1 Create `mds-mobile/jest.config.js`
    - Set `preset: 'jest-expo'`, `displayName: 'mobile'`
    - Set `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`
    - Set `moduleNameMapper` with entries for `'^expo/src/winter(.*)$'` → `'<rootDir>/__mocks__/expo-winter.js'` and `'^@mdsystem/core(.*)$'` → `'<rootDir>/../packages/core/src$1'`
    - Set `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts']`
    - Set `coverageDirectory: 'coverage'`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.5_

  - [x] 3.2 Remove `"jest"` key from `mds-mobile/package.json`
    - Delete the `"jest"` block from `mds-mobile/package.json` now that configuration lives in `mds-mobile/jest.config.js`
    - Do not modify any other fields
    - _Requirements: 3.8_

- [x] 4. Migrate mds-patient to Jest
  - [x] 4.1 Create `mds-patient/__mocks__/node-test.js` shim
    - Export `{ test, describe, it }` mapped to the corresponding Jest globals so existing test files importing from `node:test` continue to work
    - _Requirements: 4.8, 4.10_

  - [x] 4.2 Create `mds-patient/__mocks__/node-assert-strict.js` shim
    - Re-export Node's built-in `assert` module with `callAsFunction` set to strict-mode assert; export all methods from `assert.strict`
    - _Requirements: 4.8, 4.10_

  - [x] 4.3 Create `mds-patient/babel.config.js`
    - Export `{ presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]] }`
    - _Requirements: 4.3_

  - [x] 4.4 Create `mds-patient/jest.config.js`
    - Set `displayName: 'patient'`, `testEnvironment: 'node'`
    - Set `transform: { '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }] }`
    - Set `testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js']`
    - Set `moduleNameMapper: { '^node:test$': '<rootDir>/__mocks__/node-test.js', '^node:assert/strict$': '<rootDir>/__mocks__/node-assert-strict.js' }`
    - Set `collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/**/*.config.*', '!src/**/__tests__/**']`
    - Set `coverageDirectory: 'coverage'`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.5_

  - [x] 4.5 Update `mds-patient/package.json`
    - Add `jest: "^30.0.0"`, `babel-jest: "^29.0.0"`, `@babel/core: "^7.0.0"`, `@babel/preset-env: "^7.0.0"` to `devDependencies`
    - Update `"test"` script from `"node --test src/modules/record-forms/update-record/__tests__/*.test.js"` to `"jest"`
    - _Requirements: 4.7, 4.9, 10.3_

- [x] 5. Migrate mds-staff to Jest
  - [x] 5.1 Create `mds-staff/__mocks__/node-test.js` shim
    - Same implementation as `mds-patient/__mocks__/node-test.js`
    - _Requirements: 5.8, 5.10_

  - [x] 5.2 Create `mds-staff/__mocks__/node-assert-strict.js` shim
    - Same implementation as `mds-patient/__mocks__/node-assert-strict.js`
    - _Requirements: 5.8, 5.10_

  - [x] 5.3 Create `mds-staff/babel.config.js`
    - Same content as `mds-patient/babel.config.js`
    - _Requirements: 5.3_

  - [x] 5.4 Create `mds-staff/jest.config.js`
    - Same shape as `mds-patient/jest.config.js` with `displayName: 'staff'`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.5_

  - [x] 5.5 Update `mds-staff/package.json`
    - Add same devDependencies as mds-patient: `jest ^30`, `babel-jest`, `@babel/core`, `@babel/preset-env`
    - Update `"test"` script from `"node --test \"src/**/*.test.js\""` to `"jest"`
    - _Requirements: 5.7, 5.9, 10.4_

- [x] 6. Create integration project
  - [x] 6.1 Create `tests/jest.config.js`
    - Set `displayName: 'integration'`, `testEnvironment: 'node'`
    - Set `testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.integration.test.js']`
    - Set `passWithNoTests: true`
    - Set `coverageDirectory: '<rootDir>/tests/coverage'`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 9.5_

  - [x] 6.2 Create `tests/smoke.test.js`
    - Single test with description `'smoke: test runner is operational'` that calls `expect(true).toBe(true)`
    - _Requirements: 6.6_

- [x] 7. Create config-shape verification tests
  - [x] 7.1 Create `tests/config-shape.test.js`
    - Use `require()` to load each `jest.config.js` and assert:
      - Root config: `projects` array has exactly 5 entries; `coverageDirectory` ends with `/coverage`; `coverageReporters` equals `['text', 'lcov']`
      - Backend config: `displayName === 'backend'`; `testEnvironment === 'node'`; `coverageDirectory === 'coverage'`
      - Mobile config: `preset === 'jest-expo'`; `displayName === 'mobile'`; `coverageDirectory === 'coverage'`
      - Patient config: `displayName === 'patient'`; `testEnvironment === 'node'`; `moduleNameMapper` contains keys for `node:test` and `node:assert/strict`; `coverageDirectory === 'coverage'`
      - Staff config: `displayName === 'staff'`; `testEnvironment === 'node'`; `moduleNameMapper` contains keys for `node:test` and `node:assert/strict`; `coverageDirectory === 'coverage'`
      - Integration config: `displayName === 'integration'`; `passWithNoTests === true`
      - Root `package.json`: `scripts.test === 'jest'`
      - `mds-mobile/package.json`: no `"jest"` key
      - `mds-patient/package.json`: `devDependencies` contains `jest`, `babel-jest`, `@babel/core`, `@babel/preset-env`; `scripts.test === 'jest'`
      - `mds-staff/package.json`: same devDependency assertions; `scripts.test === 'jest'`
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 4.1, 4.7, 5.1, 5.7, 6.2, 6.7_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - After running `npm test` from the repository root verify: all five projects appear in output, exit code is 0, `coverage/` directory is created when `--coverage` flag is passed.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP — there are none in this plan because the design explicitly excludes property-based tests (purely configuration-driven feature).
- Task 1.4 is a read-and-confirm: `coverage/` is already present in `.gitignore`; the task still appears for traceability against Requirement 8.3.
- Task order matters: all `jest.config.js` files (tasks 1–6) must be created before the config-shape test (task 7) can load them.
- `mds-mobile/package.json` devDependencies for Jest (`^29.x`) are NOT modified — only the inline `"jest"` config key is removed (Requirement 3.9).
- Install devDependencies in mds-patient and mds-staff after updating their `package.json` files (`npm install` inside each sub-project directory).
- The root runner resolves each project against its own `node_modules`, so the Jest ^29 / Jest ^30 split between mds-mobile and the rest is handled transparently by Jest's multi-project mode.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "3.1", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "6.1", "6.2"] },
    { "id": 1, "tasks": ["3.2", "4.4", "4.5", "5.4", "5.5"] },
    { "id": 2, "tasks": ["7.1"] }
  ]
}
```
