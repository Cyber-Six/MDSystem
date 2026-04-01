# Electronic Medical Record (EMR) - Staff Endpoint

The **Staff EMR** endpoint (`/staff/emr`) provides full CRUD capabilities for medical records management. Medical staff create, read, update, and delete patient records including vital signs, dental records, and catalog management. Staff can also manage reference catalogs (OralFindingCatalogs, etc).

---

## Endpoint

```
POST /staff/emr
Middleware: jwtProtect("medical")
```

---

## Overview

This endpoint is **restricted to medical staff only** (doctors, nurses, dentists, admin personnel). It provides complete medical record management capabilities:

- Create and update patient vital signs
- Create and update patient dental records
- Manage oral finding catalogs
- Query and manage all EMR data at the staff level

**Key Responsibilities:**
- Record medical assessments and vital measurements
- Maintain dental record documentation
- Administer reference catalogs for clinical use

---

## Permissions

All operations require specific EMR permissions assigned via role management:

| Permission | Key | Mutation/Query | Description |
|------------|-----|---|-------------|
| `ALLOW_TO_SET_VITAL_SIGN` | `emr_allow_set_vital_sign` | `createVitalSigns`, `updateVitalSigns` | Create/update vital signs records |
| `ALLOW_TO_SET_DENTAL_RECORD` | `emr_allow_set_dental_record` | `createDentalRecord`, `updateDentalRecord` | Create/update dental records |
| `ALLOW_TO_EDIT_CATALOGS` | `emr_allow_edit_catalogs` | `createOralFindingCatalog`, `updateOralFindingCatalog`, `deleteOralFindingCatalog`, `getOralFindingCatalogs` | Manage oral finding catalogs |

Permission checks are performed using `permit.isMedicalPermitted()` which handles:
- Admin bypass (users with `IS_ADMIN` permission)
- Branch-level access control (for mutations with userId context)
- Proper error logging and response codes

---

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `DentalLegend` | `PRESENT`, `DUE_FILLING_DECAYED`, `DUE_EXTRACTION`, `ROOT_FRAGMENT`, `MISSING_DUE_TO_CARIES`, `MISSING_DUE_TO_OTHER_CAUSES`, `IMPACTED_TOOTH`, `SUPERNUMERARY_TOOTH`, `UNERUPTED`, `ECTOPIC_ERUPTION`, `DIASTEMA`, `ROTATED`, `FRACTURE`, `ABRADED`, `ATTRITION`, `MOBILITY`, `AMALGAM_FILLING`, `COMPOSITE_FILLING`, `GOLD_FILLING`, `INLAY_FILLING`, `CEMENTED_CROWN`, `BRIDGE_ABUTMENT`, `PONTIC`, `ROOT_CANAL`, `EXTRACTION`, `JACKET_CROWN` |

### Input Types

#### VitalSignsInput
```graphql
input VitalSignsInput {
  height_cm: Float!
  weight_kg: Float!
  blood_pressure: String!
  heart_rate: Int!
  temperature: Float!
  notes: String
}
```

#### VitalSignsUpdateInput
```graphql
input VitalSignsUpdateInput {
  height_cm: Float
  weight_kg: Float
  blood_pressure: String
  heart_rate: Int
  temperature: Float
  notes: String
}
```

#### ToothPlacementInput
```graphql
input ToothPlacementInput {
  toothIndex: Int!
  legend: DentalLegend!
}
```

#### OralFindingRecordInput
```graphql
input OralFindingRecordInput {
  oralFindingId: ID!
  status: String!
  notes: String
}
```

#### DentalRecordInput
```graphql
input DentalRecordInput {
  notes: String
  oralFindings: [OralFindingRecordInput!]!
  ToothPlacements: [ToothPlacementInput!]!
}
```

#### OralFindingCatalogInput
```graphql
input OralFindingCatalogInput {
  name: String!
  isActive: Boolean
  description: String
}
```

### Response Types

#### VitalSigns
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `userId` | `ID` | Patient reference |
| `height_cm` | `Float!` | Height in centimeters |
| `weight_kg` | `Float!` | Weight in kilograms |
| `blood_pressure` | `String!` | Format: "120/80" |
| `heart_rate` | `Int!` | Beats per minute |
| `temperature` | `Float!` | Celsius |
| `notes` | `String` | Clinical notes |
| `created_at` | `Date` | Record creation timestamp |
| `archived_at` | `Date` | Archival timestamp |

#### DentalRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `userId` | `ID` | Patient reference |
| `notes` | `String` | Clinical notes |
| `oralFindings` | `[OralFindingRecord!]!` | Associated findings |
| `ToothPlacements` | `[ToothPlacement!]!` | Tooth-specific data |
| `created_at` | `Date` | Record creation timestamp |

#### ToothPlacement
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `toothIndex` | `Int!` | Tooth number (1-32) |
| `legend` | `DentalLegend!` | Tooth status |

#### OralFindingRecord
| Field | Type | Description |
|-------|------|-------------|
| `oralFindingId` | `ID!` | FK to OralFindingCatalog |
| `status` | `String!` | Observation status |
| `notes` | `String` | Additional notes |

#### OralFindingCatalog
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | Unique catalog entry ID |
| `name` | `String!` | Finding name (e.g., "Gingival Inflammation") |
| `isActive` | `Boolean!` | Whether entry is available for use |
| `description` | `String` | Detailed description of the finding |
| `created_at` | `Date` | Creation timestamp |

---

## Queries

### VitalSigns

| Query | Permission | Parameters | Returns | Description |
|-------|-----------|------------|---------|-------------|
| `getPatientVitalSigns` | `emr_allow_view` (branch-matched) | `patientId!, limit?: Int, offset?: Int` | `[VitalSigns!]!` | Get all vital signs for a patient, ordered by `created_at DESC` |
| `getVitalSignsById` | `emr_allow_view` (branch-matched) | `id!` | `VitalSigns` | Get specific vital signs record by ID |

### DentalRecords

| Query | Permission | Parameters | Returns | Description |
|-------|-----------|------------|---------|-------------|
| `getPatientDentalRecord` | `emr_allow_view` (branch-matched) | `patientId!, limit?: Int, offset?: Int` | `[DentalRecord!]!` | Fetch dental records with tooth placements and oral findings for a patient, ordered by `created_at DESC` |
| `getDentalRecordById` | `emr_allow_view` (branch-matched) | `id!` | `DentalRecord` | Get specific dental record with all related tooth and finding data |

### OralFindingCatalogs

| Query | Permission | Parameters | Returns | Description |
|-------|-----------|------------|---------|-------------|
| `getOralFindingCatalogs` | `emr_allow_edit_catalogs` | `filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[OralFindingCatalog!]!` | Fetch all oral finding catalog entries, optionally filtered by active status |

---

## Mutations

### VitalSigns Management

#### createVitalSigns
```graphql
mutation CreateVitalSigns($patientId: ID!, $input: VitalSignsInput!) {
  createVitalSigns(patientId: $patientId, input: $input) {
    id
    height_cm
    weight_kg
    blood_pressure
    heart_rate
    temperature
    notes
    created_at
  }
}
```

| Field | Requirement |
|-------|-------------|
| `patientId` | Required |
| `input.height_cm` | Required |
| `input.weight_kg` | Required |
| `input.blood_pressure` | Required |
| `input.heart_rate` | Required |
| `input.temperature` | Required |
| `input.notes` | Optional |

**Permission:** `emr_allow_set_vital_sign` (branch-matched against patientId)

**Returns:** Created VitalSigns object

---

#### updateVitalSigns
```graphql
mutation UpdateVitalSigns($id: ID!, $input: VitalSignsUpdateInput!) {
  updateVitalSigns(id: $id, input: $input) {
    id
    height_cm
    weight_kg
    blood_pressure
    heart_rate
    temperature
    notes
    created_at
  }
}
```

| Constraint | Details |
|-----------|---------|
| **Time Lock** | Records can only be updated within 24 hours of creation (configurable via `EMR_UPDATE_LOCK_HOURS` env var) |
| **Fields** | All fields optional; at least one required to proceed |
| **Permission Check** | Happens after time lock validation, using patientId from existing record |

**Permission:** `emr_allow_set_vital_sign` (branch-matched against patientId from existing record)

**Returns:** Updated VitalSigns object

**Error Codes:**
- `404`: VitalSigns not found
- `403`: Update attempted outside lock window
- `400`: No fields provided or database error

---

### DentalRecord Management

#### createDentalRecord
```graphql
mutation CreateDentalRecord($patientId: ID!, $input: DentalRecordInput!) {
  createDentalRecord(patientId: $patientId, input: $input) {
    id
    patientId
    notes
    ToothPlacements {
      id
      toothIndex
      legend
    }
    oralFindings {
      oralFindingId
      status
      notes
    }
    created_at
  }
}
```

| Field | Requirement |
|-------|-------------|
| `patientId` | Required |
| `input.notes` | Optional |
| `input.ToothPlacements` | Optional array of tooth data |
| `input.oralFindings` | Optional array of findings |

