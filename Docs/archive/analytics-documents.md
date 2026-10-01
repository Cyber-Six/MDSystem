# Analytics & Documents Module

Handles analytics data queries for frontend rendering and PDF document generation.

---

## Endpoints

| Endpoint | Middleware | Description |
|----------|-----------|-------------|
| `POST /analytics/*` | `jwtProtect("medical")` | Analytics queries and reports (staff only) |
| `POST /documents/*` | `jwtProtect("medical")` | Document generation (staff only) |
| `GET /documents/my/*` | `jwtProtect("patient")` | Patient document access |

---

## Route Structure

```
/analytics
  GET  /queries                  → List available query types
  GET  /reports                  → List available report types
  GET  /query/:dataType          → Get data for frontend rendering
  GET  /report/:reportType       → Generate PDF report

/documents
  GET  /templates                → List available templates
  GET  /templates/:type/sample   → Get sample data for template
  POST /:docType/preview         → Preview document (stream)
  POST /:docType/generate        → Generate document (save or stream)
  GET  /patient/:patientId       → List patient's documents (staff)
  GET  /:documentId              → Download document (staff)
  GET  /my                       → List own documents (patient)
  GET  /my/:documentId           → View own document (patient)
```

---

## Analytics Module

### GET /analytics/query/:dataType

