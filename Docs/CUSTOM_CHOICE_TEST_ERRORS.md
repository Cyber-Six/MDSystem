# Patient-defined choice investigation

## Latest pasted failure and reset recurrence (2026-10-21)

Update approval handling was subsequently corrected: an authenticated Active or Unverified QA account with a Pending initial ticket causes its update workflow to be skipped with a manual-staff-approval reason. This is not a successful update test and creates no update ticket. Both deployed update workflows were verified as skipped with exit code 0. Missing credentials, authentication failures without a valid Pending account, inactive accounts, and API/schema errors remain failures. Local diagnostics passed 27 tests. Earlier update-failure entries below describe the behavior before this correction.

The latest report was recorded after deployment-branch push run `39443439360` on 2026-10-20. Its reset-and-deploy step recreated the database. Run `39444711410` was a later development-branch push, not the deployment reset. Employee initial returned Pending ticket 1 with a missing `employmentCategoryOther` column error; that ticket is a partial submission, not a complete record ready for approval. Student initial passed with Pending ticket 2. Earlier ticket numbers in this document refer to databases from before that reset.

The local correction applies the committed additive migration after CI initialization/reset and from Compose `schema-init` for both fresh databases and databases with an existing initialization marker. The CI helper verifies the column before services restart. These source changes are not yet deployed. For the current database, the manual `migrate-employee-category` operation preserves existing rows and applies the missing column.

Initial custom-choice tests now perform a read-only profile-schema check after registration but before catalog or medical-ticket writes. A missing column stops with the migration command and preserves the registration credentials locally. It accepts a null profile for a newly registered account. Stale registry credentials remain excluded after an `INVALID_CREDENTIALS` response. Update tests still require an approved complete record and do not approve or replace records automatically. Do not approve the partial Employee ticket merely to satisfy update eligibility.

The schema gate was then exercised against the deployed site. It stopped in `Check deployed profile schema before catalog or ticket writes`, reporting the missing column with the migration operation. Captured evidence contained zero created catalog entries, zero EMR/profile mutations, and no ticket. Registration occurred and its credentials were saved; the run did not produce another partial medical record. Local diagnostics passed 20 tests, including fresh/existing Compose migration paths and missing-schema gating. Live submission verification remains blocked until the migration is applied.

The custom-choice suite reports defects without changing application code or schema. Opted-in deployment runs do create synthetic catalog entries and pending QA records. Run `E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices` from Git Bash to generate the current investigation report at `e2e-results/custom-choices/errors.md` and structured evidence at `e2e-results/custom-choices/results.json`.

Initial record submissions are expected to create a **Pending** ticket. Pending is the successful patient submission state before staff review; these workflows do not require approval. Batch errors report the HTTP status, GraphQL errors, and returned `submitTicket` value before Pending ticket and section readback starts. A report that stops at registration or credential preflight did not submit a record.

The `deployment` CI workflow labels each built Docker image with its source commit and checks the image revision used by the running patient and staff containers after deployment. A revision mismatch indicates stale containers and fails the workflow. Run `npm run test:custom-choice-diagnostics` to check response handling, readback field coverage, role-specific update input mapping, and image revision checks without contacting the deployed site.

The report identifies each attempted workflow, failed step, reproduction command, sanitized request/response, and any expected/actual saved-value comparisons that were reached. Account emails, passwords, session tokens, and authorization headers are excluded. Test artifacts stay ignored by Git.

Source inspection identified two concerns to verify against the deployment:

- Initial medical-condition creation: **fixed locally**. `createDomainCatalog` returns an array, while the initial history component's `useCatalogSearch.createItem` previously read `item.id` and stored the array as a single item. It now normalizes the response, accepts only a positive numeric catalog ID, and updates the parent catalog list so Review shows the label. The medical-history serializer also drops invalid keys as a final guard. Redeploy and rerun the initial workflows to verify this against the site.
- Employee Other category: the profile stores an enum role and has no custom-description field. The test requires exact submitted-description readback and reports any loss; it does not accept the generic Other value as proof of text preservation.

