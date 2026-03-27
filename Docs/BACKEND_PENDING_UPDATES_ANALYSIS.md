# MDSystem Backend: Pending Patient Record Updates Analysis

## Executive Summary

Pending patient record updates in MDSystem are managed through the **`patientUpdateLog`** table, which acts as a central ledger for all update tickets. Each update ticket is linked to form data stored in domain-specific tables (MedicalHistory, DentalHistory, Lifestyle, etc.). The system uses GraphQL resolvers to expose update ticket queries and mutations.

---

## 1. Database Schema

### Primary Table: `patientUpdateLog`

**Location**: Database (no SQL schema file found; tables created during initialization)

**Fields**:
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID/PRIMARY KEY | Unique ticket identifier |
| `patientId` | UUID/FK | Reference to patient (`Patients.id`) |
| `status` | ENUM | Current state: `InProgress`, `Pending`, `Revision`, `RevisionSubmitted`, `Rejected`, `Expired`, `Cancelled`, `Approved` |
| `scope` | ENUM | Update type: `Medical`, `Dental`, `Both` |
| `notes` | TEXT | Staff revision instructions (populated when status = `Revision`) |
| `created_at` | TIMESTAMP | Ticket creation date |

**Indexes** (from [Backend/config/data/post_build_setup.sql](Backend/config/data/post_build_setup.sql)):
```sql
CREATE INDEX ON "patientUpdateLog"("patientId", created_at DESC);
CREATE INDEX ON "patientUpdateLog"(status);
```

### Related Data Tables

Each medical/dental record type has its own table, all linked to `patientUpdateLog`:

| Form Type | Table Name | Key Fields | Link to patientUpdateLog |
|-----------|-----------|-----------|--------------------------|
| Medical History | `MedicalHistory` | id, conditions[], notes | JOIN on `id` |
| Dental History | `DentalHistory` | id, seenByDentist, lastDentalCleaning, purpose, lastVisitDate | JOIN on `id` |
| Dental Photos | `DentalPhotoRecord` | id, upperTeeth, lowerTeeth, isValid | JOIN on `id` |
| Dental Records | `DentalRecord` | id, notes, ToothPlacements[], DentalFindings[] | JOIN on `id` |
| Vital Signs | `VitalSigns` | id, height_cm, weight_kg, blood_pressure, heart_rate, temperature | JOIN on `id` |
| Lifestyle | `Lifestyle` | id, smoker, numberOfCigarettesPerDay, yearsSmoked, alcoholConsumer | JOIN on `id` |
| Emergency Contact | `EmergencyContact` | id, firstContact, secondContact | JOIN on `id` |
| Allergies | `Allergy` | id, allergies[] (AllergyRecord) | JOIN on `id` |
| Medications | `MaintenanceMedication` | id, medications[] (MedicationRecord) | JOIN on `id` |
| OB-GYN History | `ObgynHistory` | id, lastMenstrualPeriod, hasDysmenorrhea, notes | JOIN on `id` |
| Visual Acuity | `VisualAcuity` | id, acuity (VisualAcuityRecord) | JOIN on `id` |
| Immunizations | `Immunization` | id, immunizations[] (ImmunizationRecord) | JOIN on `id` |
| Operations | `Operation` | id, operations[] (OperationRecord) | JOIN on `id` |
| Hospitalizations | `Hospitalization` | id, hospitalizations[] (HospitalizationRecord) | JOIN on `id` |
| Dental Procedures | `DentalProcedure` | id, procedures[] (DentalProcedureRecord) | JOIN on `id` |
| Oral Appliances | `OralAppliance` | id, appliances[] (OralApplianceRecord) | JOIN on `id` |

---

## 2. GraphQL Schema & Queries

### GraphQL Type Definition

**File**: [Backend/routes/emr/schema.graphql](Backend/routes/emr/schema.graphql) (Lines 703-756)

```graphql
enum UpdateScope {
    Medical
    Dental
    Both
}

enum UpdateStatus {
    InProgress
    Pending
    Revision
    RevisionSubmitted
    Rejected
    Expired
    Cancelled
    Approved
}

type UpdateTicket {
  id: ID!
  patientId: ID!
  status: UpdateStatus!
  scope: UpdateScope
  first_name: String
  last_name: String
  notes: String
  branch: DesignationBranch
  created_at: Date
}
```

### Available GraphQL Queries for Pending Data

#### Query 1: Get Current User's Update Ticket
**Location**: [Backend/routes/emr/schema.graphql](Backend/routes/emr/schema.graphql) Line 859  
**Resolver**: [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) Lines 14-49  
**Implementation**: [Backend/routes/emr/resolvers/patient/query.js](Backend/routes/emr/resolvers/patient/query.js) Lines 6-18