Returns data points for the frontend to render charts/graphs.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | Yes | `Manila`, `QuezonCity`, or `Both` |
| `startDate` | string | Yes | ISO date (YYYY-MM-DD) |
| `endDate` | string | Yes | ISO date (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "dataType": "consultations-by-type",
  "branch": "Manila",
  "dateRange": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "data": {
    "labels": ["Medical", "Dental"],
    "values": [120, 45],
    "total": 165
  }
}
```

### GET /analytics/report/:reportType

Generates and streams a PDF report.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | Yes | `Manila`, `QuezonCity`, or `Both` |
| `startDate` | string | Yes | ISO date (YYYY-MM-DD) |
| `endDate` | string | Yes | ISO date (YYYY-MM-DD) |
| `title` | string | No | Custom report title |

**Response:** PDF file stream

---

## Adding Custom Analytics Queries

Edit `services/analytics-query.js`:

### Step 1: Create Query Function

```javascript
async function myCustomQuery(branch, startDate, endDate) {
  const result = await db.query(`
    SELECT
      some_column as label,
      COUNT(*) as value
    FROM "SomeTable"
    WHERE created_at BETWEEN $1 AND $2
      AND ($3 = 'Both' OR branch = $3)
    GROUP BY some_column
  `, [startDate, endDate, branch]);

  return {
    labels: result.rows.map(r => r.label),
    values: result.rows.map(r => parseInt(r.value)),
    total: result.rows.reduce((sum, r) => sum + parseInt(r.value), 0),
  };
}
```

### Step 2: Register in QUERY_HANDLERS

```javascript
const QUERY_HANDLERS = {
  'my-custom-query': {
    handler: myCustomQuery,
    description: 'My custom analytics query',
  },
};
```

### Step 3: Use the Query

```
GET /analytics/query/my-custom-query?branch=Manila&startDate=2026-01-01&endDate=2026-01-31
```

---

## Adding Custom Reports

### Step 1: Create Report Data Function

```javascript
async function myCustomReport(branch, startDate, endDate) {
  // Fetch data from multiple sources
  const consultations = await db.query(...);
  const appointments = await db.query(...);

  return {
    sections: [
      {
        title: 'Consultations Overview',
        chartType: 'pie',  // pie, bar, line, doughnut
        labels: ['Medical', 'Dental'],
        values: [120, 45],
        summary: 'Total: 165',
      },
      // Add more sections...
    ],
    summary: {
      totalConsultations: 165,
      totalAppointments: 200,
    },
  };
}
```

### Step 2: Register in REPORT_HANDLERS

```javascript
const REPORT_HANDLERS = {
  'monthly-summary': {
    handler: myCustomReport,
    description: 'Monthly Summary Report',
    template: 'staff-report',  // PDF template to use
  },
};
```

### Step 3: Generate the Report

```
GET /analytics/report/monthly-summary?branch=Manila&startDate=2026-01-01&endDate=2026-01-31
```

---

## Document Module

### POST /documents/:docType/generate

Generate a patient document.

**URL Parameter:**
- `:docType` — Template type (e.g., `medical-certificate`, `prescription`)

**Body:**
```json
{
  "patientId": 123,
  "data": {
    "patient": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "purpose": "Fit to work",
    "diagnosis": "No significant findings"
  }
}
```

**Response (if persisted):**
```json
{
  "success": true,
  "documentId": 456,
  "filename": "medical-certificate_Doe_John_2026-01-15.pdf"
}
```

**Response (if not persisted):** PDF file stream

### GET /documents/my (Patient)

List patient's own documents.

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": 456,
      "templateType": "medical-certificate",
      "description": "Medical Certificate",
      "issuedBy": { "id": 1, "name": "Dr. Smith" },
      "expiredAt": null,
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Document Templates

### Available Templates

| Type | Display Name | Persisted |
|------|--------------|-----------|
| `medical-certificate` | Medical Certificate | Yes |
| `prescription` | Prescription | Yes |
| `diagnosis-report` | Diagnosis Report | No (stream only) |
| `staff-report` | Staff Analytics Report | No (stream only) |

### Template `persistToDatabase` Flag

- `true` — Document saved to database, viewable by patient
- `false` — Document streamed directly, not saved

---

## Database Tables

### PatientDocuments

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | |
| `patientId` | FK | References `Patients.id` |
| `templateId` | FK | References `documentTemplate.id` |
| `issuedBy` | FK | References `MedicalPersonnel.id` |
| `expired_at` | timestamp | Optional expiration |
| `created_at` | timestamp | |

### documentTemplate

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | |
| `template` | varchar(50) | Template type identifier |
| `description` | text | Display name |
| `revisedDate` | varchar(7) | YYYY-MM format |
| `createdBy` | FK | |

### documentData

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | |
| `documentId` | FK | References `PatientDocuments.id` |
| `data` | text | Base64 encoded PDF |

---

## File Structure

```
services/
  analytics-query.js              # Query/report handlers registry
  doc-generate-module/
    index.js                      # Template registry & generation
    base-template.js              # Base PDF template class
    templates/
      medical-certificate.js      # Patient document (persisted)
      prescription.js             # Patient document (persisted)
      diagnosis-report.js         # Staff report (stream only)
      staff-report.js             # Analytics report (stream only)

routes/documents/
  index.js                        # Route exports
  documents.js                    # Document routes
  analytics.js                    # Analytics routes
```

---

## Mounting Routes

Add to `server.js`:

```javascript
const { documents, analytics } = require('./routes/documents/index.js');

app.use('/documents', documents);
app.use('/analytics', analytics);
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `BRANCH_REQUIRED` | Missing branch parameter |
| `DATE_RANGE_REQUIRED` | Missing startDate or endDate |
| `INVALID_BRANCH` | Branch not Manila, QuezonCity, or Both |
| `INVALID_DATE_FORMAT` | Invalid date format |
| `INVALID_DATE_RANGE` | endDate before startDate |
| `BRANCH_ACCESS_DENIED` | User lacks branch access |
| `QUERY_NOT_FOUND` | Unknown dataType |
| `REPORT_NOT_FOUND` | Unknown reportType |
| `TEMPLATE_NOT_FOUND` | Unknown docType |
| `PATIENT_ID_REQUIRED` | Missing patientId for persisted doc |
| `DOCUMENT_NOT_FOUND` | Document ID not found |
| `DOCUMENT_DATA_NOT_FOUND` | Document data missing |
