# Pending Review System — Implementation Documentation

## Summary

Implemented a two-step staff-side pending review system for patient record submissions (initial records, record updates). Staff can now:

1. **View ticket summary** (Step 1) — See patient name, ID, scope, status, branch
2. **Review full patient record** (Step 2) — Click "Review Full Record" to see all patient-submitted data organized by sections
3. **Edit patient data** — Fix typos/errors inline with mandatory edit reason (DPA compliance)
4. **Approve / Request Revision** — Take action from either the summary or the full review modal

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `mds-staff/src/modules/pending-requests/patient-record-service.js` | ~360 | GraphQL service layer — fetches all patient record sections via existing backend queries. Includes `fetchPatientRecordForReview()` aggregate fetcher that loads data in parallel based on ticket scope. |
| `mds-staff/src/modules/pending-requests/components/record-review-modal.jsx` | ~380 | **RecordReviewModal** — The main Step 2 component. Full-screen modal displaying all patient data organized by sections. Handles section-based editing, DPA confirmation dialog, approve/revision actions. |
| `mds-staff/src/modules/pending-requests/components/review-sections/SectionWrapper.jsx` | ~240 | Shared section chrome — collapsible headers, edit toggle button, DPA reason field, "Modified by Staff" badge, role-based lock state. Also exports `DataRow`, `EditableField`, and `SectionSkeleton` utilities. |
| `mds-staff/src/modules/pending-requests/components/review-sections/PersonalInfoSection.jsx` | ~130 | Displays patient personal info (name, sex, identifier, branch) and school/employee info with inline editing support. |
| `mds-staff/src/modules/pending-requests/components/review-sections/EmergencyContactSection.jsx` | ~110 | Displays two emergency contacts (name, relationship, number) with inline editing. |
| `mds-staff/src/modules/pending-requests/components/review-sections/MedicalHistorySection.jsx` | ~110 | Displays self-reported and family medical conditions as badges/list. |
| `mds-staff/src/modules/pending-requests/components/review-sections/MedicalBackgroundSection.jsx` | ~250 | Composite section: allergies, immunizations, hospitalizations, operations, medications, lifestyle, visual acuity, vital signs. |
| `mds-staff/src/modules/pending-requests/components/review-sections/DentalHistorySection.jsx` | ~180 | Dental visit history, dental procedures table, oral appliances table. |
| `mds-staff/src/modules/pending-requests/components/review-sections/ObGyneSection.jsx` | ~70 | OB-GYNE history (female patients only). |
| `mds-staff/src/modules/pending-requests/components/review-sections/index.js` | ~8 | Barrel export for all section components. |
| `Docs/PENDING_REVIEW_IMPLEMENTATION_PLAN.md` | ~80 | Architecture plan document with scope mapping tables and design notes. |

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `initial-record-detail-modal.jsx` | Added `RecordReviewModal` import, `showReviewModal` state, "Review Full Record" gradient button after ticket info, renders `RecordReviewModal` when open. Accepts new `staffRole` prop. | Implements Step 1 → Step 2 transition. Staff sees summary first, then clicks to review full record. |
| `initial-record-list.jsx` | Added `staffRole` prop (default `'both'`), passes it to `InitialRecordDetailModal`. | Enables role-based access control to flow from page → list → modal → review. |
| `PendingRequests.jsx` | "Record Update" filter type now renders `<InitialRecordList />` (same as Initial Record) instead of the old mock-data table. | Both Initial Record and Record Update use the same backend (`patientUpdateLog`), so they share the same UI component. |

---

## Architecture

```
PendingRequests.jsx
  ├── filterType === 'Initial Record'  → <InitialRecordList />
  ├── filterType === 'Record Update'   → <InitialRecordList />
  └── filterType === other             → legacy table + modals

InitialRecordList (staffRole)
  └── click row → <InitialRecordDetailModal> (Step 1)
                    ├── Ticket summary (name, ID, scope, status, branch)
                    ├── [Review Full Record] button
                    │      └── <RecordReviewModal> (Step 2)
                    │            ├── <PersonalInfoSection>
                    │            ├── <EmergencyContactSection>
                    │            ├── <MedicalHistorySection>
                    │            ├── <MedicalBackgroundSection>
                    │            ├── <DentalHistorySection>
                    │            ├── <ObGyneSection>
                    │            └── [Approve] / [Request Revision]
                    └── Quick actions (Approve / Revision) without full review
```

## Data Flow

```
RecordReviewModal
  → fetchPatientRecordForReview(patientId, scope, sex)
    → Promise.allSettled([
        getPatientBasicInfo(userId),       // always
        getUserProfile(userId),            // always
        getUserEmergencyContact(userId),   // medical scope
        getUserMedicalHistory(userId),     // medical scope
        getUserLifestyle(userId),          // medical scope
        getUserAllergyProfile(userId),     // medical scope
        getUserMedicationProfile(userId),  // medical scope
        ...                                // etc.
      ])
    → POST /emr/medical  (GraphQL, JWT-guarded)
    → Backend resolvers (permit.isMedicalPermitted check)
    → PostgreSQL
```

## Scope → Section Mapping

| Scope    | Personal Info | Emergency | Medical History | Medical Background | Dental History | OB-GYNE |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| Medical  | ✓ | ✓ | ✓ | ✓ | — | ✓ (female) |
| Dental   | ✓ | — | — | — | ✓ | — |
| Both     | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (female) |

## Role-Based Access

| Staff Role    | Medical Sections | Dental Sections |
|---------------|:---:|:---:|
| Medical Staff | Full access + edit | Locked (shows "Not accessible") |
| Dental Staff  | Locked | Full access + edit |
| Admin / Both  | Full access + edit | Full access + edit |

Pass `staffRole` prop: `<InitialRecordList staffRole="medical" />` (or `"dental"` / `"both"`)

## DPA Compliance Features

1. **Edit toggle per section** — Each section has an "Edit" button visible only for Pending/RevisionSubmitted tickets
2. **Mandatory edit reason** — When editing is enabled, a text field appears requiring a reason (e.g., "Corrected typo in patient name")
3. **Original value preservation** — Edited fields show the original value with strikethrough
4. **"Modified by Staff" badge** — Sections with edits display a warning badge
5. **Edit summary panel** — Before approval, a summary shows all edited sections and their reasons
6. **DPA confirmation dialog** — When approving with edits, a confirmation dialog requires explicit acknowledgment of DPA responsibility
7. **Audit trail ready** — `UpdateChangesLog` table in the database schema supports recording field-level changes

## Known Limitations / TODOs

- **Backend edit submission**: The `handleApprove` in `RecordReviewModal` has a TODO comment for submitting staff edits via the existing `update*` mutations before approving. The edit state tracking is fully implemented on the frontend; the backend call needs to be wired per mutation type.
- **Revision notes**: The revision note from `handleRequestRevision` is not sent to the backend because the `staffUpdateTicket` mutation doesn't accept a `notes` parameter yet (noted in the initial service file).
- **Catalog resolution**: Allergen, vaccine, procedure IDs are displayed as `#ID` rather than human-readable names. A catalog lookup cache should be added to resolve these IDs to names.
- **staffRole detection**: Currently passed as a prop. Should be derived from the auth context / user role when that information is available in the staff portal's auth state.