These are source findings, not proof of deployed behavior. Missing dedicated approved Student/Employee patient credentials prevents update coverage and is recorded as a prerequisite failure. Staff/admin credentials cannot substitute for patient credentials.

For a confirmed defect, inspect the per-workflow report's captured GraphQL operation, request variables, response data/errors, created IDs, and saved-value comparisons. A success dialog alone does not establish persistence.

## Deployed run on 2026-10-14

All four files were attempted. The two initial workflows exercised all seven catalog inputs and failed on deployed application behavior. Both update workflows failed their credential preflight before login or mutation; approved-record preservation has therefore not been verified live.

Reproduce the initial cases with:

```sh
E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices -- student-initial.spec.js
E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices -- employee-initial.spec.js
```

Confirmed observations from the final run:

- **Self/family condition creation:** expected a named, selected choice using the created catalog ID. Creation returned valid IDs, but the new checkbox labels were absent. Normal search/reuse made the saved entries selectable. The later batch contained an extra `conditionId: "undefined"` and returned `invalid input syntax for type integer: "undefined"` at `medicalHistory`.
- **Partial submission:** the same batch returned `submitTicket: "Pending"` despite the medical-history error. Employee ticket 8 (patient 13) and Student ticket 9 (patient 14) were read back as Pending/Both. This does not prove complete records: the batch had partial data and a failed history section.
- **Catalog search:** searching the newly created allergen did not return its created ID, although the choice remained rendered and could be reused through its checkbox. See the captured `searchAllergenCatalogs` requests and responses for exact names and IDs.
- **Review/navigation:** custom self/family conditions, vaccines, and allergens were missing from the Student review. More custom fields were missing from the Employee review. Returning to medical background hid the custom medication until it was searched again. The test retains these failures while using normal UI search to continue.
- **Blank dental Other description:** expected client validation to prevent submission. The app attempted `CreateInitialPersonalRecord` with the blank description instead. The invalid-input probe aborted that write, recorded the request, restored the description, and then attempted the normal completed submission.
- **Employee Other description:** expected the entered synthetic description to be readable. `getPatientBasicInfo` returned `role: "Other"`; no custom description was available in readback.
- **Pending section readback:** all seven patient clinical-section queries returned `No active profile found.` after the ticket became Pending. The report's null/missing saved-value comparisons mean **unreadable through these APIs**, not proof that every corresponding database value is null. Batch responses show several sections were accepted, but their persisted values could not be verified through patient readback.
- **Automatic cleanup:** the application attempted cancellation after its batch error. The suite's request guard blocked these requests and reported them, preserving the no-cancellation constraint.

The exact per-workflow requests, returned catalog IDs, expected inputs, comparisons, and responses are in the ignored run report. Syntax, four-file discovery, seven readback queries against the schema, evidence redaction, and the three existing mocked registration-validation tests passed. Discovery still finds all ten original account tests plus three validation tests.

## Employee custom employment category enum failure (2026-10-15)

The latest rerun reached `submitTicket: Pending` for the Employee initial record but also returned `invalid input value for enum "employeeRole"` with the custom employment description as the value. PostgreSQL accepts only the fixed enum values; the prior backend helper incorrectly wrote free text into that enum column. The Student initial workflow passed. Student and Employee update workflows stopped before login because dedicated approved QA credentials were not configured; those failures are configuration blockers, not submission errors.

The local correction keeps the enum value (`Other`) in `employee_profile.role` and stores the description in a new nullable `employmentCategoryOther` text column. It also reads that value back for profiles. Apply `schemas/migrations/20261015_employee_category_other.psql` to the target database before using the corrected backend. The migration only adds a nullable column and preserves existing rows. Do not use the database reset action to apply it.

