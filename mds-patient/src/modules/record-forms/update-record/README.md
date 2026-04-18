# Update Record Module

This module implements the patient update-record workflow for medical, dental, or combined record updates.

## Scope

Path: `mds-patient/src/modules/record-forms/update-record/`

Used in the patient portal to collect update submissions and route them through update-ticket review flow.

## Main Behaviors

- Dynamic flow by selected record type:
  - `medical`
  - `dental`
  - `both`
- Update ticket management:
  - checks existing ticket status
  - warns before replacing `Pending` submissions
  - supports revision mode (`Revision` status + staff notes)
- Revision prefill:
  - fetches previous submitted data
  - hydrates form fields before resubmission
- Catalog-backed forms:
  - loads medical/dental catalogs from backend
  - supports searching/creating catalog entries in selected sections
- Validation and submission safety:
  - per-step required-field checks
  - modal-based validation and server error reporting
  - dental photo staging and media cleanup support in service layer

## Form Flow

Record type determines visible steps:

- Medical only: Personal Info -> Medical History -> Review & Submit
- Dental only: Personal Info -> Dental History -> Review & Submit
- Both: Personal Info -> Medical History -> Dental History -> Review & Submit

## Primary Component

`record-update-form.jsx`

Key props:

- `forceRecordType`
- `skipPersonalStep`
- `skipPersonalSubmit`
- `hideRecordChoice`
- `onSubmissionSuccess`
- `isInactiveMode`

## File Map

| File | Responsibility |
| --- | --- |
| `record-update-form.jsx` | Parent orchestrator for steps, validation, revision banner/modal, pending warning, and submit lifecycle. |
| `record-choice-page.jsx` | Full-page record-type selector before step flow begins. |
| `progress-stepper.jsx` | Step indicator UI. |
| `personal-info-step.jsx` | Program search, student category, emergency contacts. |
| `medical-history-step.jsx` | Medical background/history workflow with catalog fetch and dynamic "other" creation. |
| `dental-history-step.jsx` | Dental visit history, appliances, procedures, and dental photo inputs. |
| `review-step.jsx` | Read-only review and per-section edit jump points before submit. |
| `personal-info-service.jsx` | GraphQL operations for student profile + emergency contacts. |
| `medical-history-service.jsx` | Catalog retrieval for medical sections. |
| `dental-history-service.jsx` | Catalog retrieval for dental sections. |
| `update-record-service.jsx` | Ticket lifecycle, prefill mapping, media staging, and medical/dental submit orchestration. |
| `update-record-modal.jsx` | Modal wrapper integration variant for this module. |
| `form-elements.jsx` | Shared UI primitives used by step components. |

## Service Layer Highlights

`update-record-service.jsx` includes:

- Ticket status methods:
  - `getUpdateTicketStatus`
  - `getUpdateRevisionStatus`
  - `createUpdateTicket`
  - `submitUpdateTicket`
  - `cancelUpdateTicket`
- Revision preload helpers:
  - `fetchUpdateRevisionPrefill`
  - `fetchDentalPhotoAsBlob`
- Domain submit helpers:
  - `submitMedicalUpdate`
  - `submitDentalUpdate`
  - `submitUpdateRecord`

## Endpoint Usage

- GraphQL endpoint: `/emr/patient`
- Media staging endpoints:
  - `POST /media/stage/`
  - `DELETE /media/unstage/:fileId`
  - `GET /media/record/dentalPhoto/:fileId`

## Usage Example

```jsx
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';

export default function UpdatePage() {
  return <RecordUpdateForm />;
}
```

## Dependencies

- React
- Tailwind CSS styles from patient app design system
- GraphQL backend routes exposed via patient API
- Shared core adapters (`@core` / package-core adapter)
