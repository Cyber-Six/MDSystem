# Playwright GUI and end-to-end testing

MDSystem keeps a fast, mocked GUI smoke suite separate from database-backed browser tests. The smoke suite runs on GitHub-hosted runners. Disposable E2E runs execute on the Raspberry Pi using a unique Compose project with its own PostgreSQL, Redis, media volume, and SMTP capture service. They do not use or reset the deployed use-case database.

## Current coverage

The foundation currently automates five database-backed checks. Appointment capacity/approval and medicine request flows from the agreed Phase 1 remain to be added before Phase 1 can be considered complete.

| ID | Actors and prerequisites | Browser action and expected result | Status |
| --- | --- | --- | --- |
| CORE-AUTH-01 | Seeded student and valid credentials; real Postgres, Redis, worker, and SMTP capture | Reject a bad password, reject an incorrect OTP, complete email OTP login, and remain authenticated after refresh | Automated |
| CORE-AUTH-02 | Same seeded student, no staff account required | Attempt patient credentials on the staff portal; staff login is rejected | Automated |
| CORE-AUTH-03 | Bootstrap administrator inserted by startup SQL | Complete staff OTP login and open role management; the Administration view appears | Automated |
| CORE-AUTH-04 | Seeded Quezon City staff account with staff access and no admin grant | Complete staff login and request role management; route returns to dashboard and admin view stays inaccessible | Automated |
| CORE-AUTH-05 | No saved session | Open the protected staff role-management route directly; browser redirects to login | Automated |
| CORE-RECORD-01 | Student with no initial record | Submit initial record; staff sees the pending record | Planned |
| CORE-RECORD-02 | Pending initial record and authorized staff account | Review and approve it; patient sees approved status after refresh | Planned |
| CORE-APPT-01 | Patient and available seeded appointment slot | Book appointment; staff sees the new pending booking | Planned |
| CORE-APPT-02 | Pending appointment and authorized staff account | Approve appointment; patient sees approved status after refresh | Planned |
| CORE-APPT-03 | Patient with cancellable appointment | Cancel it; patient and staff see the cancelled state | Planned |
| CORE-APPT-04 | Slot with zero remaining capacity | Attempt booking; application rejects it and no booking is persisted | Planned |
| CORE-MED-01 | Patient, active inventory item, and authorized staff | Submit a medicine request; staff sees the request | Planned |
| CORE-MED-02 | Pending request and sufficient inventory | Approve request; patient sees the result and available stock changes by the expected amount | Planned |
| CORE-AUTH-06 | Valid patient, staff, and administrator accounts | Log out each portal session; protected pages redirect to login | Planned |
| CORE-AUTH-07 | Restricted staff account without a required module grant | Attempt to submit an unauthorized staff operation; server rejects the mutation and data remains unchanged | Planned |

This catalog is a staged implementation record, not a claim that all scenarios in the longer coverage plan are already automated. Add each scenario with an ID, actors, seed requirements, action, expected persistence, and automation status before counting it toward the deployment gate.

## Pi-local SQL configuration

The test runner reads only SQL file paths from a local config file. SQL contents and credentials stay out of Git. The files are mounted read-only and applied in order: schema, post-build setup, then startup SQL. `psql` stops on the first SQL error. Each run creates a generated bootstrap administrator and synthetic patient/staff accounts using database-returned IDs.

On the Pi, from the project directory, copy the template and set the three absolute paths to the SQL files already stored on that host:

```sh
cd /srv/projects/MDSystem
cp e2e/config.example.env e2e.private.env
find . -name 'MDSystem093026.sql' -o -name 'post_build_setup.sql' -o -name 'startup.sql'
nano e2e.private.env
```

Use the exact absolute paths returned by `realpath`, for example:

```dotenv
E2E_SCHEMA_SQL=/absolute/path/to/MDSystem093026.sql
E2E_POST_BUILD_SQL=/absolute/path/to/post_build_setup.sql
E2E_STARTUP_SQL=/absolute/path/to/startup.sql
```

