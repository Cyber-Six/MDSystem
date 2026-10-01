# Testing

Run commands from the repository root unless a command says otherwise.

## Backend

Run all backend Jest tests:

```sh
npm run test:backend
```

Run backend tests with coverage:

```sh
npm run test:backend:coverage
```

The backend suite uses `Backend/jest.config.js`. Eligible backend JavaScript
sources require a same-directory `filename.test.js` or
`__tests__/filename.test.js` counterpart. The inventory in
`Backend/test-support/source-inventory.cjs` drives both this guard and coverage
collection; generated output, dependencies, test infrastructure, and the
manual `test-patient-management.js` diagnostic are excluded.

Coverage thresholds are 100% for statements, branches, functions, and lines
for each eligible source file. Reports are written under `Backend/coverage/`.

## Playwright

The mocked hosted GUI checks and disposable database-backed Pi suites are separate. See [Playwright GUI and E2E testing](PLAYWRIGHT_E2E.md) for local SQL path configuration and the `test:e2e:smoke`, `test:e2e:core`, and `test:e2e:full` commands.

## Other workspaces

The root package exposes focused tests for each workspace:

```sh
npm run test:patient
npm run test:staff
npm run test:mobile
```

Use `npm test` to run the root Jest projects together. See each workspace's
README or `package.json` for additional commands and local test prerequisites.

Every eligible Backend JavaScript source is expected to have a same-directory
`filename.test.js` or `__tests__/filename.test.js` counterpart. The inventory
used by both the counterpart guard and coverage collection is
`Backend/test-support/source-inventory.cjs`; it excludes dependencies, generated
output, coverage output, test infrastructure, Jest configuration, and the
manual `test-patient-management.js` diagnostic.

Coverage thresholds are 100% for statements, branches, functions, and lines on
each eligible source file. Reports are emitted as text, HTML, LCOV, and JSON
under `Backend/coverage/`.

The counterpart guard lists missing files in a failing test, making newly added
backend source impossible to omit silently. To inspect uncovered branches after
a focused run, inspect `Backend/coverage/coverage-final.json` and the HTML
report. Tests mock database, Redis, HTTP, OAuth, email, sockets, and document
generation boundaries; no live service is required.