```graphql
query GetUpdateTicket {
  getUpdateTicket: UpdateTicket
}
```

**Response**:
```json
{
  "id": "uuid-123",
  "status": "Pending|Revision|InProgress|etc",
  "scope": "Medical|Dental|Both",
  "notes": "Staff revision instructions here",
  "created_at": "2026-03-15T10:30:00Z"
}
```

**Backend Code** (Wrapper Query):
```javascript
_getUserUpdateTicket: async (_, { userId }, { user, res }) => {
  const result = await db.query(
    `SELECT log.id, log.status, log.scope, log.notes, log.created_at
     FROM "patientUpdateLog" AS log
     JOIN "Patients" AS p ON p.id = log."patientId"
     WHERE p.id = $1
     ORDER BY log.created_at DESC
     LIMIT 1;`,
    [userId]
  );
  // Handles expiration logic and status checks
  return { id, patientId, status, scope, notes };
}
```

#### Query 2: Get Specific User's Update Ticket (Staff View)
**Location**: [Backend/routes/emr/schema.graphql](Backend/routes/emr/schema.graphql) Line 860  
**Resolver**: [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) Lines 14-49

```graphql
query GetUserUpdateTicket($userId: ID!) {
  getUserUpdateTicket(userId: $userId): UpdateTicket
}
```

**Purpose**: Staff members retrieve a specific patient's update ticket for review/approval.

#### Query 3: Get All Pending Update Tickets for a Branch (Staff Dashboard)
**Location**: [Backend/routes/emr/schema.graphql](Backend/routes/emr/schema.graphql) Line 865  
**Resolver**: [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) Lines 727-771  
**Implementation**: [Backend/routes/emr/resolvers/medical/query.js](Backend/routes/emr/resolvers/medical/query.js) Lines 305-313

```graphql
query GetStatusUpdateTickets(
  $statuses: [UpdateStatus!]!
  $branch: DesignationBranch!
  $offset: Int
  $limit: Int
) {
  getStatusUpdateTickets(
    statuses: $statuses
    branch: $branch
    offset: $offset
    limit: $limit
  ): [UpdateTicket!]
}
```

**Example Usage**:
```javascript
// Fetch pending and revision tickets for Manila branch
const result = await getStatusUpdateTickets(
  ['Pending', 'Revision', 'RevisionSubmitted'], 
  'Manila', 
  0, 
  20
);
```

**Resolver Code**:
```javascript
_getStatusUpdateTickets: async (_, { statuses, branch, offset, limit }, { user, res }) => {
  const query = `
    SELECT log.id, log.status, log.scope, log.notes, log.created_at, 
           up.first_name, up.last_name, log."patientId", up.branch
    FROM "patientUpdateLog" log
    JOIN "UsersPersonal" up ON up.id = log."patientId"
    WHERE log.status = ANY($1) AND up.branch = $2
    ORDER BY log.created_at DESC
    LIMIT $3 OFFSET $4;
  `;
  return result.rows;
}
```

---

## 3. Retrieving Form Data from Previous Pending Submissions

### Current Status: **PLACEHOLDER ONLY**

⚠️ **Important**: As of the current codebase, retrieving previous form data is NOT fully implemented. The placeholder function returns an empty object `{}`.

**Location**: [mds-patient/src/modules/record-forms/update-record/update-record-service.jsx](mds-patient/src/modules/record-forms/update-record/update-record-service.jsx) Lines 163-173

```javascript
export async function fetchUpdateRevisionPrefill() {
  // ⚠️ PLACEHOLDER - Currently returns empty object {}
  console.log('[UpdateRevision] 📥 Pre-fill available...');
  return {};
}
```

### How to Retrieve Medical/Dental Data from a Pending Ticket

To retrieve the actual form data submitted in a previous pending ticket, query the related data tables using the ticket ID as the record ID:

#### Example 1: Get Medical Data from Pending Ticket
```javascript
// Frontend GraphQL Query
const query = `
  query GetUserMedicalHistory($userId: ID!) {
    getUserMedicalHistory(userId: $userId, offset: 0, limit: 1) {
      id
      conditions { id description diagnosedDate relationship }
      notes
      created_at
      status
    }
  }
`;

// Response includes data from pending submission if status is "Pending" or "Revision"
```

**Backend URL**: `POST /emr/[patient|medical]`