Keep `e2e.private.env` on the Pi and ignored by Git. The runner service account needs read access to those SQL files and write access to `/srv/projects/MDSystem/e2e-state`. No production `.env` values are loaded. Each run generates fresh database and Redis passwords, JWT/TOTP keys, and test account credentials in a restricted temporary file, then deletes that file after cleanup.

## Running tests

### Selecting portal URLs for the smoke suite

The smoke suite reads `E2E_PATIENT_URL` and `E2E_STAFF_URL` from the repository-root `.env.e2e` file. Copy `.env.e2e.example` to `.env.e2e`, then edit the two URLs to select local preview servers or deployed portals. The local file is ignored by Git. Shell environment variables with the same names override the file.

For the internet deployment:

```dotenv
E2E_PATIENT_URL=https://www.mdsystemtip.space
E2E_STAFF_URL=https://staff.mdsystemtip.space
```

For local Vite preview servers:

```dotenv
E2E_PATIENT_URL=http://127.0.0.1:4173
E2E_STAFF_URL=http://127.0.0.1:4174
```

Run `npm run build` before using local preview URLs. When a portal URL points to a remote deployment, Playwright does not start a local preview server for that portal. The smoke suite checks the portal UI and mocks an invalid login response, so it does not authenticate or change deployed data.

```sh
npm run test:e2e:smoke
```

These URL settings apply to the GUI smoke suite. The disposable `core` and `full` suites continue to use their isolated Docker environment.

### Student and employee registration form coverage

The opt-in `registration` project registers synthetic student and employee accounts on the patient deployment. Each of the five student and five employee tests fills and submits a complete initial medical record, including personal information, emergency contacts, medical background, dental answers and synthetic dental images, certification, and OB-GYNE details for female profiles. Profiles vary student/employment categories, campus, names, dates, contacts, and personal/family history. Tests assert accepted personal-profile data, a successful medical-record batch with no GraphQL errors, the submission success message, and a persisted Pending ticket after refreshing the page. They create persistent accounts and medical records, so configure `E2E_PATIENT_URL` for the test deployment and set `E2E_REGISTRATION_ENABLED=1` before running. The deployment must accept any six-digit verification code; set `E2E_TEST_OTP` only if a fixed test code is configured. Each run generates unique institutional emails and record identifiers and attaches account/record data to the report. Accounts and submitted records are left for inspection. Staff approval, revision, and cancellation are outside this suite.

```sh
E2E_REGISTRATION_ENABLED=1 npm run test:e2e:registration
```

Each account test has its own file: `mstudent-01.spec.js` through `mstudent-05.spec.js`, and `memployee-01.spec.js` through `memployee-05.spec.js`. The three mocked registration input-validation tests remain in their separate file. With one worker, account creation pauses eight seconds per test to respect registration rate limits.

Run an individual account test:

```sh
E2E_REGISTRATION_ENABLED=1 npm run test:e2e:registration -- mstudent-01.spec.js
E2E_REGISTRATION_ENABLED=1 npm run test:e2e:registration -- memployee-01.spec.js
```

The suite uses ten synthetic profiles: five students and five employees, with male and female form paths and varied names and IDs. Student tests select a catalog program using `E2E_PROGRAM_SEARCH` (default `Computer`); configure it to match a program in your test database. Dental uploads are synthetic PNG fixtures supplied in memory.

Deployment verification on 2026-10-13 confirmed five student submissions and the Non-Teaching employee submission persisted as `Pending`; all three mocked input-validation tests passed. The other four employee cases exposed deployed `employeeRole` enum errors for `Faculty`, `AcademicHead`, and `Employee`, produced by the employment-category mapping in `mds-patient/src/services/emr-service.js`. These valid-data tests remain active and report the backend errors instead of treating the rejected submissions as successful.

### Patient-defined custom choices

