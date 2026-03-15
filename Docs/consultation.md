# Consultation Module

Medical staff create, open, and manage patient consultations. Only the **medical/staff endpoint** exposes this module — patients have no direct access.

---

## Endpoint

```
POST /consultation
Middleware: jwtProtect("medical")
```

---

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `CONSULTATION_MODE` | `Onsite`, `Virtual` |
| `CONSULTATION_TYPE` | `Medical`, `Dental` |
| `CONSULTATION_STATUS` | `Created`, `Open`, `ReOpen`, `Completed`, `Referred`, `Monitored` |
| `CONSULTATION_STATUS_INPUT` | `Completed`, `Referred`, `Monitored` |
| `DIAGNOSIS_TYPE` | `Primary`, `Secondary`, `Differential`, `RuledOut`, `Provisional`, `Complication`, `Chronic`, `FollowUp` |

### Types

**Consultation**
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `followUpId` | `ID` | Self-referencing FK to a previous consultation |
| `patientId` | `ID!` | |
| `mode` | `CONSULTATION_MODE!` | Onsite or Virtual |
| `type` | `CONSULTATION_TYPE!` | Medical or Dental |
| `status` | `CONSULTATION_STATUS!` | Current lifecycle state |
| `notes` | `String` | Free-text notes |
| `updatedAt` | `Date!` | |
| `createdAt` | `Date!` | |

**ConsultationOutcome** (one consultation can have multiple outcomes via re-opening)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `consultationId` | `ID!` | |
| `remarks` | `String` | |
| `complaints` | `[ConsultationComplaints!]!` | |
| `peFindings` | `[ConsultationPEFindings!]!` | Physical examination findings |
| `treatments` | `[ConsultationTreatment!]!` | |
| `diagnoses` | `[ConsultationDiagnosis!]!` | |
| `recordedBy` | `ID!` | Staff who created the outcome |
| `recordedAt` | `Date!` | |

**ConsultationDiagnosis**
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `outcomeId` | `ID!` | |
| `diagnosisName` | `String!` | |
| `icdId` | `ID!` | FK to ICDLookup |
| `type` | `DIAGNOSIS_TYPE!` | |
| `notes` | `String` | |

**ICDrecord** (returned by ICD lookup queries)
| Field | Type |
|-------|------|
| `id` | `ID!` |
| `code` | `String!` |
| `title` | `String!` |

---

## Queries

| Query | Permission | Parameters | Description |
|-------|------------|------------|-------------|
| `getConsultations` | `consultation_allow_view` (branch-matched) | `patientId!, offset?, limit?` | List consultations for a patient, ordered by `updatedAt DESC` |
| `getOutcomes` | `consultation_allow_view` | `consultationId!, offset?, limit?` | Get all outcomes for a consultation with nested complaints, PE findings, treatments, diagnoses (fetched in parallel) |
| `getComplaints` | `consultation_allow_view` | `outcomeId!, offset?, limit?` | List complaints for an outcome |
| `getPEFindings` | `consultation_allow_view` | `outcomeId!, offset?, limit?` | List PE findings for an outcome |
| `getTreatments` | `consultation_allow_view` | `outcomeId!, offset?, limit?` | List treatments for an outcome |
| `getDiagnoses` | `consultation_allow_view` | `outcomeId!, offset?, limit?` | List diagnoses for an outcome |
| `getIcdViaCode` | user auth only | `code!` | Search ICD-11 by code (DB cache, falls back to WHO API) |
| `getIcdViaTitle` | user auth only | `title!` | Search ICD-11 by title |
| `getIcdDetails` | user auth only | `id!` | Get full ICD entity details from WHO API |

---

## Mutations

### Lifecycle

| Mutation | Permission | Parameters | Description |
|----------|------------|------------|-------------|
| `createConsultation` | `consultation_allow_edit` | `input: ConsultationInput` | Creates a consultation with status `Created` |
| `openConsultation` | `consultation_allow_edit` | `input: ConsultationOutcomeInput!` | Sets status to `Open`, creates an outcome with complaints, PE findings, treatments, diagnoses (transaction) |
| `submitConsultation` | `consultation_allow_edit` | `consultationId!, status!` | Closes the consultation (`Completed` / `Referred` / `Monitored`). Only the staff who recorded the outcome can submit |
| `reOpenConsultation` | `consultation_allow_edit` | `input: ConsultationOutcomeInput!` | Sets status to `ReOpen`, creates a **new** outcome record (same logic as open) |

### Updates (only while status is `Open` or `ReOpen`)

