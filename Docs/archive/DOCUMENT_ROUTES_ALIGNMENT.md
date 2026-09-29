# Document Routes Alignment Verification

## Routes Overview

### Patient Routes (document-patient.js)

#### Non-Generated Documents

```
GET  /documents/requests              → List all document requests (Requested status)
POST /documents/requests/:documentId   → Submit document with file (atomic with promotion)
```

#### Generated Documents

```
GET  /documents/me                     → List all patient's documents
GET  /documents/me/:docType            → List patient's documents by type
```

### Staff Routes (document-staff.js)

#### Non-Generated Documents

```
GET  /documents/required               → List all required documents (query: patientId)
GET  /documents/required/:documentId   → Get specific document (query: patientId)
POST /documents/required/:documentId   → Record document with file (atomic with promotion)
```

#### Generated Documents - Templates

```
GET  /documents/templates              → List available templates
GET  /documents/templates/:docType/sample → Get sample data for template
```

#### Generated Documents - Generation

```
POST /documents/:docType/preview       → Preview PDF (no save)
POST /documents/:docType/generate      → Generate and save/stream document
```

#### Generated Documents - Access

```
GET  /documents/:docType/patient/:patientId    → List documents of type for patient
GET  /documents/:docType/patients              → List all patients with documents of type
GET  /documents/:docType                       → List all documents of specific type
```

---

## Alignment Matrix

### Authentication & Authorization

| Route                                            | Auth        | Type               | Query Params  | Body Params                    | File Handling                     |
| ------------------------------------------------ | ----------- | ------------------ | ------------- | ------------------------------ | --------------------------------- |
| **Patient GET /requests**                  | `patient` | Public             | None          | None                           | N/A                               |
| **Patient POST /requests/:id**             | `patient` | Atomic Transaction | None          | `file` (UUID)                | ✓ Promote + Replace + Delete Old |
| **Patient GET /me**                        | `patient` | Public             | None          | None                           | N/A                               |
| **Patient GET /me/:docType**               | `patient` | Public             | None          | None                           | N/A                               |
| **Staff GET /required**                    | `medical` | Public             | `patientId` | None                           | N/A                               |
| **Staff GET /required/:id**                | `medical` | Public             | `patientId` | None                           | N/A                               |
| **Staff POST /required/:id**               | `medical` | Atomic Transaction | None          | `patientId`, `file` (UUID) | ✓ Promote + Replace + Delete Old |
| **Staff GET /templates**                   | `medical` | Public             | None          | None                           | N/A                               |
| **Staff GET /templates/:docType/sample**   | `medical` | Public             | None          | None                           | N/A                               |
| **Staff POST /:docType/preview**           | `medical` | Stream             | None          | `data` object                | N/A (Stream only)                 |
| **Staff POST /:docType/generate**          | `medical` | Transaction*       | None          | `patientId`, `data` object | *If persist=true                  |
| **Staff GET /:docType/patient/:patientId** | `medical` | Public             | None          | None                           | N/A                               |
| **Staff GET /:docType/patients**           | `medical` | Public             | None          | None                           | N/A                               |
| **Staff GET /:docType**                    | `medical` | Public             | None          | None                           | N/A                               |

### Database Operations

| Route                                            | Tables Involved                                                | Transactional       | File Operations     | Notifications       |
| ------------------------------------------------ | -------------------------------------------------------------- | ------------------- | ------------------- | ------------------- |
| **Patient GET /requests**                  | `rawDocumentTag` ⧵ `patientRawDocument`                   | No                  | N/A                 | N/A                 |
| **Patient POST /requests/:id**             | `patientRawDocument`                                         | ✓ YES              | Promote, Delete Old | None                |
| **Patient GET /me**                        | `PatientDocuments` ⧵ `documentTemplate`                   | No                  | N/A                 | N/A                 |
| **Patient GET /me/:docType**               | `PatientDocuments` ⧵ `documentTemplate`                   | No                  | N/A                 | N/A                 |
| **Staff GET /required**                    | `rawDocumentTag` ⧵ `patientRawDocument`                   | No                  | N/A                 | N/A                 |
| **Staff GET /required/:id**                | `rawDocumentTag` ⧵ `patientRawDocument`                   | No                  | N/A                 | N/A                 |
| **Staff POST /required/:id**               | `patientRawDocument`                                         | ✓ YES              | Promote, Delete Old | None                |
| **Staff GET /templates**                   | None (service call)                                            | No                  | N/A                 | N/A                 |
| **Staff GET /templates/:docType/sample**   | None (service call)                                            | No                  | N/A                 | N/A                 |
| **Staff POST /:docType/preview**           | None (service call)                                            | No                  | N/A                 | N/A                 |
| **Staff POST /:docType/generate**          | `documentTemplate` + `PatientDocuments` + `documentData` | ✓ YES (if persist) | None                | ✓ YES (if persist) |
| **Staff GET /:docType/patient/:patientId** | `PatientDocuments` ⧵ `documentTemplate`                   | No                  | N/A                 | N/A                 |
| **Staff GET /:docType/patients**           | `PatientDocuments` ⧵ `documentTemplate`                   | No                  | N/A                 | N/A                 |
| **Staff GET /:docType**                    | `PatientDocuments` ⧵ `documentTemplate`                   | No                  | N/A                 | N/A                 |