**Wrapper**: [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) Lines 578-602  
**Resolver**: [Backend/routes/emr/resolvers/medical/query.js](Backend/routes/emr/resolvers/medical/query.js) (medical staff only)

**SQL Pattern** (all similar form types follow this pattern):
```sql
SELECT mh.*, pul.created_at, pul.status
FROM "MedicalHistory" mh
JOIN "patientUpdateLog" pul ON pul.id = mh.id
WHERE pul."patientId" = $1 AND pul.created_at >= $4
ORDER BY pul.created_at DESC
LIMIT $2 OFFSET $3;
```

#### Example 2: Get Dental Data from Pending Ticket
```javascript
const query = `
  query GetUserDentalRecord($userId: ID!) {
    getUserDentalRecord(userId: $userId, offset: 0, limit: 1) {
      id
      notes
      ToothPlacements { id toothIndex legend }
      DentalFindings { oralFindingId status notes }
      created_at
      status
    }
  }
`;
```

**Backend**: [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) Lines 216-255

#### Query Pattern for All Form Types

**Available Queries** (all return multiple records with pagination, filtering by status):
- `getUserProfile()` - Student/Employee profile
- `getUserDentalHistory()` - Dental history
- `getUserDentalPhotoRecord()` - Dental photos
- `getUserDentalRecord()` - Full dental record with tooth placements
- `getUserVitalSigns()` - Vital signs
- `getUserLifestyle()` - Lifestyle data
- `getUserEmergencyContact()` - Emergency contacts
- `getUserAllergyProfile()` - Allergies
- `getUserMedicationProfile()` - Medications
- `getUserVisualAcuityProfile()` - Visual acuity
- `getUserMedicalHistory()` - Medical history
- `getUserHospitalizationProfile()` - Hospitalizations
- `getUserOperationProfile()` - Surgical operations
- `getUserImmunizationProfile()` - Immunizations
- `getUserDentalProcedureProfile()` - Dental procedures
- `getUserOralApplianceProfile()` - Oral appliances

**All return records with these fields**:
```
created_at: Date      // When record was submitted
status: UpdateStatus  // InProgress, Pending, Revision, etc.
```

---

## 4. Ticket Status Lifecycle

### Status Flow Diagram

```
InProgress → Pending ──→ Approved (final)
              ↓ (staff request)
            Revision ──→ RevisionSubmitted → Pending
                                              ↓
                                            Approved
                                              
Expired     (7-day default expiry)
Cancelled   (patient cancels)
Rejected    (staff rejects)
```

### Status Definitions & Transitions

| Status | Meaning | Created By | Next Possible |
|--------|---------|-----------|---------------|
| **InProgress** | Patient actively filling form | `createUpdateTicket` mutation | Pending, Cancelled, Expired |
| **Pending** | Patient submitted, awaiting staff review | `submitUpdateTicket` mutation | Approved, Revision, Rejected, Expired |
| **Revision** | Staff requested changes | Staff `staffUpdateTicket` mutation | RevisionSubmitted (patient resubmits) |
| **RevisionSubmitted** | Patient resubmitted after revision | `submitUpdateTicket` (from Revision state) | Approved, Revision, Rejected, Expired |
| **Approved** | Staff approved changes | Staff `staffUpdateTicket` mutation | **FINAL** (no further changes) |
| **Rejected** | Staff rejected submission | Staff `staffUpdateTicket` mutation | **FINAL** |
| **Cancelled** | Patient cancelled ticket | `cancelUpdateTicket` mutation | **FINAL** |
| **Expired** | Ticket exceeded 7-day expiry | Auto-expiry (query time) | **FINAL** |

---

## 5. Mutations for Update Tickets

### Patient-Side Mutations

**File**: [Backend/routes/emr/resolvers/patient/mutation.js](Backend/routes/emr/resolvers/patient/mutation.js)

#### 1. Create Update Ticket
```graphql
mutation CreateUpdateTicket($scope: UpdateScope!) {
  createUpdateTicket(scope: $scope): ID!
}
```
- **Scope**: `Medical`, `Dental`, `Both`
- **Restrictions**: Unverified patients can only create `Both` scope
- **Returns**: Ticket ID

#### 2. Submit Update Ticket (for Review)
```graphql
mutation SubmitUpdateTicket {
  submitUpdateTicket: UpdateStatus!
}
```
- **Changes status**: `InProgress` → `Pending` OR `Revision` → `RevisionSubmitted`
- **Validates**: All required records for scope are submitted
- **Fails if**: Missing required form fields

#### 3. Cancel Update Ticket
```graphql
mutation CancelUpdateTicket {
  cancelUpdateTicket: UpdateStatus!
}
```
- **Allowed states**: Only `InProgress` or `Pending` can be cancelled
- **Returns**: New status `Cancelled`