**Permission:** `emr_allow_set_dental_record` (branch-matched against patientId)

**Transaction:** Yes — all inserts rolled back on any error

**Returns:** Created DentalRecord with nested relationships

---

#### updateDentalRecord
```graphql
mutation UpdateDentalRecord($id: ID!, $input: DentalRecordInput!) {
  updateDentalRecord(id: $id, input: $input) {
    id
    patientId
    notes
    ToothPlacements {
      id
      toothIndex
      legend
    }
    oralFindings {
      oralFindingId
      status
      notes
    }
    created_at
  }
}
```

| Constraint | Details |
|-----------|---------|
| **Time Lock** | Records can only be updated within 24 hours of creation |
| **Tooth Placements** | If provided, replaces ALL existing placements |
| **Oral Findings** | If provided, replaces ALL existing findings |
| **Permission Check** | Happens after time lock validation, using patientId from existing record |

**Permission:** `emr_allow_set_dental_record` (branch-matched against patientId from existing record)

**Transaction:** Yes — all updates rolled back on any error

**Returns:** Updated DentalRecord with refreshed data

**Error Codes:**
- `404`: DentalRecord not found
- `403`: Update attempted outside lock window
- `400`: Invalid oralFindingId or database error

---

### OralFindingCatalog Management

#### getOralFindingCatalogs
```graphql
query GetOralFindingCatalogs($filterIsValid: Boolean, $offset: Int, $limit: Int) {
  getOralFindingCatalogs(filterIsValid: $filterIsValid, offset: $offset, limit: $limit) {
    id
    name
    description
    isActive
    created_at
  }
}
```

**Permission:** `emr_allow_edit_catalogs`

**Parameters:**
- `filterIsValid` (optional): Filter by active status. If `true`, returns only active entries. If `false`, returns inactive. If `null`/undefined, returns all.
- `offset` (optional): Pagination offset (default: 0)
- `limit` (optional): Results per page (default: 10)

**Returns:** Array of OralFindingCatalog objects

---

#### createOralFindingCatalog
```graphql
mutation CreateOralFindingCatalog($input: OralFindingCatalogInput!) {
  createOralFindingCatalog(input: $input) {
    id
    name
    description
    isActive
    created_at
  }
}
```

| Field | Requirement |
|-------|-------------|
| `input.name` | Required (max 50 chars) |
| `input.description` | Optional |
| `input.isActive` | Optional (defaults to `true`) |

**Permission:** `emr_allow_edit_catalogs`

**Behavior:**
- Sets `created_by` to the authenticated staff user ID
- Sets `created_at` to current timestamp
- Default `isActive = true` if not specified

**Returns:** Created OralFindingCatalog object

**Error Codes:**
- `401`: Unauthorized (missing permission)
- `400`: Invalid input or database error

---

#### updateOralFindingCatalog
```graphql
mutation UpdateOralFindingCatalog($id: ID!, $input: OralFindingCatalogInput!) {
  updateOralFindingCatalog(id: $id, input: $input) {
    id
    name
    description
    isActive
    created_at
  }
}
```

| Field | Requirement |
|-------|-------------|
| `id` | Required |
| `input.name` | Optional |
| `input.description` | Optional |
| `input.isActive` | Optional |

**Permission:** `emr_allow_edit_catalogs`

**Behavior:**
- Only specified fields are updated
- At least one field must be provided to proceed
- `created_at` remains unchanged

**Returns:** Updated OralFindingCatalog object

**Error Codes:**
- `401`: Unauthorized
- `404`: OralFindingCatalog not found
- `400`: No fields provided or database error

---

#### deleteOralFindingCatalog
```graphql
mutation DeleteOralFindingCatalog($id: ID!) {
  deleteOralFindingCatalog(id: $id) {
    id
    name
    description
    isActive
    created_at
  }
}
```

**Permission:** `emr_allow_edit_catalogs`

**Behavior:**
- Soft delete via `CASCADE` if foreign keys exist
- Returns the deleted record data for confirmation

**Returns:** Deleted OralFindingCatalog object

**Error Codes:**
- `401`: Unauthorized
- `404`: OralFindingCatalog not found
- `400`: Database error (e.g., foreign key violation if no cascade)

---

## Example Operations

### Create a New Vital Signs Record
```graphql
mutation {
  createVitalSigns(
    patientId: "123"
    input: {
      height_cm: 175.5
      weight_kg: 72.3
      blood_pressure: "120/80"
      heart_rate: 72
      temperature: 37.0
      notes: "Patient healthy, no concerns"
    }
  ) {
    id
    height_cm
    weight_kg
    blood_pressure
    heart_rate
    temperature
    created_at
  }
}
```

