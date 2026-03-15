# MDS Document Service

A standalone **FastAPI** microservice for generating medical documents (DOCX), converting them to PDF, rendering in-browser HTML previews, and generating analytics reports with embedded **Matplotlib charts**. Designed to be called from the Node.js/Express backend over HTTP on localhost.

```
Express (Node.js) ──HTTP POST──▶ FastAPI (Python) ──▶ DOCX / PDF / HTML
                        │
                        └── PostgreSQL (DB queries for tag values / report rows)
```

---

## Table of Contents

- [Setup](#setup)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [Chart Generation](#chart-generation)
- [API Reference](#api-reference)
  - [Health Check](#get-health)
  - [List Templates](#get-documentstemplates)
  - [List Tag Contracts](#get-documentscontracts)
  - [Generate DOCX](#post-documentsgenerate)
  - [Preview Document](#post-documentspreview)
  - [Generate PDF](#post-documentspdf)
  - [Generate DOCX (Legacy)](#post-generate-docx)
  - [Report PDF](#post-reportspdf)
  - [Report Preview](#post-reportspreview)
- [Express Proxy Routes](#express-proxy-routes)
  - [DB-Orchestrated Document Route](#post-documentscreatedocumenttemplate)
  - [DB-Orchestrated Report Route](#post-documentscreatetemplate-route)
- [Calling from Node.js](#calling-from-nodejs)
- [Tag Contracts](#tag-contracts)
- [Creating New Templates](#creating-new-templates)
- [Project Structure](#project-structure)
- [Lifecycle Manager (Node.js)](#lifecycle-manager-nodejs)

---

## Setup

### Prerequisites

- Python 3.10+
- `pip` (comes with Python)

### Install

```bash
cd Backend/services/docx-generation

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt
```

### Generate Template Files

The first time you set up the service, generate the standard `.docx` templates:

```bash
python create_templates.py
```

This creates four `.docx` files in `templates/`:

| File                         | Document Type       |
| ---------------------------- | ------------------- |
| `medical_certificate.docx` | Medical Certificate |
| `medical_clearance.docx`   | Medical Clearance   |
| `prescription.docx`        | Prescription        |
| `lab_referral.docx`        | Lab Referral        |

---

## Configuration

All configurable values live in **`config.py`** and are read from `Backend/.env`. No other module reads environment variables directly.

Add these to your `Backend/.env`:

```env
# ── Document Service ──────────────────────────────
DOCX_GENERATED_PORT=8000             # Port the FastAPI service listens on
DOCX_SERVICE_HOST=127.0.0.1         # Host to bind (default: 127.0.0.1)
TEMPLATE_PATH=services/docx-generation/templates   # Path to .docx templates (relative to Backend/ or absolute)
DOCX_LOG_LEVEL=INFO                  # Logging level: DEBUG, INFO, WARNING, ERROR
```

### Config Variables Reference

| Variable                | `config.py` Name        | Default                  | Description                                                                             |
| ----------------------- | ------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `DOCX_GENERATED_PORT` | `SERVICE_PORT`          | `3002`                 | Port the service listens on                                                             |
| `DOCX_SERVICE_HOST`   | `SERVICE_HOST`          | `127.0.0.1`            | Bind address                                                                            |
| `TEMPLATE_PATH`       | `TEMPLATE_DIR`          | `""`                   | Directory containing `.docx` templates. Relative paths are resolved from `Backend/` |
| `DOCX_LOG_LEVEL`      | `LOG_LEVEL`             | `INFO`                 | Python logging level                                                                    |
| *(internal)*          | `GENERATED_DIR`         | `./generated/`         | Output directory for debug artifacts                                                    |
| *(internal)*          | `PREVIEW_TEMPLATES_DIR` | `./templates/preview/` | Jinja2 HTML preview templates                                                           |
| *(internal)*          | `REPORT_TEMPLATES_DIR`  | `./templates/reports/` | Jinja2 HTML report templates                                                            |

> **No additional `.env` variables are required for chart generation.** Matplotlib runs fully in-process with no external dependencies.

---

## Running the Service

```bash
cd Backend/services/docx-generation
source venv/bin/activate
python main.py
```

The service starts on `http://127.0.0.1:8000` (or whatever port/host is configured).

Verify it's running:

```bash
curl http://127.0.0.1:8000/health
# {"status":"healthy","service":"MDS Document Service"}
```

---

## Chart Generation

Chart generation is powered by **Matplotlib** (`modules/chart_generator.py`) and is available in both **documents** (DOCX/PDF) and **reports** (PDF).

### How It Works

Tag values in a document or report request can be either:

| Value type | Behaviour |
|---|---|
| `"string"` | Plain text replacement — inserted at the `{{ TAG_NAME }}` placeholder |
| `{ "graph": "...", "datas": {...} }` | Matplotlib chart image generated and embedded in the output |

### Chart Spec Format

```json
{
  "graph": "bar",
  "datas": {
    "labels": ["Jan", "Feb", "Mar"],
    "values": [10, 25, 18],
    "title": "Monthly Consultations",
    "xlabel": "Month",
    "ylabel": "Count",
    "colors": ["#4C9BE8", "#E84C4C", "#4CE88A"]
  }
}
```

| Field     | Type            | Required | Description                                            |
|-----------|-----------------|----------|--------------------------------------------------------|
| `graph`   | string          | yes      | Chart type: `"bar"`, `"line"`, or `"pie"`            |
| `labels`  | array of string | yes      | Category labels (x-axis for bar/line, slices for pie) |
| `values`  | array of number | yes      | Numeric values — must match length of `labels`        |
| `title`   | string          | no       | Chart title (bold, above the chart)                    |
| `xlabel`  | string          | no       | X-axis label (bar and line only)                       |
| `ylabel`  | string          | no       | Y-axis label (bar and line only)                       |
| `colors`  | array of string | no       | Hex color codes; falls back to defaults if omitted     |

### Supported Chart Types

| Type    | Description                                                      |
|---------|------------------------------------------------------------------|
| `bar`   | Vertical bar chart; auto-rotates x labels if more than 6 items  |
| `line`  | Line chart with circular markers and light grid lines            |
| `pie`   | Pie chart with percentage labels; uses `Set3` palette by default |

### In Documents (DOCX/PDF)

Charts are embedded as `InlineImage` objects via `docxtpl`. The `.docx` template must contain an `{{ TAG_NAME }}` placeholder where the `docx` template supports inline images (typically in a table cell or paragraph). The image is 140 mm wide.

```json
{
  "template": "medical_certificate",
  "data": {
    "NAME": "Juan Dela Cruz",
    "DATE": "2026-03-16",
    "DIAGNOSIS": "Flu",
    "LICENSE_NO": "PRC-0012345",
    "TREND_CHART": {
      "graph": "line",
      "datas": {
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "values": [4, 7, 3, 8, 5],
        "title": "Daily Consultation Trend"
      }
    }
  }
}
```

### In Reports (PDF)

Charts are passed in a top-level `charts` array. Each spec is rendered as a PNG, base64-encoded, and embedded as an `<img>` tag in the HTML report above the data table. WeasyPrint then converts the full HTML (charts + table) to PDF.

```json
{
  "title": "Monthly Consultations",
  "report_type": "consultations",
  "columns": [...],
  "data": [...],
  "charts": [
    {
      "graph": "bar",
      "datas": {
        "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
        "values": [12, 19, 8, 15],
        "title": "Weekly Count"
      }
    },
    {
      "graph": "pie",
      "datas": {
        "labels": ["Flu", "Cough", "Fever"],
        "values": [40, 35, 25],
        "title": "Diagnosis Breakdown"
      }
    }
  ]
}
```

---

## API Reference

Base URL: `http://127.0.0.1:{DOCX_GENERATED_PORT}`

All POST endpoints accept `Content-Type: application/json`.

### Response Modes

The `/documents/generate` and `/documents/pdf` endpoints support two response modes based on the `Accept` header:

| `Accept` Header       | Response                         | Use Case                            |
| ----------------------- | -------------------------------- | ----------------------------------- |
| *(default / omitted)* | Raw binary stream                | Browser downloads, Express proxy    |
| `application/json`    | JSON with base64-encoded content | Node.js API calls, programmatic use |

---

### `GET /health`

Liveness / readiness probe.

**Response:**

```json
{
  "status": "healthy",
  "service": "MDS Document Service"
}
```

---

### `GET /documents/templates`

List all available `.docx` templates in the configured template directory.

**Response:**

```json
{
  "templates": [
    { "name": "medical_certificate", "filename": "medical_certificate.docx" },
    { "name": "medical_clearance",   "filename": "medical_clearance.docx" },
    { "name": "prescription",        "filename": "prescription.docx" },
    { "name": "lab_referral",        "filename": "lab_referral.docx" }
  ]
}
```

---

### `GET /documents/contracts`

Returns the tag contracts for all registered document types. Use this to know which tags each template requires.

**Response:**

```json
{
  "contracts": [
    {
      "template": "medical_certificate",
      "display_name": "Medical Certificate",
      "description": "Certifies a patient's medical condition or fitness.",
      "tags": [
        { "name": "NAME",      "description": "Full name of the patient", "required": true, "example": "Juan Dela Cruz" },
        { "name": "DATE",      "description": "Date of certificate issuance", "required": true, "example": "2026-03-09" },
        { "name": "DIAGNOSIS", "description": "Medical diagnosis or findings", "required": true, "example": "Acute Upper Respiratory Tract Infection" },
        { "name": "LICENSE_NO","description": "Physician license number", "required": true, "example": "PRC-0012345" }
      ]
    }
  ]
}
```

---

### `POST /documents/generate`

Generate a rendered DOCX from a template.

Pick any `.docx` template from the `TEMPLATE_PATH` directory and pass key-value pairs to fill in the placeholders. Values can be plain strings **or chart specs** (see [Chart Generation](#chart-generation)).

**Request Body:**

```json
{
  "template": "medical_certificate",
  "data": {
    "NAME": "Juan Dela Cruz",
    "DATE": "2026-03-16",
    "DIAGNOSIS": "Acute Flu",
    "LICENSE_NO": "PRC-12345",
    "TREND_CHART": {
      "graph": "bar",
      "datas": {
        "labels": ["Jan", "Feb", "Mar"],
        "values": [10, 25, 18],
        "title": "Monthly Consultations"
      }
    }
  }
}
```

| Field        | Type   | Required | Description                                                                                                                                  |
| ------------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `template` | string | yes      | Template filename — with or without `.docx` extension                                                                                      |
| `data`     | object | yes*     | Tag values. String → text replacement. `{ graph, datas }` → chart image. Keys may use angle brackets (`<NAME>`) — stripped automatically |
| `tags`     | object | no       | Legacy alias for `data`. If both are provided, `data` takes priority                                                                       |

**Binary Response** *(default)*: Raw `.docx` bytes with `Content-Disposition` header.

**JSON Response** *(with `Accept: application/json`)*:

```json
{
  "filename": "medical_certificate.docx",
  "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "content_base64": "UEsDBBQAAAAI...",
  "size": 36879
}
```

**Errors:**

| Status  | When                  |
| ------- | --------------------- |
| `400` | Missing required tags |
| `404` | Template not found    |

---

### `POST /documents/preview`

Generate a DOCX and return a self-contained HTML page with an in-browser preview (rendered via mammoth.js) and a download button.

**Request Body:** Same as `/documents/generate` (`template` + `data`). Chart specs are supported.

**Response:** `text/html` — a complete HTML page you can serve directly to the browser.

---

### `POST /documents/pdf`

Generate a DOCX then convert it to PDF using mammoth (DOCX → HTML) and WeasyPrint (HTML → PDF).

**Request Body:** Same as `/documents/generate` (`template` + `data`). Chart specs are supported.

**Binary Response** *(default)*: Raw PDF bytes.

**JSON Response** *(with `Accept: application/json`)*:

```json
{
  "filename": "medical_certificate.pdf",
  "content_type": "application/pdf",
  "content_base64": "JVBERi0xLjc...",
  "size": 7990
}
```

**Errors:**

| Status  | When                   |
| ------- | ---------------------- |
| `400` | Missing required tags  |
| `404` | Template not found     |
| `500` | PDF conversion failure |

---

### `POST /generate-docx`

Legacy endpoint — identical behavior to `POST /documents/generate`. Kept for backward compatibility.

**Request Body:** Same as `/documents/generate` (supports both `data` and `tags`).

---

### `POST /reports/pdf`

Generate a PDF report from structured tabular data (analytics, consultation summaries, etc.). Supports optional **Matplotlib chart embedding**.

**Request Body:**

```json
{
  "title": "Monthly Consultation Report",
  "report_type": "consultations",
  "columns": [
    { "key": "date",      "label": "Date" },
    { "key": "patient",   "label": "Patient" },
    { "key": "diagnosis", "label": "Diagnosis" }
  ],
  "data": [
    { "date": "2026-03-01", "patient": "Juan Dela Cruz", "diagnosis": "Flu" }
  ],
  "charts": [
    {
      "graph": "bar",
      "datas": {
        "labels": ["Jan", "Feb", "Mar"],
        "values": [10, 25, 18],
        "title": "Monthly Consultations"
      }
    }
  ],
  "filters": { "month": "March 2026" },
  "orientation": "landscape",
  "template": "base.html"
}
```

| Field           | Type   | Required | Default         | Description                                                       |
| --------------- | ------ | -------- | --------------- | ----------------------------------------------------------------- |
| `title`       | string | yes      | —              | Report title                                                      |
| `report_type` | string | yes      | —              | Report category (used for filename)                               |
| `columns`     | array  | yes      | —              | Column definitions `[{ key, label }]`                          |
| `data`        | array  | yes      | —              | Row data as list of dicts                                         |
| `charts`      | array  | no       | `[]`          | Chart specs to embed above the table — see [Chart Generation](#chart-generation) |
| `filters`     | object | no       | `{}`          | Filter summary shown in the report header                         |
| `orientation` | string | no       | `"portrait"`  | `"portrait"` or `"landscape"`                                 |
| `template`    | string | no       | `"base.html"` | Report Jinja2 template name                                       |

**Response:** Raw PDF bytes. Charts appear above the data table in the PDF.

---

### `POST /reports/preview`

Same as `/reports/pdf` but returns the rendered HTML instead of PDF. Useful for previewing reports in the browser. Supports the `charts` field.

**Request Body:** Same as `/reports/pdf`.

**Response:** `text/html`

---

## Express Proxy Routes

The Express backend has a proxy layer at `Backend/routes/documents/documents.js`, mounted in `staff.js`:

```js
app.use('/documents', require('./routes/documents/documents.js'));
```

All routes require `jwtProtect('medical')` middleware.

### Standard Proxy Routes

These routes forward requests directly to the FastAPI service without any DB interaction:

| Express Route                       | Proxied To                    |
| ----------------------------------- | ----------------------------- |
| `POST /documents/generate`        | `POST /documents/generate`  |
| `POST /documents/generate-docx`   | `POST /generate-docx`       |
| `POST /documents/preview`         | `POST /documents/preview`   |
| `POST /documents/pdf`             | `POST /documents/pdf`       |
| `GET  /documents/templates`       | `GET  /documents/templates` |
| `GET  /documents/contracts`       | `GET  /documents/contracts` |
| `POST /documents/reports/pdf`     | `POST /reports/pdf`         |
| `POST /documents/reports/preview` | `POST /reports/preview`     |

### DB-Orchestrated Routes

These routes have Node.js orchestrate DB queries **before** calling FastAPI. FastAPI only renders — it never touches the database.

---

### `POST /documents/create/document/:template`

Orchestrated document generation. Node.js:
1. Fetches the template contract from FastAPI to get required tags.
2. Optionally queries PostgreSQL for additional tag values.
3. Merges DB columns with explicit `data` (explicit values take priority).
4. Validates all required tags are present.
5. Forwards `{ template, data }` to FastAPI `/documents/generate` or `/documents/pdf`.
6. Streams the DOCX or PDF back to the client.

Tag values support both plain strings (text replacement) and chart specs (`{ graph, datas }`).

**Request Body:**

```json
{
  "data": {
    "NAME": "Juan Dela Cruz",
    "DATE": "2026-03-16",
    "DIAGNOSIS": "Flu",
    "LICENSE_NO": "PRC-0012345",
    "VISIT_CHART": {
      "graph": "bar",
      "datas": {
        "labels": ["Jan", "Feb", "Mar"],
        "values": [10, 25, 18],
        "title": "Monthly Visits",
        "xlabel": "Month",
        "ylabel": "Count"
      }
    }
  },
  "format": "pdf",
  "query": {
    "sql": "SELECT full_name AS name, license_no FROM physicians WHERE id = $1",
    "params": [42]
  }
}
```

| Field          | Type   | Required | Default    | Description                                                                           |
| -------------- | ------ | -------- | ---------- | ------------------------------------------------------------------------------------- |
| `data`       | object | no       | `{}`     | Tag values (string or chart spec). DB query results are merged in for any missing keys |
| `format`     | string | no       | `"docx"` | Output format: `"docx"` or `"pdf"`                                                |
| `query.sql`  | string | no       | —         | Parameterized SQL (`$1`, `$2`, ...) to fetch additional tag values from PostgreSQL    |
| `query.params` | array | no      | `[]`     | Parameters for the SQL query                                                          |

**How DB merging works:** The first row returned by `query.sql` is treated as a flat key-value map. Column names are upper-cased and merged as tag values. Explicit `data` values always override DB columns for the same key.

**Errors:**

```json
{ "error": "MISSING_REQUIRED_TAGS", "details": "Missing required tags: NAME, DATE" }
{ "error": "DOCUMENT_GENERATION_FAILED", "details": "Template not found" }
{ "error": "DOCUMENT_CREATION_FAILED", "details": "..." }
```

---

### `POST /documents/create/report/:template`

Orchestrated report generation. Node.js:
1. Accepts structured report data directly or queries PostgreSQL for rows.
2. Builds the payload including optional `charts` array for chart generation.
3. Forwards `{ title, report_type, columns, data, charts, filters, template }` to FastAPI `/reports/pdf`.
4. FastAPI uses Matplotlib to render charts, embeds them in the report HTML, converts to PDF.
5. Streams the PDF back to the client.

**Request Body:**

```json
{
  "title": "Monthly Consultation Report",
  "report_type": "consultations",
  "columns": [
    { "key": "date",      "label": "Date" },
    { "key": "patient",   "label": "Patient" },
    { "key": "diagnosis", "label": "Diagnosis" }
  ],
  "query": {
    "sql": "SELECT visit_date AS date, patient_name AS patient, diagnosis FROM consultations WHERE visit_date >= $1 AND visit_date <= $2",
    "params": ["2026-03-01", "2026-03-31"]
  },
  "charts": [
    {
      "graph": "bar",
      "datas": {
        "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
        "values": [12, 19, 8, 15],
        "title": "Weekly Consultation Count",
        "xlabel": "Week",
        "ylabel": "Consultations"
      }
    },
    {
      "graph": "pie",
      "datas": {
        "labels": ["Flu", "Cough", "Fever", "Other"],
        "values": [40, 30, 20, 10],
        "title": "Diagnosis Distribution"
      }
    }
  ],
  "filters": { "month": "March 2026", "branch": "Main Campus" },
  "orientation": "landscape"
}
```

| Field           | Type   | Required | Default         | Description                                                                          |
| --------------- | ------ | -------- | --------------- | ------------------------------------------------------------------------------------ |
| `title`       | string | yes      | —              | Report title displayed in the header                                                 |
| `report_type` | string | yes      | —              | Report category (used for filename)                                                  |
| `columns`     | array  | yes      | —              | Column definitions `[{ key, label }]` — keys must match data row properties        |
| `data`        | array  | no       | `[]`          | Row data to use directly. Ignored if `query` is provided                            |
| `query.sql`   | string | no       | —              | Parameterized SQL to fetch rows. All returned rows are used as data                  |
| `query.params`| array  | no       | `[]`          | Parameters for the SQL query                                                         |
| `charts`      | array  | no       | `[]`          | Chart specs to embed in the report — see [Chart Generation](#chart-generation)      |
| `filters`     | object | no       | `{}`          | Key/value pairs shown as filter summary in the report header                         |
| `orientation` | string | no       | `"portrait"`  | Page orientation: `"portrait"` or `"landscape"`                                  |

> Either `data` or `query` must provide rows. A `400` is returned if no rows are available.

**Errors:**

```json
{ "error": "MISSING_REQUIRED_FIELDS", "details": "title, report_type, and columns are required" }
{ "error": "NO_REPORT_DATA", "details": "No data rows provided or returned from query" }
{ "error": "REPORT_GENERATION_FAILED", "details": "..." }
{ "error": "REPORT_CREATION_FAILED", "details": "..." }
```

---

## Calling from Node.js

### Option 1: DB-Orchestrated Routes (Recommended)

Use the new `/create/document/:template` and `/create/report/:template` routes — Node.js handles the DB queries automatically.

```js
const axios = require('axios');

// Generate a PDF medical certificate from DB data + a chart
await axios.post('/documents/create/document/medical_certificate', {
  format: 'pdf',
  query: {
    sql: `SELECT p.full_name AS name, TO_CHAR(NOW(), 'YYYY-MM-DD') AS date,
                 c.diagnosis, ph.license_no
          FROM consultations c
          JOIN patients p ON p.id = c.patient_id
          JOIN physicians ph ON ph.id = c.physician_id
          WHERE c.id = $1`,
    params: [consultationId],
  },
  data: {
    // Additional tags not from DB, including a chart
    VISIT_CHART: {
      graph: 'line',
      datas: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: [5, 8, 3, 7, 6],
        title: 'Daily Visit Trend',
      },
    },
  },
}, { responseType: 'arraybuffer' });

// Generate a consultation report with charts from the DB
await axios.post('/documents/create/report/base.html', {
  title: 'Monthly Consultation Report',
  report_type: 'consultations',
  columns: [
    { key: 'date',      label: 'Date' },
    { key: 'patient',   label: 'Patient' },
    { key: 'diagnosis', label: 'Diagnosis' },
  ],
  query: {
    sql: `SELECT TO_CHAR(visit_date, 'YYYY-MM-DD') AS date,
                 p.full_name AS patient, c.diagnosis
          FROM consultations c
          JOIN patients p ON p.id = c.patient_id
          WHERE c.visit_date BETWEEN $1 AND $2
          ORDER BY c.visit_date`,
    params: ['2026-03-01', '2026-03-31'],
  },
  charts: [
    {
      graph: 'bar',
      datas: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        values: [12, 19, 8, 15],
        title: 'Weekly Count',
      },
    },
  ],
  filters: { month: 'March 2026' },
  orientation: 'landscape',
}, { responseType: 'arraybuffer' });
```

### Option 2: JSON API Mode (Direct FastAPI)

Send `Accept: application/json` to get a JSON response with base64-encoded content.

```js
const { data: result } = await axios.post(
  `http://127.0.0.1:${process.env.DOCX_GENERATED_PORT}/documents/generate`,
  { template: 'medical_certificate', data: { NAME: 'Juan', DATE: '2026-03-16', ... } },
  { headers: { Accept: 'application/json' } },
);
// result = { filename, content_type, content_base64, size }
const buffer = Buffer.from(result.content_base64, 'base64');
```

### Option 3: Binary Stream (Express Proxy)

Forward raw bytes directly to the browser — used by the existing proxy routes:

```js
async function proxyPost(serviceUrl, body, res) {
  const response = await axios.post(serviceUrl, body, {
    responseType: 'arraybuffer',
    validateStatus: () => true,
  });

  res
    .status(response.status)
    .set(response.headers)
    .send(Buffer.from(response.data));
}
```

### Generating Reports (Direct FastAPI)

```js
const response = await axios.post(
  `http://127.0.0.1:${process.env.DOCX_GENERATED_PORT}/reports/pdf`,
  {
    title: 'Monthly Consultations',
    report_type: 'consultations',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'patient', label: 'Patient' },
    ],
    data: rows,
    charts: [
      {
        graph: 'bar',
        datas: { labels: ['Jan', 'Feb', 'Mar'], values: [10, 25, 18], title: 'Trend' },
      },
    ],
    filters: { month: 'March 2026' },
    orientation: 'landscape',
  },
  { responseType: 'arraybuffer' },
);
```

---

## Tag Contracts

Each document type has a defined set of required tags. The service validates these at runtime — if a required tag is missing, the endpoint returns `400` with the list of missing tags.

You can pass the keys with or without angle brackets — `<NAME>` and `NAME` are treated identically.

Any tag can hold a **chart spec** instead of a string — the `{{ TAG_NAME }}` placeholder in the `.docx` template will be replaced by the generated chart image.

| Template                | Required Tags                                                  |
| ----------------------- | -------------------------------------------------------------- |
| `medical_certificate` | `NAME`, `DATE`, `DIAGNOSIS`, `LICENSE_NO`              |
| `medical_clearance`   | `NAME`, `DATE`, `PURPOSE`, `LICENSE_NO`                |
| `prescription`        | `NAME`, `DATE`, `MEDICATION`, `LICENSE_NO`, `PTR_NO` |
| `lab_referral`        | `NAME`, `DATE`, `TEST_TYPE`, `LICENSE_NO`              |

Contracts are defined in `models/tag_contracts.py`. To add a new document type, add a `TemplateContract` entry there.

---

## Creating New Templates

1. **Create the `.docx` file** using Word or the `create_templates.py` script. Use Jinja2-style `{{ TAG_NAME }}` placeholders in the document text. For chart placeholders, use `{{ TAG_NAME }}` in a location that supports inline images (e.g., a paragraph or table cell).
2. **Place it in the template directory** configured by `TEMPLATE_PATH` (default: `Backend/services/docx-generation/templates/`).
3. **(Optional) Register a tag contract** in `models/tag_contracts.py`:

   ```python
   MY_NEW_DOC = TemplateContract(
       template="my_new_doc",
       display_name="My New Document",
       description="Description of the document.",
       tags=[
           TagField("NAME",    "Patient name",   example="Juan Dela Cruz"),
           TagField("DATE",    "Date issued",     example="2026-03-16"),
       ],
   )

   CONTRACTS: dict[str, TemplateContract] = {
       c.template: c
       for c in [MEDICAL_CERTIFICATE, MEDICAL_CLEARANCE, PRESCRIPTION, LAB_REFERRAL, MY_NEW_DOC]
   }
   ```
4. **Restart the service** — the new template will appear in `/documents/templates` and `/documents/contracts`.

---

## Project Structure

```
Backend/services/docx-generation/
├── config.py                   # All configurable variables (env, paths, ports)
├── main.py                     # FastAPI entry point
├── requirements.txt            # Python dependencies (includes matplotlib>=3.8)
├── create_templates.py         # Script to generate .docx template files
│
├── models/
│   ├── document.py             # DocumentGenerateRequest — data accepts str | chart spec
│   ├── report.py               # ReportGenerateRequest — includes charts: list[ReportChartSpec]
│   └── tag_contracts.py        # Tag definitions per document type
│
├── modules/
│   ├── chart_generator.py      # Matplotlib chart image generation (bar, line, pie)
│   ├── docx_generator.py       # DOCX rendering — detects chart specs, embeds InlineImage
│   ├── pdf_converter.py        # DOCX → PDF (mammoth + WeasyPrint)
│   ├── pdf_report.py           # Report → PDF (Jinja2 + WeasyPrint + chart b64 embedding)
│   └── preview_renderer.py     # HTML preview page (Jinja2 + mammoth.js)
│
├── routes/
│   ├── document.py             # /documents/* endpoints
│   ├── report.py               # /reports/* endpoints (charts supported)
│   └── legacy.py               # /generate-docx backward-compatible endpoint
│
├── utils/
│   └── helpers.py              # base64 encoding, filename sanitization
│
├── templates/
│   ├── medical_certificate.docx
│   ├── medical_clearance.docx
│   ├── prescription.docx
│   ├── lab_referral.docx
│   ├── preview/
│   │   └── template.html       # In-browser preview page (Jinja2)
│   └── reports/
│       └── base.html           # Report layout (Jinja2) — renders chart_images above table
│
└── generated/                  # Output artifacts (gitignored)
```

---

## Lifecycle Manager (Node.js)

The file `Backend/services/docx-generation-manager.js` lets you auto-start and stop the Python service from your Node.js backend.

### Usage

```js
const docService = require('./services/docx-generation-manager');

// On server startup — starts the Python process and waits for health check
await docService.start();

// On shutdown — sends SIGTERM to the Python process
process.on('SIGTERM', () => docService.stop());
process.on('SIGINT',  () => docService.stop());

// Check if running
const healthy = await docService.isHealthy();
```

### API

| Method          | Description                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `start()`     | Spawns the Python service, waits for `/health` to respond (retries up to 15 times). No-op if already running. |
| `stop()`      | Sends `SIGTERM` to the child process.                                                                         |
| `isHealthy()` | Returns `true` if `/health` responds 200.                                                                   |

### How it Works

1. Checks if the service is already running via `/health`
2. If not, spawns `venv/bin/python main.py` as a child process
3. Pipes stdout/stderr to the Node.js logger
4. Polls `/health` until it responds (up to 15 seconds)
5. On `stop()`, sends `SIGTERM` for graceful shutdown
