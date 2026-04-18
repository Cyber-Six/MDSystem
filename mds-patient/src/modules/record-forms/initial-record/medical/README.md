# Initial Medical Record Module

This module implements the multi-step initial record workflow used after first login (and for revision/resubmission paths).

## Scope

Path: `mds-patient/src/modules/record-forms/initial-record/medical/`

## What It Handles

- Initial personal, medical, and dental intake submission
- Female-specific OB-GYNE step with automatic skip for non-female profiles
- Revision prefill merge when staff requests corrections
- Catalog-driven options loaded from backend
- Final validation on submit with section-targeted error feedback

## Step Sequence

Default sequence:

1. Personal Info
2. Medical History
3. Medical Background
4. Dental History
5. OB-GYNE (female only)
6. Review

For non-female users, OB-GYNE is skipped in navigation and step count.

## Runtime Behavior

- Catalogs are loaded through `fetchAllCatalogs()`.
- Non-revision flow pre-creates/ensures update ticket context via `ensureUpdateTicket('Both')`.
- Submission delegates to `createInitialMedicalRecord()` from shared EMR service.
- Validation issues and backend errors are surfaced through `ValidationWarningModal`.
- Component supports standalone page mode and embedded modal mode.

## Props (Main Component)

`initial-medical-record-form.jsx` accepts:

- `onComplete`
- `isModal`
- `revisionData`
- `isRevision`
- `staffNote`

## File Map

| File | Responsibility |
| --- | --- |
| `initial-medical-record-form.jsx` | Parent controller: step state, validation, submit lifecycle, modal/standalone behavior. |
| `personal-info.jsx` | Personal/school info + emergency contacts with program search. |
| `medical-history.jsx` | Self/family condition selection with catalog search/create support. |
| `medical-background.jsx` | Immunizations, allergies, hospitalization, operation, medication, lifestyle, visual acuity sections. |
| `dental-history.jsx` | Dental history, appliances, procedures, and photo uploads. |
| `obygyne.jsx` | OB-GYNE fields for female profile flow. |
| `review-form.jsx` | End-of-flow summary with edit shortcuts and certification input. |
| `progress-stepper.jsx` | Step progress indicator. |
| `form-elements.jsx` | Reusable form controls/buttons used by all steps. |

## Integration Points

- Uses shared services from `@core/services/emr-service`
  - `createInitialMedicalRecord`
  - `fetchAllCatalogs`
  - `ensureUpdateTicket`
- Uses shared utilities from `@core/utils/data-transformer`
  - `sanitizeFormData`
  - `logDataStructure`

## Route Integration Example

```jsx
import InitialMedicalRecordForm from '@/modules/record-forms/initial-record/medical/initial-medical-record-form';

<Route path="/initial-medical-record" element={<InitialMedicalRecordForm />} />
```

## Notes

- Step-to-step navigation does not block with full validation; comprehensive validation runs at submission.
- Submission success can call `onComplete(result)` or fallback to dashboard navigation.
