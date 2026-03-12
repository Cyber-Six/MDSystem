# MDS Document Service

A standalone **FastAPI** microservice for generating medical documents (DOCX), converting them to PDF, and rendering in-browser HTML previews. Designed to be called from the Node.js/Express backend over HTTP on localhost.

```
Express (Node.js) ──HTTP POST──▶ FastAPI (Python) ──▶ DOCX / PDF / HTML
```

---

## Table of Contents

- [Setup](#setup)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
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

| File | Document Type |
|------|---------------|
| `medical_certificate.docx` | Medical Certificate |
| `medical_clearance.docx` | Medical Clearance |
| `prescription.docx` | Prescription |
| `lab_referral.docx` | Lab Referral |

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

| Variable | `config.py` Name | Default | Description |
|----------|-------------------|---------|-------------|
| `DOCX_GENERATED_PORT` | `SERVICE_PORT` | `3002` | Port the service listens on |
| `DOCX_SERVICE_HOST` | `SERVICE_HOST` | `127.0.0.1` | Bind address |
| `TEMPLATE_PATH` | `TEMPLATE_DIR` | `""` | Directory containing `.docx` templates. Relative paths are resolved from `Backend/` |
| `DOCX_LOG_LEVEL` | `LOG_LEVEL` | `INFO` | Python logging level |
| *(internal)* | `GENERATED_DIR` | `./generated/` | Output directory for debug artifacts |
| *(internal)* | `PREVIEW_TEMPLATES_DIR` | `./templates/preview/` | Jinja2 HTML preview templates |
| *(internal)* | `REPORT_TEMPLATES_DIR` | `./templates/reports/` | Jinja2 HTML report templates |

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

## API Reference

Base URL: `http://127.0.0.1:{DOCX_GENERATED_PORT}`

All POST endpoints accept `Content-Type: application/json`.

### Response Modes

The `/documents/generate` and `/documents/pdf` endpoints support two response modes based on the `Accept` header:

| `Accept` Header | Response | Use Case |
|-----------------|----------|----------|
| *(default / omitted)* | Raw binary stream | Browser downloads, Express proxy |
| `application/json` | JSON with base64-encoded content | Node.js API calls, programmatic use |

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

Pick any `.docx` template from the `TEMPLATE_PATH` directory and pass key-value pairs to fill in the placeholders.

**Request Body:**

```json
{
  "template": "medical_certificate.docx",
  "data": {
    "<NAME>": "Juan Dela Cruz",
    "<DATE>": "2026-03-12",
    "<DIAGNOSIS>": "Acute Flu",
    "<LICENSE_NO>": "PRC-12345"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | string | yes | Template filename — with or without `.docx` extension (e.g. `"medical_certificate.docx"` or `"medical_certificate"`) |
| `data` | object | yes* | Key-value pairs for placeholders. Keys can use angle brackets (`<NAME>`) or plain (`NAME`) — brackets are stripped automatically |
| `tags` | object | no | Legacy alias for `data`. If both are provided, `data` takes priority |

> **Backward compatible:** The old `{ "template": "...", "tags": {...} }` format still works.
```

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

| Status | When |
|--------|------|
| `400` | Missing required tags |
| `404` | Template not found |

---

### `POST /documents/preview`

Generate a DOCX and return a self-contained HTML page with an in-browser preview (rendered via mammoth.js) and a download button.

**Request Body:** Same as `/documents/generate` (`template` + `data`).

**Response:** `text/html` — a complete HTML page you can serve directly to the browser.

---

### `POST /documents/pdf`

Generate a DOCX then convert it to PDF using mammoth (DOCX → HTML) and WeasyPrint (HTML → PDF).

**Request Body:** Same as `/documents/generate` (`template` + `data`).

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

| Status | When |
|--------|------|
| `400` | Missing required tags |
| `404` | Template not found |
| `500` | PDF conversion failure |

---

### `POST /generate-docx`

Legacy endpoint — identical behavior to `POST /documents/generate`. Kept for backward compatibility.

**Request Body:** Same as `/documents/generate` (supports both `data` and `tags`).

---

### `POST /reports/pdf`

Generate a PDF report from structured tabular data (analytics, consultation summaries, etc.).

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
  "filters": { "month": "March 2026" },
  "orientation": "landscape",
  "template": "base.html"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | yes | — | Report title |
| `report_type` | string | yes | — | Report category (for filename) |
| `columns` | array | yes | — | Column definitions `[{key, label}]` |
| `data` | array | yes | — | Row data as list of dicts |
| `filters` | object | no | `{}` | Filter summary shown in header |
| `orientation` | string | no | `"portrait"` | `"portrait"` or `"landscape"` |
| `template` | string | no | `"base.html"` | Report Jinja2 template name |

**Response:** Raw PDF bytes.

---

### `POST /reports/preview`

Same as `/reports/pdf` but returns the rendered HTML instead of PDF. Useful for previewing reports in the browser.

**Request Body:** Same as `/reports/pdf`.

**Response:** `text/html`

---

## Calling from Node.js

The service is fully compatible with Node.js. You can call it two ways:

### Option 1: JSON API Mode (Recommended for Node.js)

Send `Accept: application/json` to get a JSON response with base64-encoded content. No need for `arraybuffer` response handling.

```js
const axios = require('axios');

const DOCX_SERVICE = `http://127.0.0.1:${process.env.DOCX_GENERATED_PORT || 8000}`;

// Generate a DOCX and get JSON with base64 content
async function generateDocx(template, data) {
  const { data: result } = await axios.post(`${DOCX_SERVICE}/documents/generate`, {
    template,
    data,
  }, {
    headers: { 'Accept': 'application/json' },
  });

  // result = { filename, content_type, content_base64, size }
  return result;
}

// Generate a PDF and get JSON with base64 content
async function generatePdf(template, data) {
  const { data: result } = await axios.post(`${DOCX_SERVICE}/documents/pdf`, {
    template,
    data,
  }, {
    headers: { 'Accept': 'application/json' },
  });

  return result;
}

// Convert base64 to Buffer for sending to client
function base64ToBuffer(base64String) {
  return Buffer.from(base64String, 'base64');
}

// Usage example
const result = await generateDocx('medical_certificate.docx', {
  '<NAME>': 'Juan Dela Cruz',
  '<DATE>': '2026-03-12',
  '<DIAGNOSIS>': 'Acute Flu',
  '<LICENSE_NO>': 'PRC-12345',
});

console.log(result.filename);  // "medical_certificate.docx"
console.log(result.size);      // 36883
// To get the file buffer: Buffer.from(result.content_base64, 'base64')
```

### Option 2: Binary Stream (Express Proxy)

Forward raw bytes directly to the browser — used by the Express proxy in `routes/documents/documents.js`:

```js
const axios = require('axios');

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

### Fetching Available Templates & Contracts

```js
// List templates
const { data: templateData } = await axios.get(`${DOCX_SERVICE}/documents/templates`);
console.log(templateData.templates);  // [{ name, filename }, ...]

// Get tag contracts (what tags each template needs)
const { data: contractData } = await axios.get(`${DOCX_SERVICE}/documents/contracts`);
console.log(contractData.contracts);  // [{ template, display_name, tags: [...] }, ...]
```

### Generating Reports

```js
const { data: reportPdf } = await axios.post(`${DOCX_SERVICE}/reports/pdf`, {
  title: 'Monthly Consultations',
  report_type: 'consultations',
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'patient', label: 'Patient' },
  ],
  data: rows,
  filters: { month: 'March 2026' },
  orientation: 'landscape',
}, { responseType: 'arraybuffer' });
```

---

## Tag Contracts

Each document type has a defined set of required tags. The service validates these at runtime — if a required tag is missing, the endpoint returns `400` with the list of missing tags.

You can pass the keys with or without angle brackets — `<NAME>` and `NAME` are treated identically.

| Template | Required Tags |
|----------|---------------|
| `medical_certificate` | `NAME`, `DATE`, `DIAGNOSIS`, `LICENSE_NO` |
| `medical_clearance` | `NAME`, `DATE`, `PURPOSE`, `LICENSE_NO` |
| `prescription` | `NAME`, `DATE`, `MEDICATION`, `LICENSE_NO`, `PTR_NO` |
| `lab_referral` | `NAME`, `DATE`, `TEST_TYPE`, `LICENSE_NO` |

Contracts are defined in `models/tag_contracts.py`. To add a new document type, add a `TemplateContract` entry there.

---

## Creating New Templates

1. **Create the `.docx` file** using Word or the `create_templates.py` script. Use Jinja2-style `{{ TAG_NAME }}` placeholders in the document text.

2. **Place it in the template directory** configured by `TEMPLATE_PATH` (default: `Backend/services/docx-generation/templates/`).

3. **(Optional) Register a tag contract** in `models/tag_contracts.py`:

   ```python
   MY_NEW_DOC = TemplateContract(
       template="my_new_doc",                    # matches filename without .docx
       display_name="My New Document",
       description="Description of the document.",
       tags=[
           TagField("NAME",    "Patient name",   example="Juan Dela Cruz"),
           TagField("DATE",    "Date issued",     example="2026-03-12"),
       ],
   )

   # Add it to the CONTRACTS dict:
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
├── requirements.txt            # Python dependencies
├── create_templates.py         # Script to generate .docx template files
│
├── models/
│   ├── document.py             # DocumentGenerateRequest schema (Pydantic)
│   ├── report.py               # ReportGenerateRequest schema (Pydantic)
│   └── tag_contracts.py        # Tag definitions per document type
│
├── modules/
│   ├── docx_generator.py       # DOCX rendering (docxtpl)
│   ├── pdf_converter.py        # DOCX → PDF (mammoth + WeasyPrint)
│   ├── pdf_report.py           # Report → PDF (Jinja2 + WeasyPrint)
│   └── preview_renderer.py     # HTML preview page (Jinja2 + mammoth.js)
│
├── routes/
│   ├── document.py             # /documents/* endpoints
│   ├── report.py               # /reports/* endpoints
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
│       └── base.html           # Report layout template (Jinja2)
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

| Method | Description |
|--------|-------------|
| `start()` | Spawns the Python service, waits for `/health` to respond (retries up to 15 times). No-op if already running. |
| `stop()` | Sends `SIGTERM` to the child process. |
| `isHealthy()` | Returns `true` if `/health` responds 200. |

### How it Works

1. Checks if the service is already running via `/health`
2. If not, spawns `venv/bin/python main.py` as a child process
3. Pipes stdout/stderr to the Node.js logger
4. Polls `/health` until it responds (up to 15 seconds)
5. On `stop()`, sends `SIGTERM` for graceful shutdown

---

## Express Proxy Routes

The Express backend already has a proxy layer at `Backend/routes/documents/documents.js`, mounted in `staff.js`:

```js
app.use('/documents', require('./routes/documents/documents.js'));
```

This adds JWT-protected routes that forward to the Python service:

| Express Route | Proxied To |
|---------------|------------|
| `POST /documents/generate` | `POST /documents/generate` |
| `POST /documents/generate-docx` | `POST /generate-docx` |
| `POST /documents/preview` | `POST /documents/preview` |
| `POST /documents/pdf` | `POST /documents/pdf` |
| `GET  /documents/templates` | `GET  /documents/templates` |
| `GET  /documents/contracts` | `GET  /documents/contracts` |
| `POST /documents/reports/pdf` | `POST /reports/pdf` |
| `POST /documents/reports/preview` | `POST /reports/preview` |

All Express routes require `jwtProtect('medical')` middleware.
