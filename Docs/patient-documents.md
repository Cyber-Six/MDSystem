# Patient Documents Module

The Patient Documents module manages both **non-generated (raw) documents** and **generated documents** across the system. Non-generated documents are physical/external documents that patients submit or staff records. Generated documents are systematically created from templates.

---

## Architecture Overview

### Document Types

| Type                          | Purpose                                                           | Origin                             | Persistence                                   |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| **Non-Generated (Raw)** | Physical documents, forms, external records                       | Patient submissions or staff input | `patientRawDocument` table                  |
| **Generated**           | Systematic documents from templates (certificates, reports, etc.) | System generation from templates   | `PatientDocuments` table + `documentData` |

### Data Flow

```
Patient/Staff → File Upload → Promote File → Database Transaction → Notification
     ↓
Non-Generated: patientRawDocument (status: Requested/Pending/Recorded/Archived)
Generated: PatientDocuments + documentTemplate + documentData
```

---

## Database Schema

### `patientRawDocument`

Non-generated document submissions from patients or recorded by staff.

| Field             | Type        | Enum                  | Description                                            |
| ----------------- | ----------- | --------------------- | ------------------------------------------------------ |
| `id`            | BIGINT (PK) | -                     | Auto-incremented ID                                    |
| `file`          | UUID        | -                     | File reference (promoted file UUID)                    |
| `status`        | ENUM        | `RawDocumentStatus` | `Requested`, `Pending`, `Recorded`, `Archived` |
| `documentTagId` | INT (FK)    | -                     | Reference to `rawDocumentTag`                        |
| `patientId`     | INT (FK)    | -                     | Reference to `Patients`                              |
| `recordedBy`    | INT (FK)    | -                     | Staff member who recorded/approved                     |
| `archived_at`   | TIMESTAMP   | -                     | When document was archived                             |
| `created_at`    | TIMESTAMP   | -                     | When submission was created                            |

### `rawDocumentTag`

Categories/types of non-generated documents.

| Field          | Type         | Description                                                     |
| -------------- | ------------ | --------------------------------------------------------------- |
| `id`         | INT (PK)     | Auto-incremented ID                                             |
| `label`      | VARCHAR(250) | Document type name (e.g., "Medical Certificate", "Lab Results") |
| `isActive`   | BOOLEAN      | Whether tag is available for requests                           |
| `created_at` | TIMESTAMP    | Creation timestamp                                              |

### `PatientDocuments`

Generated documents for patients.

| Field          | Type        | Description                         |
| -------------- | ----------- | ----------------------------------- |
| `id`         | BIGINT (PK) | Auto-incremented ID                 |
| `patientId`  | INT (FK)    | Reference to `Patients`           |
| `templateId` | INT (FK)    | Reference to `documentTemplate`   |
| `documentId` | INT         | Associated document (optional)      |
| `issuedBy`   | INT (FK)    | Staff member who generated document |
| `dHash`      | VARCHAR(64) | Document hash (for verification)    |
| `expired_at` | TIMESTAMP   | Expiration date (optional)          |
| `created_at` | TIMESTAMP   | Generation timestamp                |

### `documentTemplate`

Template definitions for generated documents.

| Field           | Type               | Description                   |
| --------------- | ------------------ | ----------------------------- |
| `id`          | INT (PK)           | Auto-incremented ID           |
| `template`    | VARCHAR(50) UNIQUE | Template identifier (docType) |
| `description` | TEXT               | Display name/description      |
| `revisedDate` | VARCHAR(7)         | Version (YYYY-MM format)      |
| `createdBy`   | INT (FK)           | Creator staff member          |
| `createdAt`   | TIMESTAMP          | Creation timestamp            |

### `documentData`

Actual document content storage (base64 encoded content).

| Field             | Type        | Description                       |
| ----------------- | ----------- | --------------------------------- |
| `id`            | BIGINT (PK) | Auto-incremented ID               |
| `documentId`    | INT (FK)    | Reference to `PatientDocuments` |
| `requirementId` | INT (FK)    | Document requirement (optional)   |
| `data`          | TEXT        | Base64-encoded document content   |

---

## Enums

### `RawDocumentStatus`

Status progression for non-generated documents.

| Status        | Description                                              |
| ------------- | -------------------------------------------------------- |
| `Requested` | Initial state; document has been requested from patient  |
| `Pending`   | Patient or staff has submitted; awaiting review/approval |
| `Recorded`  | Staff has approved/recorded the document                 |
| `Archived`  | Document has been archived                               |

---

## Endpoints

### Patient Endpoints

#### Non-Generated Documents (Requests)

**GET `/patient/documents/requests`**