---

## Transaction & File Handling Alignment

### Atomic Operations

```
POST /documents/requests/:documentId
POST /documents/required/:documentId
POST /documents/:docType/generate    (if shouldPersist=true)
```

All follow this pattern:

```
BEGIN TRANSACTION
  ↓
PROMOTE FILE (if provided)
  ↓
EXECUTE SQL (INSERT/UPDATE)
  ↓
DELETE OLD FILE (if replacing)
  ↓
COMMIT TRANSACTION
  ↓
NOTIFY (if applicable)

ON ERROR:
  ROLLBACK TRANSACTION
  CLEANUP promoted file
  CLEANUP converted file (if any)
```

### File Promotion Details

| Endpoint               | Storage Category | User Context    | File Cleanup            |
| ---------------------- | ---------------- | --------------- | ----------------------- |
| Patient POST /requests | `'documents'`  | `patientId`   | After commit + old file |
| Staff POST /required   | `'documents'`  | `req.user.id` | After commit + old file |

---

## Response Format Consistency

All endpoints follow unified response format:

### Success Response

```json
{
  "success": true,
  "data": { ... } or "documentId": X or "documents": [ ... ]
}
```

### Error Response

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

### HTTP Status Codes

- `200` - Successful GET / POST
- `201` - Created (POST new)
- `400` - Bad request (validation, status conflict)
- `404` - Not found (document, tag, template)
- `500` - Server error (file operations, DB errors)

---

## Data Flow Alignment

### Non-Generated Document Flow

```
    PATIENT SIDE                STAFF SIDE

    Requests list          →    Required list
    (GET /requests)            (GET /required)
         ↓                           ↓
    Submit with file       →    Record with file
    (POST /requests/:id)       (POST /required/:id)
    Status: Pending        ←    Status: Recorded
         ↓
    Transaction ensures atomic file promotion & old file deletion
```

### Generated Document Flow

```
    STAFF GENERATION
         ↓
    Select Template
    (GET /templates)
         ↓
    Preview (optional)
    (POST /:docType/preview)
         ↓
    Generate & Save
    (POST /:docType/generate)
         ↓
    Transaction + Notification

         ↓

    PATIENT ACCESS
         ↓
    View My Documents
    (GET /me or /me/:docType)
```

---

## Import Consistency

### Staff Route File (document-staff.js)

```javascript
const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');        ✓ Added
const { promoteFile, deleteFile } = require('../../../config/multer.js');  ✓ Added
const docGen = require('../../../services/doc-generate-module/index.js');
const { notifyUser } = require('../../../config/sockets/socket-emitter.js');
```

### Patient Route File (document-patient.js)

```javascript
const express = require('express');
const logger = require('../../../utils/logger.js');
const { jwtProtect } = require('../../../config/middleware/jwtProtect.js');
const db = require('../../../config/db.js');
const { connect } = require('../../../config/query.js');        ✓ Added
const { promoteFile, deleteFile } = require('../../../config/multer.js');  ✓ Added
```

---

## Status: ALIGNED ✓

All routes are properly aligned:

- ✓ Authentication & permissions correct
- ✓ Transaction patterns consistent
- ✓ File handling uniform
- ✓ Database operations aligned
- ✓ Error handling standardized
- ✓ Response formats consistent
- ✓ Imports complete and correct
- ✓ Naming conventions maintained
- ✓ Middleware usage consistent

---

## Integration Checklist

- [X] Route files exist and are properly structured
- [X] File promotion pattern implemented (both patient and staff)
- [X] Atomic transactions with proper rollback
- [X] Old file cleanup logic correct
- [X] Error handling and cleanup in place
- [X] Logging calls consistent
- [X] Response formats aligned
- [X] Documentation complete
