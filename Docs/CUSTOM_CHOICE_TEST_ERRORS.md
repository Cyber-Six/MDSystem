# Patient-defined choice investigation

The suite reports defects without changing application behavior. Run `E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices` from Git Bash to generate the current investigation report at `e2e-results/custom-choices/errors.md` and structured evidence at `e2e-results/custom-choices/results.json`.

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

The exact per-workflow requests, returned catalog IDs, expected inputs, comparisons, and responses are in the ignored run report. Syntax, four-file discovery, seven readback queries against the schema, evidence redaction, and the three existing mocked registration-validation tests passed. Discovery still finds all ten original account tests plus three validation tests. Application/schema fixes were not made for these findings.