The separate `custom-choices` suite has four workflows: Student initial record, Employee initial record, Student update, and Employee update. It covers creating and reusing custom self/family conditions, vaccines, allergens, hospitalization conditions, operations, and medications. It also checks employee Other text, initial dental Other text/location, medical-background notes, navigation retention, companion-field validation, review, and authenticated saved-data readback. Existing registration coverage remains separate.

In Git Bash, run all four workflows or one file:

```sh
E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices
E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices -- student-initial.spec.js --headed
E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices -- employee-update.spec.js --headed
```

The target and test OTP use `.env.e2e` (`E2E_PATIENT_URL` and optional `E2E_TEST_OTP`). The opt-in authorizes persistent synthetic accounts, catalog entries, and pending records on this target. Initial tests reuse registration pacing. Update tests require dedicated **patient** credentials, not admin/staff credentials, in the ignored `.env.e2e`:

```dotenv
E2E_CUSTOM_STUDENT_EMAIL=your-approved-student-qa-email
E2E_CUSTOM_STUDENT_PASSWORD=your-student-qa-password
E2E_CUSTOM_EMPLOYEE_EMAIL=your-approved-employee-qa-email
E2E_CUSTOM_EMPLOYEE_PASSWORD=your-employee-qa-password
```

Each update account must be Active with an approved record and no pending/in-progress/revision update. The suite fails before modifying an ineligible account and rechecks immediately before submission. Submitted updates remain pending; subsequent runs need eligible accounts again. The suite performs no staff approval, cancellation, or cleanup. It does not change application APIs or database schemas.

Every run writes `e2e-results/custom-choices/results.json` and `e2e-results/custom-choices/errors.md`, with exact failures, reproduction commands, request/response evidence, and expected/actual saved-value comparisons. Each test attaches `custom-choice-evidence.json`. Credentials and tokens are omitted, and videos, traces, and screenshots are disabled for this project. Keep artifacts private because approved QA-account readback can contain personal information.

Individual-file runs update that workflow's result without discarding the other workflows; each entry has its own recorded timestamp. Initial forms validate on Submit. During intentionally invalid input probes, writes are aborted and reported if client validation fails to block them. A request guard also blocks application-initiated record cancellation. These guards do not fabricate successful backend responses. After restoring valid input, normal submission uses the real deployment, and readback still runs after a partial GraphQL batch failure.

If creation saves a catalog row but fails to display/select it, the test records that failure and tries the normal search/reuse UI path so later sections can still be exercised. Assertions remain failed. No mocked backend success, automatic retries, or application fixes are used to make these workflows pass. A missing-credential failure or an earlier form error means later saved-data checks were not reached.

### Saving and running recorded tests

Save Codegen-based tests under `e2e/recorded/` with filenames ending in `.spec.js`. Start from `e2e/recorded/template.spec.js`, choose the patient or staff URL from `.env.e2e`, and paste Codegen's actions inside the `test()` callback. Codegen can open the selected portal directly:

```sh
npx playwright codegen https://www.mdsystemtip.space/auth/login
```

Run the saved recorded tests explicitly from the repository root:

```sh
npm run test:e2e:recorded
```

This project is separate from smoke and is not run by `npm run test:e2e:smoke`. Recorded tests can submit forms and change data; use a local or disposable test environment when possible. If `.env.e2e` points to the deployed portals, actions may create or alter live records. Set `E2E_VISUAL_RECORDING=1` to save a video for each recorded test under `e2e-results/`.

If you organize tests in `e2e/review/`, run that folder with `npm run test:e2e:review`. It discovers `*.spec.js` files there and uses the same portal URL settings. Start from `e2e/review/template.spec.js` when adding a test.

The read-only staff review test uses dedicated QA values in the ignored `.env.e2e` file. The patient must have exactly one pending initial record visible to that staff account. The test opens the record for review and leaves its status unchanged.