## Deployed custom-choice rerun on 2026-10-19

- Student initial registration and custom-choice submission passed. Its generated credentials are saved locally; its ticket is Pending and must be approved by staff before update testing. The update workflow reused the saved account and stopped at the Pending eligibility check without submitting an update.
- Employee initial submission returned `submitTicket: Pending` together with `column "employmentCategoryOther" of relation "employee_profile" does not exist`. The account is retained locally but marked unready. The response indicates a partial submission may exist; it was not cancelled or cleaned up.
- The Student and Employee credential values in `.env.e2e` were sample placeholders. The runner now ignores a complete pair of sample values and falls back to the local registry.
- CI now has a `migrate-employee-category` manual operation. Run it from the `deployment` branch to apply and verify the additive migration without resetting the database. Then rerun `employee-initial.spec.js`; that creates a new QA account. After staff approval, rerun the update workflows.
- Employee batch errors with a returned Pending status now trigger readback diagnostics before the test ends, so future reports can identify any persisted sections and ticket ID.

## Deployed custom-choice rerun after CI database recreation (2026-10-20)

The push workflow completed the patient/staff build and deployment, and its `schema-init` step recreated the database. The Employee initial rerun still returned `column "employmentCategoryOther" of relation "employee_profile" does not exist`, and authenticated `getPatientBasicInfo` readback failed on the same missing column. The committed schema file contains the column, so the Pi's Compose `SCHEMA_SQL_PATH` is not applying that current definition during initialization. This is inferred from the successful schema-init followed by the repeated missing-column response.

`scripts/apply-employee-category-migration.js` now applies the committed additive SQL and verifies the column after CI deployment setup, manual database reset, and the standalone migration action. This makes the required field independent of the schema file configured in the Pi's local `.env`. The standalone migration preserves rows; the existing push and manual reset flows still remove database volumes as configured.

The post-deployment Employee test still produced a partial Pending ticket and the app attempted to cancel a record after its batch error. The E2E guard blocked cancellation; no test cleanup was performed. Student initial passed with Pending ticket 1. Student update stops at staff approval, and Employee update has no eligible saved QA account. After the additive migration runs, rerun Employee initial and inspect its Pending readback before staff approval or update testing.

## Post-reset custom-choice rerun (2026-10-20)

After the user reset the deployed database, `student-initial.spec.js` passed against the deployed site. It created Student ticket 1 with status Pending, and the pending ticket's section readbacks and exact saved-value comparisons passed. The browser also received a GraphQL error from the shared `getMyProfile` query: `column ep.employmentCategoryOther does not exist`. This confirms the reset workflow recreated the schema without the additive Employee category migration; it is a separate backend schema error that the Student workflow currently records but does not fail on.

The Student update preflight was rerun without submitting an update. It found the current Student ticket Pending, so staff approval is required; an older saved account was also rejected as `INVALID_CREDENTIALS` and marked stale in the local account registry. Employee initial and update runs remain blocked until the migration is applied and an Employee initial record is approved. Use the CI workflow's `migrate-employee-category` operation on `deployment`; this applies the additive SQL without resetting the database or removing Student ticket 1.

## Post-migration custom-choice rerun (2026-10-20)

GitHub Actions run `39295559388` completed the `migrate-employee-category` job successfully and skipped database reset. The subsequent deployed Employee initial workflow passed: ticket 2 is Pending with scope Both, all 63 recorded comparisons matched, and no GraphQL errors were observed. This confirms the employee-category migration removed the previous backend submission blocker.

The Employee update eligibility workflow logged in with the saved Employee QA account and stopped before submission because ticket 2 is Pending. Student ticket 1 also remains Pending. Both update workflows need staff approval before their custom-choice update paths can be exercised; no approvals or updates were made.

The subsequent eligibility rechecks again found Student ticket 1 and Employee ticket 2 Pending. Both stopped in the read-only eligibility step and created no update tickets.
