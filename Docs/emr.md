# Electronic Medical Record (EMR) - Patient Endpoint

## Initial patient submission and failure diagnosis

The active patient intake uses two GraphQL endpoints. The patient server mounts
`/profile/patient` and `/emr/patient`, plus the medical and staff EMR endpoints.
The staff server mounts `/profile/medical`, `/emr/medical`, and `/staff/emr`.
The read-only `/emr` description below is historical; use the mounted schemas
and resolvers for the current contract.

1. `initial-medical-record-form.jsx` calls `createInitialMedicalRecord` in
   `mds-patient/src/services/emr-service.js`. Personal fields and the identifier
   go first to `createInitialPersonalRecord` at `/profile/patient`.
2. The patient profile resolver checks authentication, Unverified credentials,
   existing personal/EMR revision state, and the email-derived branch. Its
   transaction inserts a Pending `UsersPersonalLog` (or updates the existing
   revision log), upserts `UsersPersonal` branch/identifier, and commits.
   An insert/upsert failure rolls back; the public GraphQL error masks the
   underlying error logged by `_PersonalRecordLog` or `_UserBranchIdentifier`.
   This happens before ticket resolution, photo staging, or the EMR batch.
3. After personal setup, web resolves/creates the EMR ticket and stages photos,
   fetches catalogs, then sends one serial GraphQL mutation at `/emr/patient`.
   `createMedicalHistory` and `createImmunizationProfile` enforce ticket ownership,
   scope, and editable status, then call the shared mutation wrapper and anchors.
   Each anchor inserts only `id`. Readback selects the anchor ID and ticket
   metadata explicitly. Child rows store conditions/relationships and
   vaccine IDs/dates/doses. `submitUpdateTicket` executes last. GraphQL can continue
   after a nullable mutation field fails, so a failed anchor can also produce the
   subsequent required-record error. Completeness validation remains mandatory.

MedicalHistory and Immunization no longer store profile-level notes. Current
web/mobile submissions, prefill, staff review, and history readback omit them.
For installed mobile clients, optional legacy input fields remain accepted and
ignored; deprecated output fields always resolve to null. Other profile, child,
and ticket notes retain their existing behavior. Catalog-backed custom choices
remain child records. Old profile notes and free text carried only in those
retired fields are no longer saved or displayed; existing database columns and
values, where present, are not deleted. Do not apply the historical profile-notes
migration for this fix; the disposable E2E harness no longer installs it.

A separate local schema defect was confirmed: `UsersPersonalLog_id_fkey` targets
the independently generated log `id` instead of owner `user_id`. When there is
no credential with the generated log ID, PostgreSQL raises `23503`. The original
incident logs were unavailable, so the screenshot alone cannot identify that
incident's exact underlying exception. The defect was reproduced using synthetic
tables with the inspected constraint definition.

The personal-log constraint remains unchanged. No database repair or migration
is included or authorized. An application workaround that forces log IDs to match
user IDs would break independent log history and repeat submissions; it is not
used. The personal-record failure therefore remains unresolved at the schema
level under the no-database-changes constraint.

Run `node scripts/test-initial-record-db.js` for the synthetic PostgreSQL
regression using the already-local `postgres:17-bookworm` image. It captures
the application's SQL, starts a disposable container without network, published
ports, or mounts, and reads no `.env`. It checks the original foreign-key
and notes failures, notes-free inserts, and unchanged completeness. Unit tests additionally cover GraphQL
masking/rollback, mobile compatibility, submission ordering, and client payloads.

A synthetic browser/device submission followed by staff review/readback is
still needed in the intended test environment. Capture only the PostgreSQL
code, table, and constraint from any remaining personal-record failure. The
generic client message does not identify the failing SQL operation.

On 2026-11-28, 183 tests passed across 18 Jest suites and 36 Node diagnostics
passed. An earlier disposable PostgreSQL run reproduced `23503` and verified
notes-free completeness. The latest application checks were:

```powershell
npm.cmd test -- --selectProjects backend patient staff mobile --runTestsByPath `
  Backend/routes/emr/query/anchor.test.js `
  Backend/routes/emr/wrapper/mutation.test.js `
  Backend/routes/emr/wrapper/query.test.js `
  Backend/routes/emr/retired-profile-notes.test.js `
  Backend/routes/profile/resolvers/patient/initial-personal-record.test.js `
  Backend/routes/profile/resolvers/patient/patient-resolver.test.js `
  Backend/routes/profile/resolvers/wrapper/wrapper.test.js `
  Backend/routes/emr/graphql.test.js `
  Backend/routes/emr/resolvers/patient/mutation.test.js `
  Backend/routes/emr/resolvers/record-validator.test.js `
  mds-patient/src/services/initial-submission.test.js `
  mds-patient/src/modules/record-forms/update-record/__tests__/update-record-service.test.js `
  mds-patient/src/modules/record-forms/initial-record/medical/initial-medical-record-form.test.js `
  mds-patient/src/modules/record-forms/initial-record/review-components.test.js `
  mds-mobile/src/__tests__/emrServiceEmployeeProfile.test.ts `
  mds-mobile/src/__tests__/initialRecordFormValidation.test.ts `
  mds-staff/src/modules/pending-requests/patient-record-service.test.js `
  mds-staff/src/modules/search-patient/patient-record-data.test.js --silent
node --test e2e/staff-records/*.test.js e2e/custom-choices/workflow-readback.test.js scripts/apply-employee-category-migration.test.js
git -c core.safecrlf=false diff --check
```

The **Patient EMR** endpoint (`/emr`) provides read-only access to patient medical records. Patients can view their own health data including vital signs, dental records, allergies, medical history, and other clinical information.

---

## Endpoint

```
POST /emr
Middleware: jwtProtect("patient")
```

---

## Overview

This endpoint is accessible **only to patients**. It provides read-only queries to fetch personal medical records and history. Staff members cannot access this endpoint—they use `/staff/emr` instead.

**Key Responsibility:** Allows authenticated patients to view their complete medical profile and history.

---

## Permissions

All queries require patient authentication only. No additional permission checks are needed beyond JWT validation.

---

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `DentalLegend` | `PRESENT`, `DUE_FILLING_DECAYED`, `DUE_EXTRACTION`, `ROOT_FRAGMENT`, `MISSING_DUE_TO_CARIES`, `MISSING_DUE_TO_OTHER_CAUSES`, `IMPACTED_TOOTH`, `SUPERNUMERARY_TOOTH`, `UNERUPTED`, `ECTOPIC_ERUPTION`, `DIASTEMA`, `ROTATED`, `FRACTURE`, `ABRADED`, `ATTRITION`, `MOBILITY`, `AMALGAM_FILLING`, `COMPOSITE_FILLING`, `GOLD_FILLING`, `INLAY_FILLING`, `CEMENTED_CROWN`, `BRIDGE_ABUTMENT`, `PONTIC`, `ROOT_CANAL`, `EXTRACTION`, `JACKET_CROWN` |
| `DomainType` | `VisualAcuity`, `MedicalCondition`, `Medication`, `Hospitalization`, `Operation`, `Immunization`, `DentalProcedure` |
| `UpdateStatus` | `InProgress`, `Pending`, `Revision`, `RevisionSubmitted`, `Cancelled`, `Expired`, `Approved`, `Rejected` |
| `UpdateScope` | `Medical`, `Dental`, `Both` |
| `ALLERGEN_TYPE` | `Food`, `Drug`, `Environmental`, `Insect`, `Chemical`, `Other` |
| `allergy_status` | `Active`, `Resolved`, `Suspected` |
| `severity` | `Mild`, `Moderate`, `Severe`, `Unknown` |
| `arch_designation` | `None`, `Upper`, `Lower`, `Both` |
| `appliance_status` | `Active`, `Lost`, `Replaced`, `Discontinued`, `Pending`, `Returned`, `Failed` |
| `DesignationBranch` | `Manila`, `QuezonCity`, `Both` |