```dotenv
E2E_STAFF_URL=https://staff.mdsystemtip.space
E2E_REVIEW_STAFF_EMAIL=your-review-qa-staff-email
E2E_REVIEW_STAFF_PASSWORD=your-review-qa-staff-password
E2E_TEST_OTP=111111
E2E_REVIEW_PATIENT_NAME=QA Patient Name
```

Run the test with the browser visible:

```sh
npm run test:e2e:review -- review-review-registration.spec.js --headed
```

### Adding smoke tests

Put additional GUI smoke tests in `e2e/smoke/`. Copy `e2e/smoke/template.js` to a new filename ending in `.spec.js` (for example, `e2e/smoke/appointments.spec.js`), then edit the portal, steps, and assertions. The smoke project discovers `login-smoke.spec.js` and every `*.spec.js` under `e2e/smoke/`, so the usual command runs the new file too:

```sh
cp e2e/smoke/template.js e2e/smoke/appointments.spec.js
npm run test:e2e:smoke
```

The template only opens a portal and checks its heading. For tests that create or modify records, prefer the isolated database-backed suites under `e2e/core/` or `e2e/flows/`; the internet smoke target is a real deployment.

The mocked browser smoke suite needs only the repository dependencies and built frontend apps:

```sh
npm ci
npm run build
npx playwright install chromium
npm run test:e2e:smoke
```

The disposable suites require Docker Compose on the Pi, the SQL config above, and the repository's Docker permissions:

```sh
npm run test:e2e:core
npm run test:e2e:full
```

`core` is the Phase 1 deployment gate as its cross-portal scenarios are completed. `full` runs all database-backed specs under `e2e/core` and `e2e/flows`; it currently runs the same automated core specs and will grow with later phases. Both commands build an isolated application image whose frontends point only at the private Compose services. The browser container is pinned to Playwright 1.63.0, matching the repository's `@playwright/test` lockfile version.

The runner uses a unique `mdse2e-<run>` Compose project and dedicated network and volumes. Setup creates the database from empty storage; cleanup removes only resources labeled with that exact Compose project. Do not use the deployed workflow's `reset-database` operation for E2E. If a runner is terminated before cleanup, rerun the registered-project cleanup from the same repository checkout:

```sh
E2E_CONFIG_PATH=/srv/projects/MDSystem/e2e.private.env node scripts/e2e-cleanup.js --registered
```

Successful and failed reports stay under the ignored `e2e-results/` directory in the runner workspace. The workflow uploads HTML reports, sanitized failure screenshots, SQL SHA-256 checksums, and filtered service logs for seven days. Raw Playwright traces are disabled because they can preserve OTPs, credentials, and authenticated request data. Service logs redact six-digit values and generated secrets before saving.

## GitHub Actions

The existing hosted `gui-smoke` job remains fast and uses mocked invalid-login responses. For a trusted push to `deployment`, the self-hosted ARM64 job first runs unit tests and builds the app image, then runs the disposable database-backed core suite before it resets the Pi use-case database and deploys the tested image. Fork pull requests run only the hosted GUI smoke job. The local Pi config file and SQL files must be present before this deployment gate runs.

For a manual run, select **Actions → Playwright E2E → Run workflow** on `deployment`, then choose `core` or `full`. The `record_video` option is enabled by default and saves a video for each browser test. Download the workflow's `playwright-...` artifact and open the HTML report to view the videos alongside the test results. Turn `record_video` off to skip them. Automatic deployment-gate runs do not record video. Traces remain disabled.

Videos show the synthetic account activity used during sign-in, including the one-time code. Keep downloaded workflow artifacts private and do not publish them. The E2E database and accounts are disposable, and videos are retained as GitHub Actions artifacts for seven days.

This records the browser as the test runs; it is not an interactive Codegen session. Playwright Codegen generates test code from manual clicks and is a separate desktop workflow.

Google OAuth, real reCAPTCHA challenges, third-party chatbot responses, and external mail delivery remain manual integration checks. Automated tests use controlled substitutes for those external providers.
