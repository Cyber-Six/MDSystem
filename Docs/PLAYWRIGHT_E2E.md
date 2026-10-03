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

The existing hosted `gui-smoke` job remains fast and uses mocked invalid-login responses. For a trusted push to `docker-testing`, the self-hosted ARM64 job first runs unit tests and builds the app image, then runs the disposable database-backed core suite before it can deploy the use-case services. Fork pull requests run only the hosted GUI smoke job. The local Pi config file and SQL files must be present before this deployment gate runs.

For a manual run, select **Actions → Playwright E2E → Run workflow** on `docker-testing`, then choose `core` or `full`. The `record_video` option is enabled by default and saves a video for each browser test. Download the workflow's `playwright-...` artifact and open the HTML report to view the videos alongside the test results. Turn `record_video` off to skip them. Automatic deployment-gate runs do not record video. Traces remain disabled.

Videos show the synthetic account activity used during sign-in, including the one-time code. Keep downloaded workflow artifacts private and do not publish them. The E2E database and accounts are disposable, and videos are retained as GitHub Actions artifacts for seven days.

This records the browser as the test runs; it is not an interactive Codegen session. Playwright Codegen generates test code from manual clicks and is a separate desktop workflow.

Google OAuth, real reCAPTCHA challenges, third-party chatbot responses, and external mail delivery remain manual integration checks. Automated tests use controlled substitutes for those external providers.