- **Middleware:** `jwtProtect('patient')`
- **Description:** List all document requests for authenticated patient (status = `Requested`)
- **Query Params:** None
- **Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": 1,
      "label": "Medical Certificate",
      "isActive": true,
      "submission": {
        "id": 101,
        "status": "Requested",
        "recordedBy": null,
        "submittedAt": "2026-04-04T10:30:00Z"
      }
    }
  ]
}
```

**POST `/patient/documents/requests/:documentId`**

- **Middleware:** `jwtProtect('patient')`
- **Description:** Submit document request with optional file upload
- **Params:** `documentId` (document tag ID)
- **Request Body:**

```json
{
  "file": "uuid-of-uploaded-file"
}
```

- **Transaction:** YES (atomic with file promotion)
- **File Operations:**
  - Promotes temporary file to permanent storage using `promoteFile(patientId, file, 'documents')`
  - If existing file, deletes old file after successful DB update
  - On error: rolls back transaction and cleans up promoted file
- **Status Validation:**
  - `Pending`: Requires file in request body (allows file replacement)
  - `Recorded`/`Archived`: Returns 400 error (document already processed)
  - `Requested`: Creates new submission with `Pending` status
- **Response:**

```json
{
  "success": true,
  "submissionId": 101
}
```

#### Generated Documents (Read-Only)

**GET `/patient/documents/me`**

- **Middleware:** `jwtProtect('patient')`
- **Description:** List all generated documents for authenticated patient
- **Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": 201,
      "templateType": "medical_certificate",
      "description": "Medical Certificate",
      "issuedBy": {
        "id": 50,
        "name": "Dr. John Smith"
      },
      "expiredAt": "2027-04-04T00:00:00Z",
      "createdAt": "2026-04-04T14:20:00Z"
    }
  ]
}
```

**GET `/patient/documents/me/:docType`**

- **Middleware:** `jwtProtect('patient')`
- **Description:** List generated documents of specific type for authenticated patient
- **Params:** `docType` (template identifier)
- **Response:** Same format as `/me`

---

### Staff Endpoints

#### Non-Generated Documents (Management)

**GET `/staff/documents/required`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** List all required documents for a patient
- **Query Params:** `patientId` (required)
- **Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": 1,
      "label": "Medical Certificate",
      "isActive": true,
      "submission": {
        "id": 101,
        "file": "uuid-of-file",
        "status": "Pending",
        "recordedBy": 50,
        "archivedAt": null,
        "submittedAt": "2026-04-04T10:30:00Z"
      }
    }
  ]
}
```

**GET `/staff/documents/required/:documentId`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** Get specific required document details for a patient
- **Query Params:** `patientId` (required)
- **Params:** `documentId` (document tag ID)
- **Response:**

```json
{
  "success": true,
  "document": {
    "id": 1,
    "label": "Medical Certificate",
    "isActive": true,
    "submission": {
      "id": 101,
      "file": "uuid-of-file",
      "status": "Pending",
      "recordedBy": {
        "id": 50,
        "name": "Dr. John Smith"
      },
      "archivedAt": null,
      "submittedAt": "2026-04-04T10:30:00Z"
    }
  }
}
```

**POST `/staff/documents/required/:documentId`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** Record/approve a required document with optional file
- **Params:** `documentId` (document tag ID)
- **Request Body:**

```json
{
  "patientId": 100,
  "file": "uuid-of-uploaded-file"
}
```

- **Transaction:** YES (atomic with file promotion)
- **File Operations:**
  - Promotes temporary file to permanent storage
  - If existing submission has file: deletes old file after successful DB update
  - On error: rolls back and cleans up promoted file
- **Behavior:**
  - If submission exists: updates status to `Recorded` and sets `recordedBy`
  - If no submission: creates new with status `Recorded`
- **Response:**

```json
{
  "success": true,
  "submissionId": 101
}
```

#### Generated Documents (Templates & Generation)

**GET `/staff/documents/templates`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** List all available document templates
- **Response:**

```json
{
  "success": true,
  "templates": [
    {
      "type": "medical_certificate",
      "displayName": "Medical Certificate",
      "description": "Official medical clearance certificate"
    }
  ]
}
```

**GET `/staff/documents/templates/:docType/sample`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** Get sample data for template
- **Params:** `docType` (template identifier)
- **Response:**

```json
{
  "success": true,
  "data": {
    "patient": { "firstName": "John", "lastName": "Doe" },
    "physician": { "firstName": "Jane", "title": "MD" }
  }
}
```

**POST `/staff/documents/:docType/preview`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** Preview document without saving (streaming PDF)
- **Params:** `docType` (template identifier)
- **Request Body:**

```json
{
  "data": {
    "patient": { "id": 100, "firstName": "John" },
    "physician": { "id": 50, "firstName": "Jane" }
  }
}
```

- **Response:** PDF stream (binary)
- **Note:** No database persistence

**POST `/staff/documents/:docType/generate`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** Generate and save document to database or stream
- **Params:** `docType` (template identifier)
- **Request Body:**

```json
{
  "patientId": 100,
  "data": {
    "patient": { "firstName": "John" },
    "physician": { "firstName": "Jane" },
    "expiredAt": "2027-04-04T00:00:00Z"
  }
}
```

- **Behavior:**
  - Auto-fills physician details from database if not provided
  - If `shouldPersist(docType)`: saves to DB and notifies patient
  - Otherwise: streams PDF without saving
- **Physician Auto-Fill:** First name, last name, title, specialization
- **Notification:** Sends socket notification to patient when document is generated
- **Response (Persist):**

```json
{
  "success": true,
  "documentId": 201,
  "filename": "medical_certificate.pdf",
  "metadata": {}
}
```

- **Response (Stream):** PDF binary stream

#### Generated Documents (Access & Retrieval)

**GET `/staff/documents/:docType/patient/:patientId`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** List documents of specific type for a patient
- **Params:** `docType`, `patientId`
- **Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": 201,
      "templateType": "medical_certificate",
      "description": "Medical Certificate",
      "issuedBy": {
        "id": 50,
        "name": "Dr. John Smith"
      },
      "expiredAt": "2027-04-04T00:00:00Z",
      "createdAt": "2026-04-04T14:20:00Z"
    }
  ]
}
```

