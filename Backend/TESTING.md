# Backend Jest testing

Run the backend suite with:

```text
node node_modules/jest/bin/jest.js --config Backend/jest.config.js --runInBand
node node_modules/jest/bin/jest.js --config Backend/jest.config.js --runInBand --coverage
```

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
