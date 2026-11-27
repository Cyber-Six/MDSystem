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
`Backend/test-support/source-inventory.cjs` drives the counterpart guard.

Backend coverage collects application JavaScript and applies global floors of
29% statements, 20% branches, 21% functions, and 30% lines. The auth routes
have a separate 90% floor on all four metrics. Reports are written under
`Backend/coverage/`.

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

Use `npm run test:coverage` to run the root coverage gate. It uses the same
global floors and backend auth threshold, plus shared core thresholds from
90% to 100%. Reports are written under `coverage/`.

The counterpart guard lists missing files in a failing test, making newly added
backend source impossible to omit silently. To inspect uncovered branches after
a focused run, inspect `Backend/coverage/coverage-final.json` and the HTML
report. Tests mock database, Redis, HTTP, OAuth, email, sockets, and document
generation boundaries; no live service is required.