### Core Types

#### VitalSigns
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `height_cm` | `Float!` | Height in centimeters |
| `weight_kg` | `Float!` | Weight in kilograms |
| `blood_pressure` | `String!` | Format: "120/80" |
| `heart_rate` | `Int!` | Beats per minute |
| `temperature` | `Float!` | Celsius |
| `notes` | `String` | Additional clinical notes |
| `recorded_at` | `Date` | When measurements were taken |
| `created_at` | `Date` | Record creation timestamp |

#### DentalRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `notes` | `String` | Clinical notes |
| `ToothPlacements` | `[ToothPlacement!]!` | Tooth-specific findings |
| `oralFindings` | `[OralFindingRecord!]!` | Oral health observations |
| `created_at` | `Date` | Record creation timestamp |

#### ToothPlacement
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `toothIndex` | `Int!` | Tooth number/position (1-32) |
| `legend` | `DentalLegend!` | Tooth status/condition |

#### OralFindingRecord
| Field | Type | Description |
|-------|------|-------------|
| `oralFindingId` | `ID!` | FK to OralFindingCatalog |
| `status` | `String!` | Observation status |
| `notes` | `String` | Additional notes |

#### OralFindingCatalog
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `name` | `String!` | Finding name (e.g., "Gingival Inflammation") |
| `description` | `String` | Detailed description |
| `isActive` | `Boolean!` | Whether catalog entry is active |
| `created_at` | `Date` | Creation timestamp |

#### AllergyProfile
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `allergyRecords` | `[AllergyRecord!]!` | Individual allergy entries |
| `status` | `UpdateStatus` | Profile status (Approved, InProgress, etc.) |

#### AllergyRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `allergen` | `String!` | Allergen name |
| `type` | `ALLERGEN_TYPE!` | Allergen category |
| `status` | `allergy_status!` | Current status (Active, Resolved, Suspected) |
| `severity` | `severity!` | Reaction severity |
| `date_identified` | `Date` | When allergy was identified |

#### DentalHistory
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `seenByDentist` | `Boolean!` | Visit history |
| `lastVisitDate` | `Date` | Last dental visit |
| `purpose` | `String` | Reason for last visit |
| `lastDentalCleaning` | `String` | Cleaning frequency range |
| `status` | `UpdateStatus` | Profile status |

#### OralApplianceProfile
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `applianceRecords` | `[OralApplianceRecord!]!` | Active appliances |
| `status` | `UpdateStatus` | Profile status |

#### OralApplianceRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `applianceName` | `String!` | Type of appliance |
| `status` | `appliance_status!` | Current status |
| `dateIssued` | `Date` | When appliance was issued |
| `arch` | `arch_designation!` | Which arch (Upper/Lower/Both) |

#### MedicalHistory / Hospitalization / Operation / Immunization
Patterns for capturing medical events with associated catalog types.

---

## Queries

### Profile Updates
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getUpdateTicket` | None | `UpdateTicket` | Get current active update ticket for logged-in patient |
| `getProfile` | None | `StudentProfile` / `EmployeeProfile` | Get active/in-revision profile |

### Dental & Oral Health
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDentalHistory` | None | `DentalHistory` | Get current dental history |
| `getDentalRecord` | None | `DentalRecord` | Get active/in-revision dental record |
| `getOralApplianceProfile` | `approved?: Boolean` | `OralApplianceProfile` | Get appliance records |
| `getDentalPhotoRecord` | None | `DentalPhotoRecord` | Get dental photos (if any) |