### Staff-Side Mutations

**File**: [Backend/routes/emr/resolvers/medical/mutation.js](Backend/routes/emr/resolvers/medical/mutation.js)

#### Staff Update Ticket (Approve/Reject/Revision)
```graphql
mutation StaffUpdateTicket($userId: ID!, $status: UpdateStatus!, $notes: String) {
  staffUpdateTicket(userId: $userId, status: $status, notes: $notes): UpdateStatus!
}
```
- **Allowed statuses**: `Approved`, `Revision`, `Rejected`
- **Notes**: Staff feedback/revision instructions (only used for `Revision` status)
- **Permissions Required**: `emr_allow_approval`
- **Side Effects**: 
  - If `Approved`: Recharges credential status, verifies emergency contacts
  - If `Revision`: Notes stored in `patientUpdateLog.notes`, notified to patient

---

## 6. Accessing Previous Submission Data

### Implementation Path: How to Implement Pre-fill

To retrieve and prefill form data from the previous pending submission:

**Step 1: Get Ticket History** (from staff perspective):
```javascript
// Get patient's most recent Pending/RevisionSubmitted ticket
const ticket = await sendGraphQL(
  `query GetUserUpdateTicket($userId: ID!) {
     getUserUpdateTicket(userId: $userId) {
       id
       status
       scope
       created_at
     }
   }`,
  { userId: patientId }
);

const ticketId = ticket.id;  // Use this as record ID to fetch form data
```

**Step 2: Fetch Medical Data from Previous Submission**:
```javascript
// For Medical scope - get most recent medical submission
const medicalData = await sendGraphQL(
  `query GetUserMedicalHistory($userId: ID!, $offset: Int, $limit: Int) {
     getUserMedicalHistory(userId: $userId, offset: $offset, limit: $limit) {
       id
       conditions { id description diagnosedDate relationship }
       notes
       status
       created_at
     }
   }`,
  { userId: patientId, offset: 0, limit: 1 }
);

// Filter for records with Pending/Revision/RevisionSubmitted status
const previousSubmission = medicalData.find(
  r => ['Pending', 'Revision', 'RevisionSubmitted'].includes(r.status)
);
```

**Step 3: Repeat for All Scope-Relevant Records**:
- If scope includes Medical: fetch Medical/OB-GYN/Lifestyle/Medication/etc.
- If scope includes Dental: fetch Dental/DentalPhotos/DentalProcedures/etc.

**Step 4: In Patient-Side Form** (update-record-service.jsx):
```javascript
export async function fetchUpdateRevisionPrefill() {
  const ticket = await getUpdateRevisionStatus();  // Get ticket
  if (!ticket) return {};
  
  const prefillData = {};
  
  // Fetch based on scope
  if (ticket.scope === 'Medical' || ticket.scope === 'Both') {
    const medical = await sendGraphQLRequest(
      `query { getUserMedicalHistory(userId: $patientId, offset: 0, limit: 1) { 
         id conditions { ... } notes created_at status 
       }}`
    );
    prefillData.medical = medical[0];  // Most recent submission
  }
  
  // Repeat for Dental, etc.
  
  return prefillData;
}
```

---

## 7. File References Summary

### Backend Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| [Backend/routes/emr/schema.graphql](Backend/routes/emr/schema.graphql) | GraphQL type definitions | UpdateTicket, UpdateStatus, UpdateScope enums, all query/mutation definitions |
| [Backend/routes/emr/wrapper/query.js](Backend/routes/emr/wrapper/query.js) | Core query resolvers | `_getUserUpdateTicket`, `_getStatusUpdateTickets`, all record type queries |
| [Backend/routes/emr/resolvers/patient/query.js](Backend/routes/emr/resolvers/patient/query.js) | Patient query resolvers | `getUpdateTicket`, `getProfile`, `getDentalHistory`, etc. |
| [Backend/routes/emr/resolvers/patient/mutation.js](Backend/routes/emr/resolvers/patient/mutation.js) | Patient mutations | `createUpdateTicket`, `submitUpdateTicket`, `cancelUpdateTicket`, form create mutations |
| [Backend/routes/emr/resolvers/medical/query.js](Backend/routes/emr/resolvers/medical/query.js) | Medical staff queries | Permit checking, all `getUserX` methods |
| [Backend/routes/emr/resolvers/medical/mutation.js](Backend/routes/emr/resolvers/medical/mutation.js) | Medical staff mutations | `staffUpdateTicket` (approve/reject/revision), form update mutations |
| [Backend/routes/emr/resolvers/record-validator.js](Backend/routes/emr/resolvers/record-validator.js) | Validation logic | `validateUpdateTicket`, `validateMedicalUpdateTicket`, `validateDentalUpdateTicket` |
| [Backend/config/data/post_build_setup.sql](Backend/config/data/post_build_setup.sql) | Database initialization | Indexes on patientUpdateLog, seed data for catalogs |
| [Backend/config/query.js](Backend/config/query.js) | Query utilities | `setExpiredUpdateTickets`, `isUserValidated`, database helpers |