| Mutation | Permission | Ownership Check | Parameters | Description |
|----------|------------|-----------------|------------|-------------|
| `updateConsultationNotes` | `consultation_allow_edit` | No | `consultationId!, notes!` | Update consultation notes |
| `updateConsultationFollowUpId` | `consultation_allow_edit` | No | `consultationId!, followUpId!` | Link to a follow-up consultation |
| `updateOutcomeRemarks` | `consultation_allow_edit` | `recordedBy === user.id` | `consultationId!, remarks!` | Update outcome remarks |
| `updateComplaints` | `consultation_allow_edit` | `recordedBy === user.id` | `consultationId!, complaints!` | Delete-and-reinsert all complaints |
| `updatePEFindings` | `consultation_allow_edit` | `recordedBy === user.id` | `consultationId!, findings!` | Delete-and-reinsert all PE findings |
| `updateTreatments` | `consultation_allow_edit` | `recordedBy === user.id` | `consultationId!, treatments!` | Delete-and-reinsert all treatments |
| `updateDiagnoses` | `consultation_allow_edit` | `recordedBy === user.id` | `consultationId!, diagnoses!` | Delete-and-reinsert all diagnoses |

---

## State Machine

```
Created ──[openConsultation]──> Open ──[submitConsultation]──> Completed
                                  │                            Referred
                                  │                            Monitored
                                  │                               │
                                  │                    [reOpenConsultation]
                                  │                               │
                                  │                               v
                                  │                            ReOpen ──[submitConsultation]──> Completed
                                  │                                                            Referred
                                  │                                                            Monitored
```

- **Created** -- initial state, no outcome yet.
- **Open / ReOpen** -- an outcome is actively being recorded. Notes and sub-data are editable.
- **Completed / Referred / Monitored** -- terminal states. Can only transition via `reOpenConsultation` which creates a new outcome.

---

## Database Tables

### Consultation
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | Auto-generated |
| `followUpId` | FK (nullable) | Self-referencing |
| `patientId` | FK | References `UsersPersonal.id` |
| `mode` | Enum | `Onsite`, `Virtual` |
| `type` | Enum | `Medical`, `Dental` |
| `status` | Enum | Lifecycle state |
| `notes` | Text (nullable) | |
| `updatedAt` | Timestamp | Updated on status changes |
| `createdAt` | Timestamp | |

### ConsultationOutcome
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `consultationId` | FK | |
| `recordedBy` | FK | Staff who created it (ownership enforcement) |
| `remarks` | Text (nullable) | |
| `recordedAt` | Timestamp | |

### ConsultationComplaints / ConsultationPEFindings / ConsultationTreatment
| Column | Type |
|--------|------|
| `id` | PK |
| `outcomeId` | FK |
| `complaint` / `finding` / `treatment` | Text |

### ConsultationDiagnosis
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `outcomeId` | FK | |
| `diagnosisName` | Text | |
| `icdId` | FK | References `ICDLookup.id` |
| `diagnosisType` | PG Enum (`DiagnosisType`) | |
| `notes` | Text (nullable) | |

### ICDLookup
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `code` | Text | ICD-11 code |
| `title` | Text | |
| `stemData` | Text | WHO API stem URL |
| `release` | Text | ICD release version |
| `updated_at` / `created_at` | Timestamp | |

---

## Auth & Permissions

- **JWT** -- `jwtProtect("medical")` validates token, verifies medical identity in DB, checks session anchor in Redis.
- **RBAC** -- every resolver calls `permit.isMedicalPermitted(user.id, permission, patientId?)`.
  - Admin users bypass all permission checks.
  - When `patientId` is provided, the staff's branch must match the patient's branch.
  - If the patient's identity is `"Superior"`, the staff must also hold `PRIVILEGED_TO_PERFORM_ON_SUPERIOR`.

| Permission Key | Maps To | Used By |
|----------------|---------|---------|
| `consultation_allow_view` | `ALLOW_TO_VIEW_CONSULTATION` | All queries |
| `consultation_allow_edit` | `ALLOW_TO_EDIT_CONSULTATION` | All mutations |

---

## Socket Emissions

None. The consultation module does not emit any socket events.

---

## ICD-11 Integration

ICD queries use a **cache-first** strategy:

1. Check the local `ICDLookup` PostgreSQL table.
2. If not found (or stale), fetch from the WHO ICD-11 API (`icdapi.js`).
3. Store the result in `ICDLookup` for future lookups.
4. OAuth tokens for the WHO API are managed by `tokenauth.js` with automatic refresh.

---

## File Structure

```
routes/consultation/consult/
  schema.graphql                          # Type definitions
  graphql.js                              # Express GraphQL route setup
  resolvers/
    medical/medical-resolver.js           # Permission-checking layer (public API)
    wrapper/wrapper.js                    # Database logic layer (internal API)
    wrapper/helper.js                     # Shared helpers (getLatestOutcome, groupByOutcome, etc.)
```