**GET `/staff/documents/:docType/patients`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** List all patients with documents of specific type
- **Params:** `docType`
- **Response:**

```json
{
  "success": true,
  "patients": [
    {
      "id": 100,
      "name": "John Doe",
      "documentCount": 3,
      "lastDocumentAt": "2026-04-04T14:20:00Z"
    }
  ]
}
```

**GET `/staff/documents/:docType`**

- **Middleware:** `jwtProtect('medical')`
- **Description:** List all documents of specific type across all patients
- **Params:** `docType`
- **Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": 201,
      "patient": {
        "id": 100,
        "name": "John Doe"
      },
      "templateType": "medical_certificate",
      "description": "Medical Certificate",
      "issuedBy": {
        "id": 50,
        "name": "Dr. John Smith"
      },
      "expiredAt": "2027-04-04T00:00:00Z",
      "createdAt": "2026-04-04T14:20:00Z"
    }
  ]
}
```

---

## File Handling & Transactions

### File Promotion Pattern

All file uploads follow an atomic transaction pattern:

1. **Pre-Upload:** Temporary file stored in uploads bucket
2. **During Request:**
   - Begin transaction
   - Promote temporary file to permanent storage
3. **Post-Promotion:**
   - Update/insert database records
   - If updating with new file: delete old file after successful commit
4. **On Error:**
   - Rollback transaction
   - Delete promoted file to prevent orphans
   - Return error response

### Implementation Details

```javascript
const client = await connect();
let promotedFile = null;
try {
  await client.query('BEGIN');

  // Promote file before DB operation
  if (file) {
    promotedFile = await promoteFile(userId, file, 'documents');
  }

  // Database operation
  const result = await client.query(updateSQL, params);

  // Delete old file only after successful commit
  if (oldFile && promotedFile !== oldFile) {
    await deleteFile('documents', oldFile);
  }

  await client.query('COMMIT');
} catch (err) {
  // Cleanup promoted file on error
  if (promotedFile) {
    await deleteFile('documents', promotedFile);
  }
  await client.query('ROLLBACK');
}
```

### Error Handling

| Scenario                  | Status Code | Error Code                                                   | Action                                   |
| ------------------------- | ----------- | ------------------------------------------------------------ | ---------------------------------------- |
| Invalid file              | 400         | `INVALID_FILE`                                             | Rollback, cleanup promoted file          |
| File deletion fails       | 500         | `FILE_DELETE_ERROR`                                        | Rollback, cleanup both old and new files |
| Document not found        | 404         | `DOCUMENT_NOT_FOUND`                                       | Rollback (if in transaction)             |
| Status transition invalid | 400         | `REQUEST_ALREADY_PENDING` / `DOCUMENT_ALREADY_PROCESSED` | Rollback                                 |

---

## Status Progression

### Non-Generated Documents (Staff Perspective)

```
Requested
    ↓
 Pending (patient submits with file)
    ↓
 Recorded (staff approves)
    ↓
 Archived (optional)
