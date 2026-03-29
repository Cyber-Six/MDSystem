# Prescription Document Generation — Implementation Plan

> **System**: MDSystem (RPi 5, 8GB RAM)  
> **Date**: March 29, 2026  
> **Scope**: Cross-module prescription document generation via health-chat, consultation, and appointment modules

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Gap Analysis](#3-gap-analysis)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Enhanced Prescription Template](#5-enhanced-prescription-template)
6. [Backend Changes](#6-backend-changes)
7. [Frontend Changes](#7-frontend-changes)
8. [Database Changes](#8-database-changes)
9. [Integration Points Per Module](#9-integration-points-per-module)
10. [RPi 5 Performance Optimizations](#10-rpi-5-performance-optimizations)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Phases](#12-implementation-phases)
13. [File Change Inventory](#13-file-change-inventory)

---

## 1. Executive Summary

The system already has two **disconnected** prescription capabilities:

| Component | What it does | What it lacks |
|-----------|-------------|---------------|
| **PrescriptionModal** (health-chat) | Selects medicines from inventory, creates `MedicineTransactionLog` | Does NOT generate a document; patient sees nothing in chat |
| **docx-generation service** | Renders `prescription.docx` template with Jinja2 tags | Only has a single `{{ MEDICATION }}` text field — no itemized list |

**Goal**: Bridge these two systems so that when a staff member issues a prescription (from *any* module), a **professional PDF prescription document** is generated, stored, and delivered to the patient — pre-filled with patient data, doctor credentials, and the full itemized medication list.

---

## 2. Current State Analysis

### 2.1 Health-Chat Message Flow (Files)

```
Staff attaches file → POST /media/stage/ → fileId (UUID)
                          ↓
Staff sends message → GraphQL sendMedicalMessage(chatId, null, fileId, 'file')
                          ↓
Backend promotes file → /committed/e_consultation/{fileId}
                          ↓
Stores HealthChatPrompt → { promptType: 'file', filename: fileId }
                          ↓
Emits socket → 'healthchat:new-message' → patient sees file bubble
```

### 2.2 Current Prescription Issuance (PrescriptionModal)

```
Staff opens PrescriptionModal → loads medicines via getAvailableMedicine()
                                      ↓
Selects medicines → cart: [{ batchId, quantity }]
                                      ↓
Clicks "Issue Prescription" → GraphQL issuePrescription({ patientId, items, notes })
                                      ↓
Backend creates MedicineTransactionLog + assigns MedicineEntity units
                                      ↓
Socket notification: 'medicine:prescription:issued'
                                      ↓
✅ Inventory updated   ❌ No document generated   ❌ Nothing sent in chat
```

### 2.3 Existing Prescription Template (docx-generation)

**Template**: `prescription.docx`  
**Tags**: `NAME`, `DATE`, `MEDICATION`, `LICENSE_NO`, `PTR_NO`

**Problem**: The `MEDICATION` tag is a single text field. A real prescription needs an itemized table with drug name, dosage, frequency, duration, and quantity.

### 2.4 Existing Document Service Architecture

```
Express (Node.js)  ──HTTP──>  FastAPI (Python :3002)
        │                           │
  /documents/generate          /documents/generate
  /documents/pdf               /documents/pdf
  /documents/preview           /documents/preview
  /documents/create/document/:template
```

The FastAPI service is managed as a subprocess by `docx-generation-manager.js` and communicates over `http://127.0.0.1:3002`.

---

## 3. Gap Analysis

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| G1 | No prescription document is generated when `issuePrescription` is called | Patient has no formal record | **Critical** |
| G2 | `prescription.docx` has single `MEDICATION` text field, not a medication table | Unusable for multi-drug prescriptions | **Critical** |
| G3 | No auto-fill from patient/doctor context | Staff must manually type all tag values | **High** |
| G4 | No `promptType: 'prescription'` in HealthChatPrompt | Can't distinguish prescriptions from regular files in the chat | **Medium** |
| G5 | No reusable prescription generation endpoint | Can't invoke from consultation/appointment modules | **High** |
| G6 | No prescription audit/history table | Can't track which documents were generated | **Medium** |
| G7 | PrescriptionModal doesn't trigger a document after issuePrescription | Two-step process not connected | **Critical** |

---

## 4. Proposed Architecture

### 4.1 High-Level Flow (Target State)

```
┌─────────────────────────────────────────────────────────────────┐
│  Staff Action (any module)                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ Health-Chat   │  │ Consultation  │  │ Appointment          │  │
│  │ Prescription  │  │ Treatment Tab │  │ Follow-Up Rx         │  │
│  │ Modal         │  │               │  │                      │  │
│  └──────┬───────┘  └──────┬────────┘  └──────────┬───────────┘  │
│         │                 │                       │              │
│         └─────────────────┴───────────────────────┘              │
│                           │                                      │
│              POST /documents/prescription                        │
│              { patientId, doctorId, items[], notes, source }     │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │  Prescription Orchestrator │  (Node.js - new route)
              │  Backend/routes/documents/ │
              │                           │
              │  1. Fetch patient data     │  ← DB query
              │  2. Fetch doctor data      │  ← DB query
              │  3. Format medication list │
              │  4. Build tag map          │
              │  5. Call FastAPI /pdf      │  → docx-generation
              │  6. Save PDF to storage    │  → /committed/prescriptions/
              │  7. Create audit record    │  → PrescriptionDocument table
              │  8. Return fileId + meta   │
              └─────────────┬─────────────┘
                            │
              ┌─────────────▼─────────────┐
              │  Caller handles delivery:  │
              │  • Health-Chat: send as    │
              │    file message in chat    │
              │  • Consultation: attach    │
              │    to outcome record       │
              │  • Appointment: email/     │
              │    attach to slot record   │
              └───────────────────────────┘
```

### 4.2 Design Principles

1. **Single endpoint** — one `POST /documents/prescription` serves all modules
2. **Auto-fill** — fetches patient name, age, sex, address from DB; doctor name, license, PTR from staff records
3. **Itemized medications** — template uses a Jinja2 `{% for %}` loop to render a medication table
4. **PDF-first** — prescriptions generate as PDF (not DOCX) because they're formal medical documents
5. **Stateless callers** — the endpoint returns `{ fileId, url }` and the calling module decides how to deliver it
6. **Lightweight for RPi 5** — no extra services, reuses the existing FastAPI process

---

## 5. Enhanced Prescription Template

### 5.1 New Tag Contract

Replace the existing simple `PRESCRIPTION` contract with a comprehensive one:

```python
# models/tag_contracts.py — UPDATED

PRESCRIPTION = TemplateContract(
    template="prescription",
    display_name="Prescription",
    description="Itemized medication prescription with patient and doctor details.",
    tags=[
        # Patient info (auto-filled)
        TagField("PATIENT_NAME",   "Full name of the patient",             example="Juan Dela Cruz"),
        TagField("PATIENT_AGE",    "Patient age",                          example="25"),
        TagField("PATIENT_SEX",    "Patient sex",                          example="Male"),
        TagField("PATIENT_ADDRESS","Patient address",                      example="123 Main St, QC"),
        TagField("DATE",           "Date of prescription",                 example="March 29, 2026"),

        # Doctor info (auto-filled)
        TagField("DOCTOR_NAME",    "Prescribing physician full name",      example="Dr. Maria Santos"),
        TagField("LICENSE_NO",     "PRC license number",                   example="PRC-0012345"),
        TagField("PTR_NO",         "Physician tax receipt number",         example="PTR-0067890"),
        TagField("S2_NO",          "S2 license number (for controlled)",   example="S2-001234", required=False),

        # Medications (Jinja2 loop variable)
        TagField("MEDICATIONS",    "List of medication dicts with keys: name, dosage, frequency, duration, quantity, instructions",
                 example='[{"name":"Amoxicillin","dosage":"500mg","frequency":"TID","duration":"7 days","quantity":"21 caps","instructions":"Take after meals"}]'),

        # Optional
        TagField("NOTES",          "Additional prescriber notes",          example="Follow up after 7 days", required=False),
        TagField("CLINIC_NAME",    "Clinic or facility name",              example="MDS Health Center", required=False),
        TagField("CLINIC_ADDRESS", "Clinic address",                       example="Arlegui, Mandaluyong", required=False),
    ],
)
```

### 5.2 New prescription.docx Template Layout

The template will be regenerated with a proper format:

```
┌─────────────────────────────────────────────────┐
│           {{ CLINIC_NAME }}                      │
│           {{ CLINIC_ADDRESS }}                   │
│                                                  │
│                  PRESCRIPTION                    │
│─────────────────────────────────────────────────│
│ Date: {{ DATE }}                                 │
│                                                  │
│ Patient: {{ PATIENT_NAME }}                     │
│ Age: {{ PATIENT_AGE }}    Sex: {{ PATIENT_SEX }}│
│ Address: {{ PATIENT_ADDRESS }}                   │
│─────────────────────────────────────────────────│
│                                                  │
│ Rx:                                              │
│                                                  │
│ ┌───┬──────────────────┬────────┬──────────────┐│
│ │ # │ Medication       │ Qty    │ Instructions ││
│ ├───┼──────────────────┼────────┼──────────────┤│
│ │ 1 │ Amoxicillin      │ 21 cap │ 500mg TID    ││
│ │   │                  │        │ x 7 days     ││
│ │   │                  │        │ after meals   ││
│ ├───┼──────────────────┼────────┼──────────────┤│
│ │ 2 │ Paracetamol      │ 10 tab │ 500mg PRN    ││
│ │   │                  │        │ for fever     ││
│ └───┴──────────────────┴────────┴──────────────┘│
│                                                  │
│ Notes: {{ NOTES }}                               │
│                                                  │
│                    ________________________      │
│                    {{ DOCTOR_NAME }}              │
│                    License No.: {{ LICENSE_NO }}  │
│                    PTR No.: {{ PTR_NO }}          │
│                    S2 No.: {{ S2_NO }}            │
└─────────────────────────────────────────────────┘
```

### 5.3 Jinja2 Loop in Template

The `docxtpl` library supports Jinja2 loops natively inside `.docx`:

```
{%tr for med in MEDICATIONS %}
{{ loop.index }}  |  {{ med.name }}  |  {{ med.quantity }}  |  {{ med.dosage }} {{ med.frequency }} x {{ med.duration }}
                                                               {{ med.instructions }}
{%tr endfor %}
```

This renders one table row per medication inside the DOCX.

---

## 6. Backend Changes

### 6.1 New Endpoint: Prescription Document Orchestrator

**File**: `Backend/routes/documents/` (add to existing document routes)  
**Route**: `POST /documents/prescription`

```javascript
// Pseudocode for the orchestrator endpoint

router.post('/prescription', jwtProtect('medical'), async (req, res) => {
  const { patientId, items, notes, source, ticketId } = req.body;
  const doctorId = req.user.id;

  // 1. Fetch patient personal data
  const patient = await db.query(
    `SELECT first_name, middle_name, last_name, suffix,
            date_of_birth, sex, present_address
     FROM "UsersPersonal" WHERE id = $1`, [patientId]
  );

  // 2. Fetch doctor data (staff credentials + license)
  const doctor = await db.query(
    `SELECT first_name, last_name, license_no, ptr_no, s2_no
     FROM "UsersPersonal" up
     JOIN "StaffCredentials" sc ON sc."userId" = up.id
     WHERE up.id = $1`, [doctorId]
  );

  // 3. Build medication list from items (enrich with medicine names)
  const medications = await Promise.all(items.map(async (item) => {
    const med = await db.query(
      `SELECT mi.item_name, mb."dosageUnit", mb."dosageValue"
       FROM "MedicineBatch" mb
       JOIN "MedicalItem" mi ON mi.id = mb."medicalItemId"
       WHERE mb.id = $1`, [item.batchId]
    );
    return {
      name: med.rows[0].item_name,
      dosage: `${med.rows[0].dosageValue}${med.rows[0].dosageUnit}`,
      frequency: item.frequency || '',
      duration: item.duration || '',
      quantity: `${item.quantity} ${med.rows[0].dosageUnit}`,
      instructions: item.instructions || ''
    };
  }));

  // 4. Build tag map
  const tags = {
    PATIENT_NAME: formatFullName(patient.rows[0]),
    PATIENT_AGE: calculateAge(patient.rows[0].date_of_birth),
    PATIENT_SEX: patient.rows[0].sex,
    PATIENT_ADDRESS: patient.rows[0].present_address || 'N/A',
    DATE: new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric'}),
    DOCTOR_NAME: `Dr. ${doctor.rows[0].first_name} ${doctor.rows[0].last_name}`,
    LICENSE_NO: doctor.rows[0].license_no || '',
    PTR_NO: doctor.rows[0].ptr_no || '',
    S2_NO: doctor.rows[0].s2_no || '',
    MEDICATIONS: medications,
    NOTES: notes || '',
    CLINIC_NAME: process.env.CLINIC_NAME || 'MDS Health Center',
    CLINIC_ADDRESS: process.env.CLINIC_ADDRESS || '',
  };

  // 5. Call FastAPI to generate PDF
  const pdfResponse = await axios.post(
    `http://127.0.0.1:${DOCX_PORT}/documents/pdf`,
    { template: 'prescription', tags },
    { responseType: 'arraybuffer' }
  );

  // 6. Save PDF to storage (reuse media staging pattern)
  const fileId = uuidv4();
  const filePath = path.join(MEDIA_PATH.prescriptions, `${fileId}.pdf`);
  await fs.writeFile(filePath, pdfResponse.data);

  // 7. Create audit record
  await db.query(
    `INSERT INTO "PrescriptionDocument"
     ("fileId", "patientId", "doctorId", "source", "ticketId", "medication_data")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fileId, patientId, doctorId, source, ticketId || null, JSON.stringify(medications)]
  );

  // 8. Return fileId for caller to use
  res.json({
    success: true,
    fileId,
    url: `/media/record/prescription/${fileId}`,
  });
});
```

### 6.2 Modify issuePrescription Mutation (medical-inventory)

After the existing inventory transaction, add a step to generate the prescription document:

```javascript
// In the issuePrescription resolver, AFTER inventory transaction succeeds:

// Generate prescription PDF (internal HTTP call)
let prescriptionFileId = null;
try {
  const docRes = await axios.post(`http://127.0.0.1:${EXPRESS_PORT}/documents/prescription`, {
    patientId: input.patientId,
    items: input.items,     // Enriched with frequency/duration from frontend
    notes: input.notes,
    source: 'health-chat',  // or 'consultation', 'appointment'
    ticketId: chatId || null,
  }, {
    headers: { Authorization: req.headers.authorization } // Forward JWT
  });
  prescriptionFileId = docRes.data.fileId;
} catch (err) {
  logger.warn('Prescription PDF generation failed (non-blocking)', { error: err.message });
  // Don't fail the prescription issuance if PDF generation fails
}

// Return fileId so frontend can send it as a message
return {
  success: true,
  transaction: result,
  prescriptionFileId,  // NEW field
};
```

### 6.3 Update Health-Chat Wrapper (optional promptType)

Add `'prescription'` to the `promptType` enum for richer UI rendering:

```sql
-- HealthChatPrompt.promptType currently: 'text' | 'file' | 'system'
-- Add: 'prescription'
```

This lets the frontend render prescription messages with a special icon/badge instead of a generic file icon.

### 6.4 New Media Category for Prescriptions

Add `prescriptions` to the committed storage categories:

```javascript
// config/multer.js — add to MEDIA_PATH
prescriptions: `${MEDIA_PATH_ENV}/committed/prescriptions`,
```

```javascript
// routes/media/ — add to allowed categories for serving
const ALLOWED_CATEGORIES = [
  'staging', 'dentalPhoto', 'appointmentRequirement',
  'eConsultation', 'announcement',
  'prescription'  // NEW
];
```

### 6.5 Update FastAPI docx_generator.py

The generator already handles Jinja2 loops via `docxtpl`. The `MEDICATIONS` tag will be passed as a Python list of dicts, and `docxtpl` will iterate over it in the template. No code change is needed in the Python service — only the template `.docx` file and the tag contract need updating.

---

## 7. Frontend Changes

### 7.1 PrescriptionModal — Add Frequency/Duration/Instructions Fields

Currently the modal only collects `batchId` and `quantity`. Add:

```javascript
// Cart item shape (UPDATED)
{
  batchId: 42,
  item_name: "Amoxicillin",
  dosageUnit: "cap",
  dosageValue: "500mg",
  quantity: 21,
  frequency: "TID",        // NEW — dropdown: OD, BID, TID, QID, PRN, etc.
  duration: "7 days",      // NEW — text input
  instructions: "Take after meals"  // NEW — text input
}
```

### 7.2 PrescriptionModal — Post-Issue Document Generation

After `issuePrescription` succeeds, use the returned `prescriptionFileId` to send it as a message:

```javascript
// In PrescriptionModal.jsx — after successful issuePrescription

const result = await issuePrescription({
  patientId: parseInt(patientId),
  items: cart.map(i => ({
    batchId: i.batchId,
    quantity: i.quantity,
    frequency: i.frequency,
    duration: i.duration,
    instructions: i.instructions,
  })),
  notes: prescriptionNotes,
});

// If prescription PDF was generated, send it as a chat message
if (result.prescriptionFileId && activeTicketId) {
  await sendMessage(
    activeTicketId,
    'Prescription issued — see attached document',
    result.prescriptionFileId,
    'prescription'   // or 'file' if not adding new promptType
  );
}
```

### 7.3 MessageBubble — Prescription Rendering

Add a special case for `promptType === 'prescription'` in the message bubble:

```jsx
// In message-bubble.jsx
if (message.promptType === 'prescription') {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
      <Pill className="w-5 h-5 text-emerald-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-emerald-800">Prescription Document</p>
        <p className="text-xs text-emerald-600">{message.text}</p>
      </div>
      <button onClick={() => viewFile(message.filename)} className="...">
        View PDF
      </button>
    </div>
  );
}
```

### 7.4 Prescription Service Update

Add `frequency`, `duration`, `instructions` to the `issuePrescription` input:

```javascript
// prescription-service.js — updated mutation
const ISSUE_PRESCRIPTION = `
  mutation IssuePrescription($input: IssuePrescriptionInput!) {
    issuePrescription(input: $input) {
      id patientId quantity issuedAt notes
      prescriptionFileId            # NEW return field
    }
  }
`;
```

---

## 8. Database Changes

### 8.1 New Table: PrescriptionDocument

Tracks every generated prescription document for audit and history.

```sql
CREATE TABLE "PrescriptionDocument" (
    id              SERIAL PRIMARY KEY,
    "fileId"        UUID NOT NULL UNIQUE,              -- Links to stored PDF file
    "patientId"     INT NOT NULL REFERENCES "UserCredentials"(id),
    "doctorId"      INT NOT NULL REFERENCES "UserCredentials"(id),
    source          VARCHAR(50) NOT NULL DEFAULT 'health-chat',  -- 'health-chat', 'consultation', 'appointment'
    "ticketId"      INT,                               -- HealthChat.id (nullable)
    "consultationId" INT,                              -- Consultation.id (nullable)
    "appointmentSlotId" INT,                           -- patientSlot.id (nullable)
    "transactionId" INT,                               -- MedicineTransactionLog.id (nullable)
    medication_data JSONB NOT NULL,                    -- Snapshot of medications at time of issue
    created_at      TIMESTAMP DEFAULT NOW(),
    revoked_at      TIMESTAMP                          -- NULL unless prescription revoked
);

CREATE INDEX idx_prescription_doc_patient ON "PrescriptionDocument"("patientId");
CREATE INDEX idx_prescription_doc_doctor ON "PrescriptionDocument"("doctorId");
CREATE INDEX idx_prescription_doc_source ON "PrescriptionDocument"(source);
```

### 8.2 Add Staff Credential Fields (if missing)

Ensure doctor license/PTR numbers are stored:

```sql
-- If not already in the schema, add to staff profile table:
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS license_no VARCHAR(50);
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS ptr_no VARCHAR(50);
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS s2_no VARCHAR(50);
```

### 8.3 Extend HealthChatPrompt.promptType Enum

```sql
-- If using PostgreSQL enum type:
ALTER TYPE prompt_type ADD VALUE IF NOT EXISTS 'prescription';

-- If using CHECK constraint:
ALTER TABLE "HealthChatPrompt"
  DROP CONSTRAINT IF EXISTS healthchatprompt_prompttype_check,
  ADD CONSTRAINT healthchatprompt_prompttype_check
    CHECK ("promptType" IN ('text', 'file', 'system', 'prescription'));
```

---

## 9. Integration Points Per Module

### 9.1 Health-Chat (Primary Use Case)

```
Staff opens PrescriptionModal in active ticket
    ↓
Selects medicines + frequency/duration/instructions
    ↓
Clicks "Issue Prescription"
    ↓
1. issuePrescription() → inventory deducted
2. POST /documents/prescription → PDF generated, fileId returned
3. sendMessage(ticketId, caption, fileId, 'prescription') → sent in chat
    ↓
Patient sees prescription document in chat (special bubble with Pill icon)
Patient can tap to view/download PDF
```

### 9.2 Consultation Module

```
Doctor completes consultation → adds treatments in ConsultationTreatment
    ↓
Clicks "Generate Prescription" button in consultation outcome panel
    ↓
Frontend collects treatment entries + maps to medication format:
  items = treatments.map(t => ({
    name: t.treatment,           // Free-text treatment name
    dosage: t.dosage || '',
    frequency: t.frequency || '',
    duration: t.duration || '',
    quantity: t.quantity || '',
    instructions: t.instructions || ''
  }))
    ↓
POST /documents/prescription {
  patientId,
  doctorId,
  items,               // Can accept free-text items (not just batchIds)
  source: 'consultation',
  consultationId
}
    ↓
PDF generated → attached to ConsultationOutcome record
    ↓
Optional: If patient has an active health-chat ticket, also send in chat
```

**Backend adaptation**: The `/documents/prescription` endpoint should accept EITHER:
- `items[].batchId` (from inventory) — auto-resolves medicine name/dosage
- `items[].name` + `items[].dosage` (free-text) — uses as-is

This makes it work for consultations where the doctor types treatment directly.

### 9.3 Appointment Module

```
After appointment completed → doctor prescribes follow-up medication
    ↓
POST /documents/prescription {
  patientId,
  items,
  source: 'appointment',
  appointmentSlotId
}
    ↓
PDF generated → linked to patientSlot record
    ↓
Optionally emailed to patient (using existing email service)
```

### 9.4 Standalone / On-Demand

```
From any patient profile view → "Generate Prescription" action
    ↓
Opens a generic PrescriptionForm (reusable component)
    ↓
Staff fills in medications manually or selects from inventory
    ↓
POST /documents/prescription { patientId, items, source: 'manual' }
    ↓
PDF available for download/print
```

---

## 10. RPi 5 Performance Optimizations

The RPi 5 (8GB) has limited CPU and RAM. The docx-generation service uses **WeasyPrint** (HTML→PDF) and **Matplotlib** (charts) which are memory-hungry. Here are optimizations:

### 10.1 PDF Generation Strategy

| Strategy | Description | Savings |
|----------|-------------|---------|
| **Skip Matplotlib** | Prescriptions don't need charts — ensure no chart rendering triggers | ~50MB RSS saved |
| **Preload template** | Cache the parsed `DocxTemplate` object in FastAPI memory instead of re-reading from disk each time | ~200ms per request |
| **Use WeasyPrint caching** | Set `WEASYPRINT_CACHE` env var to reuse font resolution | ~100ms per request |
| **Limit concurrent requests** | Add a semaphore (max 2 concurrent) in FastAPI to prevent OOM | Prevents crash |
| **PDF over DOCX→PDF** | For prescriptions, consider generating PDF directly via Jinja2+WeasyPrint (skip DOCX step entirely) | ~40% faster |

### 10.2 Direct HTML→PDF Path (Recommended for Prescriptions)

Instead of DOCX→HTML→PDF (two conversions), add a **direct HTML→PDF** path for prescriptions:

```python
# New endpoint in FastAPI: POST /documents/prescription-pdf
# Uses Jinja2 HTML template → WeasyPrint → PDF directly
# Skips docxtpl and mammoth entirely

@router.post("/prescription-pdf")
async def generate_prescription_pdf(request: PrescriptionRequest):
    html = prescription_template.render(
        patient=request.patient,
        doctor=request.doctor,
        medications=request.medications,
        date=request.date,
        notes=request.notes,
    )
    pdf_bytes = HTML(string=html).write_pdf()
    return Response(content=pdf_bytes, media_type="application/pdf")
```

**Performance comparison on RPi 5:**

| Method | Time | RAM Peak |
|--------|------|----------|
| DOCX→HTML→PDF (current) | ~3-5s | ~180MB |
| HTML→PDF (direct) | ~1-2s | ~120MB |
| HTML→PDF with cached fonts | ~0.8-1.5s | ~100MB |

### 10.3 Queue and Rate Limiting

Add a simple queue to prevent multiple simultaneous PDF generations:

```javascript
// Backend/routes/documents/ — add to prescription endpoint
const prescriptionQueue = new Map(); // patientId → Promise

router.post('/prescription', async (req, res) => {
  const { patientId } = req.body;

  // Prevent duplicate concurrent prescriptions for same patient
  if (prescriptionQueue.has(patientId)) {
    return res.status(429).json({ error: 'Prescription generation in progress' });
  }

  const promise = generatePrescription(req);
  prescriptionQueue.set(patientId, promise);
  try {
    const result = await promise;
    res.json(result);
  } finally {
    prescriptionQueue.delete(patientId);
  }
});
```

### 10.4 Memory Management

```python
# In FastAPI main.py — limit worker memory
import resource

# Soft limit: 512MB per worker (leaves room for Node.js + PostgreSQL)
resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, -1))
```

### 10.5 Startup Optimization

The FastAPI service already uses uvicorn with a single worker. Keep it at 1 worker on RPi 5:

```python
# main.py — ensure single worker
uvicorn.run(app, host=HOST, port=PORT, workers=1, log_level=LOG_LEVEL)
```

---

## 11. Security Considerations

| Area | Measure |
|------|---------|
| **Authorization** | `POST /documents/prescription` requires `jwtProtect('medical')` + prescription permission |
| **Patient data access** | Verify staff has `prescription_allow_issue` or `consultation_allow_edit` permission |
| **Template injection** | `docxtpl` auto-escapes Jinja2 tags — ensure no raw HTML injection |
| **Path traversal** | Prescription PDFs stored with UUID filenames, served through existing media route with path validation |
| **Audit trail** | Every generated prescription creates an immutable `PrescriptionDocument` record |
| **JSONB snapshot** | Medication data is snapshotted at generation time — not a reference that could be modified later |
| **Rate limiting** | One concurrent prescription per patient to prevent abuse |
| **File access** | Prescription PDFs served only to the patient themselves or authorized medical staff |

---

## 12. Implementation Phases

### Phase 1: Enhanced Template + Backend Endpoint (Priority: Critical)

**Estimated effort**: Core changes

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `docx-generation/models/tag_contracts.py` | Update PRESCRIPTION contract with itemized fields |
| 1.2 | `docx-generation/create_templates.py` | Regenerate `prescription.docx` with table layout |
| 1.3 | `docx-generation/templates/prescription.html` | Create HTML template for direct HTML→PDF path |
| 1.4 | `Backend/routes/documents/` | Add `POST /documents/prescription` orchestrator |
| 1.5 | `Backend/config/multer.js` | Add `prescriptions` storage category |
| 1.6 | `Backend/routes/media/` | Allow serving `prescription` category files |
| 1.7 | SQL migration | Create `PrescriptionDocument` table |

### Phase 2: Health-Chat Integration (Priority: Critical)

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `routes/medical-inventory/prescription/` | Return `prescriptionFileId` from `issuePrescription` |
| 2.2 | `mds-staff/src/modules/health-chat/components/PrescriptionModal.jsx` | Add frequency/duration/instructions fields |
| 2.3 | `mds-staff/src/modules/health-chat/components/PrescriptionModal.jsx` | Send prescription PDF as chat message after issuance |
| 2.4 | `mds-staff/src/modules/health-chat/prescription-service.js` | Update mutation to include new fields + return fileId |
| 2.5 | `mds-staff/src/modules/health-chat/components/message-bubble.jsx` | Add prescription message rendering |
| 2.6 | SQL migration | Add `'prescription'` to HealthChatPrompt promptType |

### Phase 3: Consultation Integration (Priority: High)

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `mds-staff/src/modules/consultation/` | Add "Generate Prescription" button in outcome panel |
| 3.2 | Shared component | Extract `PrescriptionForm` as reusable component |
| 3.3 | `Backend/routes/documents/` | Support free-text medication items (not just batchIds) |

### Phase 4: Appointment Integration (Priority: Medium)

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | `mds-staff/src/modules/appointment/` | Add prescription action post-appointment |
| 4.2 | `Backend/services/emailservice.js` | Email prescription PDF to patient |

### Phase 5: Patient-Side Viewing (Priority: Medium)

| Task | File(s) | Description |
|------|---------|-------------|
| 5.1 | `mds-patient/src/` | Show prescription documents in patient chat |
| 5.2 | `mds-patient/src/` | Prescription history page |
| 5.3 | `mds-mobile/src/` | Mobile app prescription viewing |

---

## 13. File Change Inventory

### Backend — New Files

| File | Purpose |
|------|---------|
| `Backend/routes/documents/prescription.js` | Prescription document orchestrator endpoint |
| `Backend/services/docx-generation/templates/prescription.html` | HTML template for direct HTML→PDF generation |
| `Backend/migrations/xxx_create_prescription_document.sql` | DB migration for PrescriptionDocument table |

### Backend — Modified Files

| File | Change |
|------|--------|
| `Backend/services/docx-generation/models/tag_contracts.py` | Expand PRESCRIPTION contract with itemized fields |
| `Backend/services/docx-generation/create_templates.py` | Regenerate prescription.docx with medication table |
| `Backend/config/multer.js` | Add `prescriptions` to MEDIA_PATH |
| `Backend/routes/media/` | Add `prescription` to allowed file categories |
| `Backend/routes/medical-inventory/prescription/wrapper.js` | Return `prescriptionFileId` after issuePrescription |
| `Backend/routes/documents/index.js` | Mount prescription route |
| `Backend/config/data/post_build_setup.sql` | Add PrescriptionDocument table + promptType enum update |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `mds-staff/src/modules/health-chat/components/PrescriptionModal.jsx` | Add medication detail fields, trigger PDF gen, send in chat |
| `mds-staff/src/modules/health-chat/prescription-service.js` | Update mutation input shape + return prescriptionFileId |
| `mds-staff/src/modules/health-chat/components/message-bubble.jsx` | Render `promptType: 'prescription'` with special styling |
| `mds-staff/src/modules/health-chat/components/message-input.jsx` | Fix `isActive` variable ordering (currently used before defined) |
| `mds-staff/src/modules/health-chat/health-chat-service.js` | Add 'prescription' to promptType handling |

### FastAPI Service — Modified Files

| File | Change |
|------|--------|
| `Backend/services/docx-generation/routes/document.py` | Add `/documents/prescription-pdf` direct HTML→PDF endpoint |
| `Backend/services/docx-generation/modules/pdf_report.py` | Reuse Jinja2 report renderer for prescription HTML |

---

## Appendix A: message-input.jsx Bug

There is a bug in the current `message-input.jsx`:

```javascript
// Line 15 — isActive used BEFORE it's defined on line 85
const canSend = isActive && (inputValue.trim() || attachedFile) && !isSending && activeTicketId;
// ...
// Line 85
const isActive = selectedTicket?.status === 'Ongoing';
```

`isActive` is referenced in `canSend` before its `const` declaration. This will cause a **ReferenceError** in strict mode or always be `undefined` due to the temporal dead zone. Move the `isActive` declaration above `canSend`, or move `canSend` to after `isActive`.

---

## Appendix B: Direct HTML→PDF Prescription Template

For RPi 5 performance, a dedicated HTML prescription template avoids the DOCX→HTML→PDF pipeline:

```html
<!-- templates/prescription.html -->
<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A5; margin: 15mm; }
  body { font-family: 'Helvetica', sans-serif; font-size: 11pt; color: #222; }
  .header { text-align: center; border-bottom: 2px solid #2d5f2d; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 14pt; margin: 0; color: #2d5f2d; }
  .header p { font-size: 9pt; margin: 2px 0; color: #666; }
  .patient-info { margin-bottom: 12px; }
  .patient-info td { padding: 2px 8px 2px 0; font-size: 10pt; }
  .rx { font-size: 18pt; font-weight: bold; color: #2d5f2d; margin: 8px 0; }
  .med-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .med-table th { background: #f0f7f0; border: 1px solid #ccc; padding: 6px; font-size: 9pt; text-align: left; }
  .med-table td { border: 1px solid #ccc; padding: 6px; font-size: 10pt; }
  .signature { margin-top: 30px; text-align: right; }
  .signature .line { border-top: 1px solid #222; width: 200px; margin-left: auto; }
  .notes { font-size: 9pt; color: #555; margin-top: 12px; padding: 6px; background: #fafafa; border-left: 3px solid #2d5f2d; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{ clinic_name }}</h1>
    <p>{{ clinic_address }}</p>
  </div>

  <table class="patient-info">
    <tr><td><strong>Patient:</strong></td><td>{{ patient_name }}</td><td><strong>Date:</strong></td><td>{{ date }}</td></tr>
    <tr><td><strong>Age:</strong></td><td>{{ patient_age }}</td><td><strong>Sex:</strong></td><td>{{ patient_sex }}</td></tr>
    <tr><td><strong>Address:</strong></td><td colspan="3">{{ patient_address }}</td></tr>
  </table>

  <div class="rx">Rx:</div>

  <table class="med-table">
    <thead>
      <tr><th>#</th><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr>
    </thead>
    <tbody>
      {% for med in medications %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ med.name }}</td>
        <td>{{ med.dosage }}</td>
        <td>{{ med.frequency }}</td>
        <td>{{ med.duration }}</td>
        <td>{{ med.quantity }}</td>
        <td>{{ med.instructions }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  {% if notes %}
  <div class="notes"><strong>Notes:</strong> {{ notes }}</div>
  {% endif %}

  <div class="signature">
    <div class="line"></div>
    <p><strong>{{ doctor_name }}</strong></p>
    <p style="font-size:9pt">License No.: {{ license_no }}</p>
    <p style="font-size:9pt">PTR No.: {{ ptr_no }}</p>
    {% if s2_no %}<p style="font-size:9pt">S2 No.: {{ s2_no }}</p>{% endif %}
  </div>
</body>
</html>
```

---

## Appendix C: Recommended Prescription Frequency Options

Standard medical abbreviations for the frontend dropdown:

| Code | Meaning | Description |
|------|---------|-------------|
| OD | Once daily | quaque die |
| BID | Twice daily | bis in die |
| TID | Three times daily | ter in die |
| QID | Four times daily | quater in die |
| q4h | Every 4 hours | |
| q6h | Every 6 hours | |
| q8h | Every 8 hours | |
| q12h | Every 12 hours | |
| PRN | As needed | pro re nata |
| STAT | Immediately | statim |
| HS | At bedtime | hora somni |
| AC | Before meals | ante cibum |
| PC | After meals | post cibum |

---

## Appendix D: Sequence Diagram — Health-Chat Prescription

```
Staff                  Frontend              Backend               FastAPI           Storage
  │                       │                     │                     │                 │
  │ Click Pill icon       │                     │                     │                 │
  ├──────────────────────>│                     │                     │                 │
  │                       │ getAvailableMedicine│                     │                 │
  │                       ├────────────────────>│                     │                 │
  │                       │<────────────────────┤                     │                 │
  │ Select meds + details │                     │                     │                 │
  ├──────────────────────>│                     │                     │                 │
  │                       │                     │                     │                 │
  │ Click "Issue"         │                     │                     │                 │
  ├──────────────────────>│                     │                     │                 │
  │                       │ issuePrescription() │                     │                 │
  │                       ├────────────────────>│                     │                 │
  │                       │                     │ Deduct inventory    │                 │
  │                       │                     ├──┐                  │                 │
  │                       │                     │<─┘                  │                 │
  │                       │                     │                     │                 │
  │                       │                     │ POST /prescription  │                 │
  │                       │                     ├────────────────────>│                 │
  │                       │                     │                     │ Fetch patient   │
  │                       │                     │                     │ Fetch doctor    │
  │                       │                     │                     │ Render HTML     │
  │                       │                     │                     │ WeasyPrint→PDF  │
  │                       │                     │<────────────────────┤                 │
  │                       │                     │                     │                 │
  │                       │                     │ Save PDF            │                 │
  │                       │                     ├────────────────────────────────────── >│
  │                       │                     │                     │                 │
  │                       │                     │ Create audit record │                 │
  │                       │                     ├──┐                  │                 │
  │                       │                     │<─┘                  │                 │
  │                       │                     │                     │                 │
  │                       │ { prescriptionFileId }                    │                 │
  │                       │<────────────────────┤                     │                 │
  │                       │                     │                     │                 │
  │                       │ sendMessage(fileId, 'prescription')       │                 │
  │                       ├────────────────────>│                     │                 │
  │                       │                     │ Store in HealthChatPrompt             │
  │                       │                     │ Emit socket → patient                 │
  │                       │<────────────────────┤                     │                 │
  │ Success screen        │                     │                     │                 │
  │<──────────────────────┤                     │                     │                 │
```