### Medical Records
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getVitalSigns` | None | `VitalSigns` | Get latest vital signs |
| `getAllergyProfile` | None | `AllergyProfile` | Get active allergies |
| `getMedicationProfile` | None | `MedicationProfile` | Get current medications |
| `getEmergencyContact` | `approved?: Boolean` | `EmergencyContact` | Get emergency contact info |
| `getMedicalHistory` | None | `MedicalHistory` | Get medical history |
| `getHospitalizationProfile` | None | `HospitalizationProfile` | Get hospitalization records |
| `getOperationProfile` | None | `OperationProfile` | Get operation records |
| `getImmunizationProfile` | None | `ImmunizationProfile` | Get vaccination records |
| `getVisualAcuityProfile` | None | `VisualAcuityProfile` | Get vision records |

### ObGyn (Female Patients)
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getObgynHistory` | None | `ObGynHistory` | Get menstrual and gynecology info |

### Lifestyle
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getLifestyle` | None | `Lifestyle` | Get lifestyle factors (smoking, alcohol, vaping) |

### Procedures & Procedures
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDentalProcedureProfile` | None | `DentalProcedureProfile` | Get dental procedures |
| `getProcedureDomain` | None | `[DomainType!]` | Get available procedure domains |

### Catalogs (Reference Data)
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDomainCatalogs` | `domain?: DomainType, filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[DomainCatalog!]` | Get procedure type options |
| `getAllergenCatalogs` | `type?: ALLERGEN_TYPE, filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[AllergenCatalog!]` | Get allergen options |
| `getOralApplianceCatalogs` | `filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[OralApplianceTag!]` | Get appliance type options |
| `searchDomainCatalogs` | `domain!: String, filterIsValid?: Boolean, names!: [String!]` | `[DomainCatalog!]` | Search for domain types by name |
| `searchAllergenCatalogs` | `allergens!: [String!], filterIsValid?: Boolean` | `[AllergenCatalog!]` | Search allergens by name |
| `searchOralApplianceCatalogs` | `names!: [String!], filterIsValid?: Boolean` | `[OralApplianceTag!]` | Search appliances by name |

### Searching Patients

**Note:** This is available on the **Medical/Staff endpoint only**, not on the patient endpoint.

---

## Mutations

**The Patient endpoint is READ-ONLY.** All mutations that create, update, or submit profile changes are available on the medical/staff endpoint (`/staff/emr` or through patient submission endpoints).

---

## Example Queries

### Get Current Medical Profile
```graphql
{
  getProfile {
    id
    status
    program
    year
  }
}
```

### Get Active Allergies
```graphql
{
  getAllergyProfile {
    id
    status
    allergyRecords {
      allergen
      type
      status
      severity
      date_identified
    }
  }
}
```

### Get Dental Records with Findings
```graphql
{
  getDentalRecord {
    id
    notes
    ToothPlacements {
      toothIndex
      legend
    }
    oralFindings {
      oralFindingId
      status
      notes
    }
  }
}
```

### Get Vital Signs
```graphql
{
  getVitalSigns {
    id
    height_cm
    weight_kg
    blood_pressure
    heart_rate
    temperature
    recorded_at
  }
}
```

### Search Allergen Catalog
```graphql
{
  searchAllergenCatalogs(allergens: ["Penicillin", "Peanuts"], filterIsValid: true) {
    id
    allergen
    type
  }
}
```

---

## Notes

- **Patient isolation:** Patients only see their own data. No cross-patient queries available.
- **Read-only:** This endpoint does not accept mutations. Use `/staff/emr` or tenant-specific endpoints to create/update records.
- **Catalog queries:** Patients can browse procedure types, allergens, and appliance options for reference.
- **Update workflow:** When patients need to update their profile, they submit via the patient portal. Staff approves/rejects via `/staff/emr`.
- **Timestamp fields:** Use `created_at` to see when records were created in the system.

---

## Related Endpoints

- **Patient Portal**: `/patient/*` — For patient-initiated profile updates and submissions
- **Medical/Staff EMR**: `/staff/emr` — For staff-managed records and catalog administration
- **Consultation**: `/consultation` — For virtual/onsite medical consultations
- **Health Chat**: `/health-chat` — For patient-doctor messaging