```

### Non-Generated Documents (Patient Perspective)

```
Requested (staff requests document)
    ↓
 Pending (patient submits)
    ↓
 Recorded (staff confirms)
```

**Validation Rules:**

- Patient can only submit to `Requested` documents
- `Pending` documents require file upload to proceed
- `Recorded`/`Archived` documents cannot be modified
- Staff can directly record without patient submission

---

## Notifications

### Generated Document Notification

When staff generates a document that should persist:

```json
{
  "event": "document:new",
  "payload": {
    "documentId": 201,
    "templateType": "medical_certificate",
    "issuedBy": "Dr. Jane Smith",
    "message": "A new medical certificate has been issued for you by Dr. Jane Smith."
  }
}
```

**Delivery:** WebSocket to patient (`notifyUser(patientId, 'document:new', payload)`)
**Timing:** After successful document generation and DB insert
**On Failure:** Logged as warning; generation succeeds even if notification fails

---

## Permissions

| Endpoint                  | Required Permission       | Role          |
| ------------------------- | ------------------------- | ------------- |
| Patient requests          | `jwtProtect('patient')` | Patient only  |
| Staff document management | `jwtProtect('medical')` | Medical staff |
| Staff template generation | `jwtProtect('medical')` | Medical staff |

---

## Examples

### Patient: Submit Document Request

```bash
POST /patient/documents/requests/1
Content-Type: application/json
Authorization: Bearer <patient-token>

{
  "file": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "success": true,
  "submissionId": 101
}
```

### Staff: Record Required Document

```bash
POST /staff/documents/required/1
Content-Type: application/json
Authorization: Bearer <staff-token>

{
  "patientId": 100,
  "file": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "success": true,
  "submissionId": 101
}
```

### Staff: Generate Document

```bash
POST /staff/documents/medical_certificate/generate
Content-Type: application/json
Authorization: Bearer <staff-token>

{
  "patientId": 100,
  "data": {
    "patient": {
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-15"
    },
    "physician": {
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "expiredAt": "2027-04-04T00:00:00Z"
  }
}
```

**Response:**

```json
{
  "success": true,
  "documentId": 201,
  "filename": "medical_certificate_2026_04_04.pdf",
  "metadata": {}
}
```

### Staff: Preview Document (No Save)

```bash
POST /staff/documents/medical_certificate/preview
Content-Type: application/json
Authorization: Bearer <staff-token>

{
  "data": {
    "patient": {
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

**Response:** PDF stream (binary)

---

## Implementation Notes

### Key Features

1. **Atomic File Operations:** All file promotions wrapped in transactions
2. **Orphan Prevention:** Old files deleted only after successful commits
3. **Automatic Cleanup:** Failed operations clean up promoted files
4. **Physician Auto-Fill:** Staff details auto-populated from database
5. **Patient Notifications:** Real-time socket notifications for new documents
6. **Multi-Template Support:** Flexible template system with persistence control

### Database Indexes (Recommended)

```sql
CREATE INDEX idx_patientRawDocument_patientId_status
  ON "patientRawDocument"("patientId", "status");

CREATE INDEX idx_PatientDocuments_patientId_templateId
  ON "PatientDocuments"("patientId", "templateId");

CREATE INDEX idx_PatientDocuments_createdAt
  ON "PatientDocuments"("created_at" DESC);

CREATE INDEX idx_documentTemplate_template
  ON "documentTemplate"("template");
```

### Integration Points

- **File Storage:** Uses `promoteFile` / `deleteFile` from multer config
- **Database:** PostgreSQL with transaction support
- **Notifications:** WebSocket via socket-emitter
- **Logging:** Winston logger with structured logging
- **Authentication:** JWT via jwtProtect middleware
- **Document Generation:** Custom docGen module service

---

## Troubleshooting

### Common Issues

| Issue                               | Cause                                            | Solution                                   |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| "INVALID_FILE" error                | File UUID doesn't exist in temp storage          | Ensure file is uploaded before submitting  |
| FILE_DELETE_ERROR                   | Old file already deleted by concurrent operation | Idempotent; safe to retry                  |
| Document not updating               | Transaction lock contention                      | Retry operation (DB will handle conflicts) |
| Patient not receiving notifications | Socket connection inactive                       | Check WebSocket connection status          |

### Logging

All operations log with:

- Operation type (submit, record, generate, etc.)
- Associated IDs (documentId, patientId, submissionId)
- File operations (promotion, deletion)
- Timestamps for debugging

---

## Version History

| Version | Date       | Changes                                                                 |
| ------- | ---------- | ----------------------------------------------------------------------- |
| 1.0     | 2026-04-04 | Initial implementation with non-generated and generated document routes |