### Frontend Files (Patient Side)

| File | Purpose |
|------|---------|
| [mds-patient/src/modules/record-forms/update-record/update-record-service.jsx](mds-patient/src/modules/record-forms/update-record/update-record-service.jsx) | GraphQL mutations, ticket management, **placeholder for prefill logic** |
| [mds-patient/src/modules/record-forms/update-record/record-update-form.jsx](mds-patient/src/modules/record-forms/update-record/record-update-form.jsx) | Main form component, revision detection (Lines 33-64) |

### Frontend Files (Staff Side)

| File | Purpose |
|------|---------|
| [mds-staff/src/modules/pending-requests/initial-record-service.js](mds-staff/src/modules/pending-requests/initial-record-service.js) | GraphQL queries including `getStatusUpdateTickets`, `getUserUpdateTicket`, `staffUpdateTicket` |
| [mds-staff/src/modules/pending-requests/components/review-sections/record-update/record-update-list.jsx](mds-staff/src/modules/pending-requests/components/review-sections/record-update/record-update-list.jsx) | Staff UI for reviewing pending update tickets |

---

## 8. Key Insights

### 1. **Ticket ID Links to Form Data**
- The `patientUpdateLog.id` is the foreign key (`recordId`) used in all form data tables
- All records in `MedicalHistory`, `DentalHistory`, etc. with the same ID belong to the same ticket
- Queries use JOIN on this ID to retrieve complete ticket + form data

### 2. **Status-Based Filtering**
- Query resolvers check `pul.status` to determine which records to return
- Reviewable statuses: `InProgress`, `Pending`, `Revision`, `RevisionSubmitted`, `Approved`
- Final statuses: `Approved`, `Rejected`, `Cancelled`, `Expired`

### 3. **Expiry Handling**
- Default expiry: 7 days (configurable via `UPDATE_TICKET_EXPIRY_SEC` env var)
- Expiry is checked at query-time in `_getUserUpdateTicket`
- Expired InProgress tickets auto-transition to `Expired` status

### 4. **Pre-fill Not Yet Implemented**
- `fetchUpdateRevisionPrefill()` currently returns empty object `{}`
- To implement: Modify function to query previous submission using the ticket ID
- All data is accessible via existing GraphQL queries—just need to fetch it

### 5. **Staff Approval Triggers Credential Update**
- When ticket is approved, staff calls `_reloadCredentialStatus` 
- This updates patient's credential status (e.g., Unverified → Active)
- Emergency contact phones are auto-marked verified when ticket approved

---

## 9. Common Queries for Implementation

### Get All Pending Tickets for Review (Staff)
```javascript
const pendingTickets = await getStatusUpdateTickets(
  ['Pending', 'Revision', 'RevisionSubmitted'],
  'Manila',
  0,
  50
);
```

### Check If Patient Has Active Revision Request
```javascript
const ticket = await getUpdateRevisionStatus();
if (ticket?.status === 'Revision') {
  // Show revision banner with ticket.notes (staff feedback)
  // Offer to prefill form from previous submission
}
```

### Retrieve Previous Medical Submission Data
```javascript
const history = await sendGraphQL(
  `query GetUserMedicalHistory($userId: ID!) {
     getUserMedicalHistory(userId: $userId, offset: 0, limit: 1) {
       conditions { id description diagnosedDate relationship }
       notes
       status
       created_at
     }
   }`,
  { userId: patientId }
);

const previousData = history[0];  // Most recent (highest created_at)
```

---

## 10. References for Further Development

- **Update Ticket Expiry Configuration**: Backend/.env (UPDATE_TICKET_EXPIRY_SEC)
- **Permission Requirements**: Backend/services/permit.js (emr_allow_approval, emr_allow_view, emr_allow_edit)
- **Socket Events**: Backend/config/sockets.js (updateTicket notifications)
- **GraphQL Error Handling**: Backend/utils/graphql-helper.js
- **Database Connection**: Backend/config/query.js (pg client connection)