### Update Vital Signs Within Lock Window
```graphql
mutation {
  updateVitalSigns(
    id: "456"
    input: {
      temperature: 37.2
      notes: "Slight elevation in temperature"
    }
  ) {
    id
    temperature
    notes
    created_at
  }
}
```

### Create a Dental Record with Teeth and Findings
```graphql
mutation {
  createDentalRecord(
    patientId: "123"
    input: {
      notes: "Routine dental checkup"
      ToothPlacements: [
        { toothIndex: 1, legend: PRESENT }
        { toothIndex: 2, legend: PRESENT }
        { toothIndex: 3, legend: DUE_FILLING_DECAYED }
      ]
      oralFindings: [
        { oralFindingId: "1", status: "true", notes: "Plaque buildup" }
        { oralFindingId: "2", status: "true", notes: "Gingival inflammation" }
      ]
    }
  ) {
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

### Create an Oral Finding Catalog Entry
```graphql
mutation {
  createOralFindingCatalog(
    input: {
      name: "Gingival Inflammation"
      description: "Inflammation of the gums"
      isActive: true
    }
  ) {
    id
    name
    description
    isActive
    created_at
  }
}
```

### Fetch All Active Oral Finding Catalogs
```graphql
query {
  getOralFindingCatalogs(filterIsValid: true, limit: 20, offset: 0) {
    id
    name
    description
    isActive
    created_at
  }
}
```

### Update an Oral Finding Catalog Entry
```graphql
mutation {
  updateOralFindingCatalog(
    id: "5"
    input: {
      name: "Moderate Gingival Inflammation"
      description: "Updated: Moderate inflammation of the gums requiring intervention"
    }
  ) {
    id
    name
    description
    isActive
    created_at
  }
}
```

### Delete an Oral Finding Catalog Entry
```graphql
mutation {
  deleteOralFindingCatalog(id: "5") {
    id
    name
  }
}
```

---

## Architecture Notes

### Transaction Handling
- **DentalRecord operations** use database transactions to ensure atomicity
- All inserts/updates are rolled back if any operation fails
- Uses PostgreSQL connection pooling with proper cleanup

### Permission Model
- Uses `permit.isMedicalPermitted()` for all permission checks
- Admin users bypass permission checks automatically
- Branch-level access control prevents cross-branch operations
- Logs all unauthorized access attempts

### Time-Lock Mechanism
- VitalSigns and DentalRecords have a configurable update lock
- Default: 24 hours after creation (configured via `EMR_UPDATE_LOCK_HOURS`)
- Prevents accidental modification of past records
- Logs all attempts to violate lock window

### Update Lock Configuration
```javascript
// Backend/routes/staff/emr/mutation.js - Lines 11-12
const UPDATE_LOCK_HOURS = parseInt(process.env.EMR_UPDATE_LOCK_HOURS, 10) || 24;
const UPDATE_LOCK_MS = UPDATE_LOCK_HOURS * 60 * 60 * 1000;
```

---

## Database Schema References

### Tables Used
- `VitalSigns`: Patient vital measurements
- `DentalRecord`: Patient dental assessments
- `ToothPlacement`: Tooth-specific findings (32 teeth max)
- `oralFindingRecord`: Links dental records to findings
- `oralFindingCatalog`: Reference catalog for oral findings
- `MedicalPersonnel`: Staff user data

### Foreign Keys
- `VitalSigns.userId` → `Patients.id`
- `DentalRecord.userId` → `Patients.id`
- `ToothPlacement.dentalRecordId` → `DentalRecord.id`
- `oralFindingRecord.dentalRecordId` → `DentalRecord.id`
- `oralFindingRecord.oralFindingId` → `oralFindingCatalog.id`
- `oralFindingCatalog.created_by` → `UserCredentials.id`

---

## Migration from Main EMR

**As of the latest update (2026-03-30):**
- `getOralFindingCatalogs` **moved from** `/emr` **to** `/staff/emr`
- Only staff with `emr_allow_edit_catalogs` permission can access
- CRUD for OralFindingCatalogs now restricted to staff endpoint
- Patient endpoint no longer exposes catalog queries

---

## Related Endpoints

- **Patient EMR**: `/emr` — Read-only patient records
- **Consultation**: `/consultation` — Medical consultations
- **Role Management**: `/role-management` — Permission assignment
- **Analytics**: `/analytics` — EMR data analytics and reporting
