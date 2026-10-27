# Staff record suite verification

Verified locally on 2026-10-21.

## Implemented coverage

- 12 independent live scenarios: Student and Employee, initial and update, approval/rejection/full revision cycle.
- Shared original-input manifests, saved-section comparisons, full-review assertions, distinct patient reservations and latest-ticket mutation guards.
- Read-only legacy-evidence recovery requires authenticated identity matching. Incomplete records or records without original input evidence are skipped.
- Private account credentials and input manifests remain under ignored `.e2e-private/`. Evidence/report output redacts passwords and tokens.

## Local verification

- 14 diagnostic tests passed (selection, recovery identity, reservations, execution lease, stale-ticket mutation guards, field comparisons, catalog-label isolation, redaction and GraphQL read contracts).
- 21 mocked browser tests passed across real staff review/detail components and patient form sections using real revision mappers. Patient navigation is driven by a local harness; live routing/submission is covered by the deployed scenarios.
- 70 focused application tests passed across patient/staff/backend suites.
- Both patient and staff production builds passed.
- Syntax checks passed. Playwright discovers 12 decision scenarios plus one read-only recovery setup test.
- Opt-in-disabled run: all 12 live scenarios and the setup were skipped. No deployed decisions or patient mutations were attempted.

## Defects corrected

- Staff review omitted personal/contact details, companion notes, custom employment/appliance descriptions, allergy dates and vaping duration; empty fields now explicitly show Not provided.
- Catalog loading filtered out unapproved patient choices and stopped after one page. Staff and patient revision loading now retain readable catalog labels across later pages.
- Update review could not resolve allergen labels held in its registry.
- Initial revision prefill dropped allergy notes; update prefill dropped several notes, employment details and zero smoking values.
- The update dental form showed its consultation date for the wrong Yes/No answer.
- Rejection notes were collected but not sent to the backend.
- Clinical updates were incorrectly required to approve a personal log, and approved updates could be misclassified as initial submissions. Decisions now distinguish those workflows and classification uses approved ticket history.
- Staff reads could omit older/rejected sections or select a newer ticket's sections. Reads now select the requested ticket and retain rejected clinical history under existing permission checks.
- Unresolved catalog choices now prevent approval; abandoned conditional lifestyle values stay hidden.

## Deployed coverage still pending

The local prerequisite inventory found **zero verified original input manifests** for each of the 12 scenario assignments. Earlier successful reports may be recoverable after authenticated identity checks; this has not been attempted against the deployment in this run.

`E2E_REVIEW_STAFF_EMAIL` and `E2E_REVIEW_STAFF_PASSWORD` are still absent from `.env.e2e`; the user is configuring them locally. Deploy the fixes and configure the dedicated staff account before enabling the live suite. No replacement patients are created automatically. Revision workflows without original control/review evidence remain skipped, even if clinical readback is available.

Commands and prerequisites: [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md#staff-record-decisions).

Local generated reports: `e2e-results/staff-records/errors.md`, `results.json`, and `prerequisites.json`. Skips are not successful deployed coverage. Existing Vite/Jest configuration warnings did not fail the builds or focused tests.
