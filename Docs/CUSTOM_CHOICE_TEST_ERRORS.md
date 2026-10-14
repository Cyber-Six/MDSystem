# Patient-defined choice investigation

The custom-choice suite reports defects without changing application code or schema. Opted-in deployment runs do create synthetic catalog entries and pending QA records. Run `E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices` from Git Bash to generate the current investigation report at `e2e-results/custom-choices/errors.md` and structured evidence at `e2e-results/custom-choices/results.json`.

Initial record submissions are expected to create a **Pending** ticket. Pending is the successful patient submission state before staff review; these workflows do not require approval. Batch errors report the HTTP status, GraphQL errors, and returned `submitTicket` value before Pending ticket and section readback starts. A report that stops at registration or credential preflight did not submit a record.

The `deployment` CI workflow labels each built Docker image with its source commit and checks the image revision used by the running patient and staff containers after deployment. A revision mismatch indicates stale containers and fails the workflow. Run `npm run test:custom-choice-diagnostics` to check response handling, readback field coverage, role-specific update input mapping, and image revision checks without contacting the deployed site.

The report identifies each attempted workflow, failed step, reproduction command, sanitized request/response, and any expected/actual saved-value comparisons that were reached. Credentials, session tokens, and authorization headers are excluded. Test artifacts stay ignored by Git.

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

The local correction keeps the enum value (`Other`) in `employee_profile.role` and stores the description in a new nullable `employmentCategoryOther` text column. It also reads that value back for profiles. Apply `schemas/migrations/20261015_employee_category_other.psql` to the target database **before deploying the corrected backend**. The migration only adds a nullable column and preserves existing rows. Do not use the database reset action to apply it.
