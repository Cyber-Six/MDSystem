# Connected patient and staff lifecycle

Use this runner for a fresh, connected test run. Each scenario passes its own account, exact ticket, original input manifest and approved baseline between stages. It does not recover or select older registry accounts, so credentials left behind by a database reset cannot be selected. Individual suites remain available for targeted troubleshooting.

## Configuration

Configure the Git-ignored `.env.e2e` before running:

```dotenv
E2E_PATIENT_URL=https://www.mdsystemtip.space
E2E_STAFF_URL=https://staff.mdsystemtip.space
E2E_REVIEW_STAFF_EMAIL=your-dedicated-qa-staff-email
E2E_REVIEW_STAFF_PASSWORD=your-dedicated-qa-staff-password
E2E_TEST_OTP=111111
```

The staff account must be active and cover Manila. Use an administrator QA account or enable Pending Requests, Medical Records and Dental Records modules plus profile/EMR viewing for the QA staff account. Preflight checks staff login, permissions, both portals and the deployed profile SQL before creating accounts. A missing `employmentCategoryOther` column requires the CI `migrate-employee-category` operation; the runner does not migrate the database.

## Commands in Git Bash

```bash
# Local checks: no deployed accounts or records are created.
npm run test:lifecycle:diagnostics
npm run test:e2e:lifecycle:mocked
npm run test:e2e:lifecycle -- --list

# Full run: creates 12 distinct patients and performs persistent QA decisions.
E2E_LIFECYCLE_ENABLED=1 npm run test:e2e:lifecycle -- --headed

# One fresh scenario, including its prerequisite stages.
E2E_LIFECYCLE_ENABLED=1 npm run test:e2e:lifecycle -- --grep "Student update: connected revise" --headed

# Resume using the run ID printed by the original command.
E2E_LIFECYCLE_ENABLED=1 npm run test:e2e:lifecycle -- --run-id RUN_ID --headed
```

In PowerShell, set `$env:E2E_LIFECYCLE_ENABLED='1'` and then run `npm.cmd run test:e2e:lifecycle -- --headed`. Separate registration, custom-choice and staff-record flags are not required. The existing eight-second registration pacing is preserved. All lifecycle phases use one worker with no automatic retries; the command rejects concurrency, trace and project overrides.

The 12 scenarios cover Student/Employee, initial/update, and approve/reject/revise. Initial scenarios register, submit and verify a Pending record, inspect Full Record, and perform their assigned decision. Update scenarios create another dedicated patient, submit and verify the initial record, approve its baseline through the staff UI, then submit and verify an update before its assigned decision. Revision scenarios request revision, verify original prefilling, edit exposed personal/medical/dental details, resubmit as RevisionSubmitted, inspect changed and unchanged values, and approve. Visibility failures stop decisions. Update scenarios compare the existing approved baseline and retained history throughout.

## Saved runs, failures and resume

Private run manifests are stored atomically in `.e2e-private/lifecycle/RUN_ID.json`, with credentials saved as soon as registration succeeds. They contain real credentials and original inputs; never commit, attach or paste them into shared reports. Existing shared accounts/manifests are still saved for individually runnable suites, but the connected runner uses only its own artifacts. Do not use these patients manually or run other QA decision/update commands concurrently; an exclusive lease coordinates with the saved-account suites.

Sanitized reports are written to `e2e-results/lifecycle/RUN_ID/errors.md` and `results.json`. They include stage results, blocked prerequisites, action responses, field comparisons and ticket transitions. Traces, videos and screenshots are disabled, and browser contexts close between stages. Pending is a successful patient submission; staff approval is a subsequent stage.

Resume requires the same deployment URLs and authenticates each saved patient, checking its latest ticket, saved fields and Full Record against the most recent completed stage. Completed writes are not repeated. A failed or interrupted stage stays blocked because its write outcome may be uncertain; resume reports current authenticated state and does not guess or recreate that patient's account. Inspect the report and private manifest to investigate. A new run without `--run-id` creates new accounts. Other independent scenarios continue after one fails; preflight failure prevents every registration.

The mocked command combines 12 lifecycle handoff cases, real-browser preflight success/failures against a local mock server, and existing actual patient/staff component checks. It does not submit deployed records. A full deployed lifecycle is verified only after the explicitly enabled live command. Accounts, decisions and history remain available afterward; no reset, cancellation or cleanup is performed.
