# Prescription & Consultation Document Generation — Cross-Module Implementation Plan

> **System**: MDSystem (RPi 5, 8GB RAM)  
> **Date**: March 30, 2026  
> **Status**: Planning — Aligned with JS doc-generate-module  
> **Scope**: Health-chat (Phase 1), Consultation & Appointment (Phase 2+)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Comparison: Old (Python) vs Current (JS)](#2-architecture-comparison)
3. [Current State Analysis](#3-current-state-analysis)
4. [Gap Analysis](#4-gap-analysis)
5. [Backend Readiness Assessment](#5-backend-readiness-assessment)
6. [Implementation Architecture](#6-implementation-architecture)
7. [Phase 1 — Health-Chat Prescription PDF](#7-phase-1--health-chat-prescription-pdf)
8. [Phase 2 — Consultation Integration](#8-phase-2--consultation-integration)
9. [Phase 3 — Cross-Module Expansion](#9-phase-3--cross-module-expansion)
10. [File Change Inventory](#10-file-change-inventory)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Database Considerations](#12-database-considerations)
13. [RPi 5 Performance Notes](#13-rpi-5-performance-notes)
14. [Security Considerations](#14-security-considerations)

---

## 1. Executive Summary

### What Changed

The backend **replaced the Python FastAPI docx-generation microservice** with a **pure Node.js `doc-generate-module`** that generates PDFs directly using PDFKit. This eliminates:
- The Python subprocess (FastAPI on port 3002)
- WeasyPrint HTML→PDF rendering
- DOCX intermediate files + LibreOffice conversion
- Cross-language HTTP communication overhead

### What Already Works

| Component | Status | Details |
|-----------|--------|---------|
| **JS Prescription Template** | ✅ Complete | `doc-generate-module/templates/prescription.js` — full PDFKit prescription with Rx symbol, medication list, patient info, physician signature |
| **Document Generation API** | ✅ Complete | `POST /documents/prescription/generate` — generates PDF, saves to DB (`PatientDocuments` + `documentData`), returns `documentId` |
| **Document Retrieval API** | ✅ Complete | `GET /documents/:id` (staff) / `GET /documents/my/:id` (patient) — download saved PDFs |
| **Preview API** | ✅ Complete | `POST /documents/prescription/preview` — streams PDF without saving |
| **Prescription Frontend** | ⚠️ Text-only | Current `PrescriptionModal.jsx` sends formatted text message — no PDF generation |
| **Inventory Prescription** | ✅ Complete | `issuePrescription` mutation — stock management, batch validation, `MedicineTransactionLog` |

### What Needs To Happen

**The current backend is SUFFICIENT to generate prescription PDFs from health-chat.** The frontend `PrescriptionModal` just needs to call the existing `POST /documents/prescription/generate` endpoint instead of sending a text message. No new backend routes needed.

---

## 2. Architecture Comparison

### Old Architecture (Python — REMOVED)

```
Express (Node.js)  ──HTTP POST──>  FastAPI (Python :3002)
        │                                │
  Route handler                    Jinja2 HTML template
  builds payload ──────────>       WeasyPrint renders PDF
        │                                │
  Receives PDF blob  <──────────   Returns binary PDF
        │
  Returns to client
```

**Problems**: 2 languages, subprocess management, WeasyPrint slow on RPi (~2-3s), Jinja2 template maintenance.

### Current Architecture (JS — ACTIVE)

```
Express route ──> doc-generate-module/index.js
                        │
                  PrescriptionTemplate (extends BaseTemplate)
                        │
                  PDFKit direct rendering
                        │
                  Returns Buffer / streams to response
```

**Advantages**: Single language, no subprocess, ~200-500ms generation, template-as-code (maintainable), built-in chart support via chartjs-node-canvas.

### Key Mapping

| Old (Python) | New (JS) | Notes |
|---|---|---|
| `FastAPI /prescription/generate` | `POST /documents/prescription/generate` | Now in Express documents route |
| `PrescriptionRequest` (Pydantic) | `PrescriptionTemplate.getSampleData()` | Data schema defined by template |
| `prescription.html` (Jinja2) | `prescription.js` build() method | PDFKit code replaces HTML template |
| WeasyPrint rendering | PDFKit direct rendering | ~4x faster on RPi |
| `docx-generation-manager.js` | Not needed | No subprocess to manage |
| `tip_logo.jpg` base64 | `addHeader()` text-based | Logo can be added via BaseTemplate |

---

## 3. Current State Analysis

### 3.1 Backend doc-generate-module

**Location**: `Backend/services/doc-generate-module/`

**Templates available**:
| Template | Type | Persists to DB | Production-Ready |
|---|---|---|---|
| Medical Certificate | `medical-certificate` | Yes | ✅ |
| **Prescription** | `prescription` | **Yes** | ✅ |
| Diagnosis Report | `diagnosis-report` | No (stream) | ✅ |
| Staff Report | `staff-report` | No (stream) | ✅ |

**Prescription template data shape** (what the backend expects):
```javascript
{
  patient: {
    id: Number,              // Required for DB persistence
    firstName: String,
    middleName: String,
    lastName: String,
    suffix: String,
    dateOfBirth: 'YYYY-MM-DD',
    sex: 'Male' | 'Female',
    contactNumber: String,
    address: String
  },
  physician: {
    id: Number,              // Auto-filled from JWT
    firstName: String,
    lastName: String,
    title: 'MD' | 'DMD',
    licenseNo: String,
    specialization: String
  },
  clinic: {
    name: String,
    address: String,
    contactNumber: String
  },
  issuedDate: 'YYYY-MM-DD',
  prescription: {
    diagnosis: String,
    medications: [{
      name: String,          // e.g. 'Amoxicillin 500mg'
      dosage: String,        // e.g. '1 capsule'
      frequency: String,     // e.g. '3 times a day'
      duration: String,      // e.g. '7 days'
      quantity: Number,       // e.g. 21
      instructions: String   // e.g. 'Take after meals'
    }],
    specialInstructions: String,
    followUpDate: 'YYYY-MM-DD'
  }
}
```

### 3.2 Documents Route (Backend)

**Location**: `Backend/routes/documents/documents.js`

**Key endpoint**: `POST /documents/:docType/generate`
- JWT-protected (medical staff only)
- Accepts `{ patientId, data }` body
- Auto-enriches `physician.id` from JWT
- If template `persistToDatabase === true`:
  - Generates PDF buffer via `docGen.generateDocumentBuffer()`
  - Creates/finds `documentTemplate` record
  - Inserts `PatientDocuments` row (links patient, template, issuer)
  - Inserts `documentData` row (base64-encoded PDF)
  - Returns `{ documentId, filename, metadata }`
- If template doesn't persist: streams PDF directly

### 3.3 Health-Chat System

**Current prescription flow** (text-only):
```
PrescriptionModal → builds formatted text string → sendMessage(ticketId, text, null, 'text')
```

**File sending flow** (already works):
```
uploadFile(file) → POST /media/stage/ → fileId
sendMessage(ticketId, null, fileId, 'file') → backend promotes file → socket broadcast
```

### 3.4 Medical Inventory

**`issuePrescription` mutation**: Handles stock management (batch validation, `MedicineEntity` assignment, `MedicineTransactionLog`). This is **separate** from document generation — it tracks the physical dispensing of medicine.

### 3.5 Consultation System

**Consultation lifecycle**: Created → Open → (Completed | Referred | Monitored)
**Outcome data**: Complaints, PE Findings, Treatments (text array), Diagnoses (ICD-10 coded)
**Gap**: Treatments are plain text strings — no structured medication model yet.

---

## 4. Gap Analysis

| # | Gap | Impact | Priority | Phase |
|---|------|--------|----------|-------|
| G1 | Frontend PrescriptionModal sends text, not PDF | No formal prescription document for patient | **Critical** | 1 |
| G2 | No `generatePrescriptionPdf()` service function in staff frontend | Frontend can't call document generation API | **Critical** | 1 |
| G3 | PrescriptionModal doesn't collect `diagnosis` or `specialInstructions` | Missing fields for full prescription template | **High** | 1 |
| G4 | No patient data auto-fill from health-chat context | Staff manually types all patient info | **High** | 1 |
| G5 | No physician data auto-fill from JWT/profile | Doctor credentials blank on prescription | **High** | 1 |
| G6 | Chat `HealthChatPrompt.promptType` only supports `text/file/system` | Can't distinguish prescription files from regular files | **Medium** | 1 |
| G7 | No prescription-to-chat auto-send after PDF generation | Two disconnected steps | **High** | 1 |
| G8 | Consultation treatments aren't linked to structured medications | Can't generate prescription from consultation data | **Medium** | 2 |
| G9 | No `MedicalPersonnel` license/PTR data in database | Prescriptions have blank credentials | **Low** | 2 |
| G10 | Panel layout (side panel vs modal) needs decision | UX consistency | **Medium** | 1 |

---

## 5. Backend Readiness Assessment

### Can the current backend generate prescription PDFs from health-chat?

**YES.** Here's why:

| Requirement | Backend Support | Status |
|---|---|---|
| Generate prescription PDF | `POST /documents/prescription/generate` | ✅ Ready |
| Save to patient documents | `PatientDocuments` + `documentData` tables | ✅ Ready |
| Patient can view later | `GET /documents/my` + `GET /documents/my/:id` | ✅ Ready |
| Staff can download | `GET /documents/:documentId` | ✅ Ready |
| Preview before saving | `POST /documents/prescription/preview` | ✅ Ready |
| Physician auto-fill from JWT | Route enriches `physician.id` from `req.user.id` | ⚠️ Partial (needs name lookup) |
| Template handles medications | Full medication list with Rx symbol | ✅ Ready |

### What's missing for full physician auto-fill?

The `POST /documents/:docType/generate` route sets `physician.id` from JWT but **doesn't look up the physician's name/title/license**. The template falls back to sample data for missing fields.

**Solution**: Add a DB lookup in the route to fetch physician details from `UsersPersonal` + `MedicalPersonnel` before passing to the template. **~10 lines of code.**

### Can it handle consultation prescriptions?

**Partially.** The same `POST /documents/prescription/generate` endpoint works for any caller. The consultation module would need to:
1. Collect structured medication data (currently treatments are text-only)
2. Build the same `data` payload with patient/physician/prescription fields
3. Call the same endpoint

---

## 6. Implementation Architecture

### 6.1 Target Flow: Health-Chat Prescription

```
Staff clicks "Prescription" (+ menu in chat input)
  ↓
PrescriptionPanel opens (side panel, 380px)
  — Patient name, age, sex, DOB pre-filled from chat context
  — Physician name auto-filled from auth context
  ↓
Staff enters: diagnosis, medications, dosage, frequency, duration, qty, instructions
  ↓
"Generate Prescription" clicked
  ↓
Frontend: POST /documents/prescription/generate
  Body: { patientId, data: { patient, physician, prescription, issuedDate } }
  ↓
Backend documents.js:
  1. JWT validation (medical staff only)
  2. Lookup physician name/title from UsersPersonal
  3. Lookup physician license from MedicalPersonnel (if exists)
  4. Generate PDF via docGen.generateDocumentBuffer('prescription', enrichedData)
  5. Save to PatientDocuments + documentData
  6. Return { documentId, filename, metadata }
  ↓
Frontend receives { documentId }
  ↓
Option A (Recommended): Download PDF via GET /documents/{documentId}
  → Create blob → Upload as file via POST /media/stage/ → fileId
  → sendMessage(ticketId, null, fileId, 'file')
  → Prescription appears as PDF file in chat
  ↓
Option B: Send documentId as metadata + text notification
  → Patient retrieves via documents/my endpoint
  ↓
Success: "Prescription Generated" + Download link + Sent in chat
```

### 6.2 Target Flow: Consultation Prescription (Phase 2)

```
Staff opens consultation → Treatment tab
  ↓
"Generate Prescription" button on treatment section
  ↓
Pre-fills from consultation: patient info, diagnoses → diagnosis field
  ↓
Staff enters medications (same form as health-chat)
  ↓
Same POST /documents/prescription/generate endpoint
  ↓
PDF saved to PatientDocuments
  ↓
Optional: Link documentId to ConsultationOutcome
```

### 6.3 Design Principles

1. **Single API endpoint** — `POST /documents/prescription/generate` serves ALL modules  
2. **Template-as-code** — prescription.js IS the template, no separate HTML  
3. **Auto-fill where possible** — patient from context, physician from JWT  
4. **PDF-first** — generate PDF, then optionally send as chat file  
5. **Persist always** — prescription `persistToDatabase = true`, every Rx is saved  
6. **Decouple document from inventory** — PDF generation ≠ stock dispensing  

---

## 7. Phase 1 — Health-Chat Prescription PDF

### 7.1 Backend Changes

#### A. Enhance `POST /documents/:docType/generate` with physician auto-fill

**File**: `Backend/routes/documents/documents.js`

Add physician lookup when physician details are missing:
```javascript
// After enrichedData is built, before generating:
if (!enrichedData.physician?.firstName) {
  const physicianResult = await db.query(
    `SELECT up.first_name, up.last_name, up.sex,
            mp.role, mp.title, mp.designation
     FROM "UsersPersonal" up
     LEFT JOIN "MedicalPersonnel" mp ON mp.id = up.id
     WHERE up.id = $1`,
    [req.user.id]
  );
  if (physicianResult.rows.length > 0) {
    const doc = physicianResult.rows[0];
    enrichedData.physician = {
      ...enrichedData.physician,
      firstName: doc.first_name,
      lastName: doc.last_name,
      title: doc.title || 'MD',
      licenseNo: enrichedData.physician?.licenseNo || '',
      specialization: doc.designation || '',
    };
  }
}
```

#### B. Add patient data lookup endpoint (optional optimization)

The frontend already has patient data from the health-chat context (`selectedTicket.patient`). A backend lookup is optional but adds `dateOfBirth`, `sex`, `address` which the chat context may not have.

**Option**: Use existing GraphQL `ChatParticipant` type which already has `dateOfBirth` and `sex` (added in earlier phase per changelog). If those fields are populated, no additional endpoint needed.

### 7.2 Frontend Changes

#### A. New: `prescription-document-service.js`

**File**: `mds-staff/src/modules/health-chat/prescription-document-service.js`

```javascript
import { axiosRequest } from '../../packages-core-adapter';

/**
 * Generate a prescription PDF via the document generation API.
 * Returns { documentId, filename, metadata }.
 */
export const generatePrescription = async (patientId, prescriptionData) => {
  const response = await axiosRequest.post('/documents/prescription/generate', {
    patientId,
    data: prescriptionData,
  });
  return response.data;
};

/**
 * Download a generated document as a Blob.
 */
export const downloadDocumentBlob = async (documentId) => {
  const response = await axiosRequest.get(`/documents/${documentId}`, {
    responseType: 'blob',
  });
  return response.data;
};
```

#### B. Rewrite: `PrescriptionModal.jsx` → `PrescriptionPanel.jsx`

Convert from text-message modal to PDF-generating side panel:

**Key changes**:
1. **Side panel (380px)** instead of centered modal — staff sees chat while writing
2. **Fields aligned to template data shape**: diagnosis, medications (name, dosage, frequency, duration, qty, instructions), specialInstructions, followUpDate
3. **Auto-fill**: patient name/age/sex from `selectedTicket.patient` + `dateOfBirth`/`sex` from chat context
4. **Submit flow**: Call `generatePrescription()` → get `documentId` → download blob → upload as chat file → `sendMessage()` with file
5. **Success state**: Shows "Prescription Generated" with download link

#### C. Update: `chat-panel.jsx`

- Add `showPrescription` state
- Wrap content in horizontal flex: `[chat-col (flex-1)] [PrescriptionPanel (380px)]`
- Pass panel open/close to MessageInput

#### D. Update: `message-input.jsx`

- Replace local `PrescriptionModal` rendering with callback to parent (`onOpenPrescription`)
- Panel state managed by `chat-panel.jsx`

### 7.3 Frontend Data Assembly

When submitting, the frontend builds this payload from context + form:

```javascript
const payload = {
  patientId: selectedTicket.patient.id,   // from chat context
  data: {
    patient: {
      id: selectedTicket.patient.id,
      firstName: selectedTicket.patient.firstName,
      lastName: selectedTicket.patient.lastName,
      dateOfBirth: selectedTicket.patient.dateOfBirth,  // from GraphQL
      sex: selectedTicket.patient.sex,                  // from GraphQL
      address: form.address || '',
    },
    // physician auto-filled by backend from JWT
    issuedDate: new Date().toISOString().split('T')[0],
    prescription: {
      diagnosis: form.diagnosis,
      medications: form.medications.filter(m => m.name.trim()).map(m => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        quantity: parseInt(m.quantity) || 0,
        instructions: m.instructions,
      })),
      specialInstructions: form.specialInstructions,
      followUpDate: form.followUpDate || null,
    },
  },
};
```

### 7.4 Auto-Send as Chat File

After PDF generation, automatically send in the active chat:

```javascript
// 1. Generate prescription (saves to DB, returns documentId)
const result = await generatePrescription(patientId, data);

// 2. Download the PDF blob
const pdfBlob = await downloadDocumentBlob(result.documentId);

// 3. Upload to media staging
const fileName = result.filename || `prescription_${patientId}.pdf`;
const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
const fileId = await uploadFile(file);

// 4. Send as file message in chat
await sendMessage(activeTicketId, null, fileId, 'file');
```

---

## 8. Phase 2 — Consultation Integration

### 8.1 Generate Prescription from Consultation

Add a "Generate Prescription" button in the consultation treatment tab that:
1. Pre-fills patient data from consultation record
2. Pre-fills diagnosis from `ConsultationDiagnosis` records
3. Opens the same prescription form (reusable component)
4. Calls the same `POST /documents/prescription/generate` endpoint
5. Links `documentId` to consultation (optional `consultationId` field in payload)

### 8.2 Diagnosis Report Generation

Already exists as `diagnosis-report` template. Can be triggered from consultation completion:
```javascript
POST /documents/diagnosis-report/preview
Body: {
  data: {
    patient: { ... },
    consultation: { id, date, type, mode, status },
    complaints: [...],
    peFindings: [...],
    diagnoses: [{ name, icdCode, type, notes }],
    treatments: [...],
    remarks: '...'
  }
}
```

### 8.3 Schema Enhancement (Future)

To link prescriptions to consultations:
```sql
ALTER TABLE "PatientDocuments"
  ADD COLUMN IF NOT EXISTS "consultationId" INTEGER REFERENCES "Consultation"(id),
  ADD COLUMN IF NOT EXISTS "healthChatId" INTEGER REFERENCES "HealthChat"(id);
```

---

## 9. Phase 3 — Cross-Module Expansion

### 9.1 Appointment Follow-Up Prescriptions

Same endpoint, different entry point. Appointment module can generate prescriptions by:
1. Loading patient data from appointment record
2. Using the same prescription form component
3. Calling `POST /documents/prescription/generate`

### 9.2 Patient Portal Access

Already supported:
- `GET /documents/my` — lists all patient documents
- `GET /documents/my/:documentId` — downloads specific document
- Patient frontend just needs a "My Documents" page

### 9.3 Medical Certificate from Any Module

Same pattern — `POST /documents/medical-certificate/generate` already works.

---

## 10. File Change Inventory

### Phase 1 (Health-Chat PDF Prescription)

| File | Action | Description |
|------|--------|-------------|
| `Backend/routes/documents/documents.js` | **Modify** | Add physician auto-fill lookup (~15 lines) |
| `mds-staff/src/modules/health-chat/prescription-document-service.js` | **Create** | Document generation API calls |
| `mds-staff/src/modules/health-chat/components/PrescriptionPanel.jsx` | **Create** | New side-panel prescription form with PDF generation |
| `mds-staff/src/modules/health-chat/components/PrescriptionModal.jsx` | **Remove/Replace** | Replaced by PrescriptionPanel |
| `mds-staff/src/modules/health-chat/components/chat-panel.jsx` | **Modify** | Add horizontal flex layout with panel slot |
| `mds-staff/src/modules/health-chat/components/message-input.jsx` | **Modify** | Delegate prescription open to parent via callback |

### Phase 2 (Consultation)

| File | Action | Description |
|------|--------|-------------|
| `mds-staff/src/modules/consultation/components/TreatmentTab.jsx` | **Modify** | Add "Generate Prescription" button |
| `mds-staff/src/modules/consultation/prescription-document-service.js` | **Create** | Reuse/import from shared service |

### Backend (Shared)

| File | Status | Description |
|------|--------|-------------|
| `Backend/services/doc-generate-module/templates/prescription.js` | ✅ **No changes needed** | Template is complete |
| `Backend/services/doc-generate-module/index.js` | ✅ **No changes needed** | Registry handles prescription |
| `Backend/routes/documents/documents.js` | **Modify** | Physician auto-fill only |

---

## 11. Data Flow Diagrams

### Health-Chat Prescription (Phase 1)

```
┌─────────────────────────────────────────────────────────┐
│ mds-staff (Frontend)                                    │
│                                                         │
│  PrescriptionPanel                                      │
│   ├─ Patient info (from chat context)                   │
│   ├─ Diagnosis (staff input)                            │
│   ├─ Medications[] (staff input)                        │
│   └─ "Generate" button                                  │
│         │                                               │
│         ▼                                               │
│  prescription-document-service.js                       │
│   └─ POST /documents/prescription/generate              │
│         │                          ▲                    │
│         │                          │ { documentId }     │
│         │                          │                    │
│         │    downloadDocumentBlob(documentId)            │
│         │         │                                     │
│         │         ▼                                     │
│         │    uploadFile(blob) → fileId                  │
│         │         │                                     │
│         │         ▼                                     │
│         │    sendMessage(ticketId, null, fileId, 'file') │
│         │         │                                     │
└─────────┼─────────┼────────────────────────────────────┘
          │         │
          ▼         ▼
┌─────────────────────────────────────────────────────────┐
│ Backend (Express)                                       │
│                                                         │
│  POST /documents/prescription/generate                  │
│   ├─ JWT validation (medical)                           │
│   ├─ Physician lookup (UsersPersonal + MedicalPersonnel)│
│   ├─ docGen.generateDocumentBuffer('prescription', data)│
│   ├─ Save to PatientDocuments + documentData            │
│   └─ Return { documentId, filename }                   │
│                                                         │
│  POST /media/stage/                                     │
│   └─ Stage PDF blob → return fileId                    │
│                                                         │
│  GraphQL sendMedicalMessage(chatId, null, fileId, 'file')│
│   └─ Promote file + insert HealthChatPrompt             │
│   └─ Socket: healthchat:new-message                     │
│                                                         │
│  GET /documents/my/:documentId (patient access)         │
│   └─ Patient can download their prescription later      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Cross-Module (Phase 2+)

```
┌───────────────────┐  ┌──────────────────┐  ┌────────────────┐
│   Health-Chat     │  │  Consultation    │  │  Appointment   │
│   PrescriptionPanel│  │  Treatment Tab   │  │  Follow-Up Rx  │
└────────┬──────────┘  └────────┬─────────┘  └───────┬────────┘
         │                      │                     │
         └──────────────────────┼─────────────────────┘
                                │
                   POST /documents/prescription/generate
                   (Single endpoint, same data shape)
                                │
                   ┌────────────┴───────────────┐
                   │  doc-generate-module        │
                   │  PrescriptionTemplate       │
                   │  PDFKit → Buffer            │
                   └────────────┬───────────────┘
                                │
                   ┌────────────┴───────────────┐
                   │  PatientDocuments (DB)      │
                   │  documentData (base64 PDF)  │
                   └────────────────────────────┘
```

---

## 12. Database Considerations

### Already Exists (No Migration Needed)

| Table | Purpose |
|-------|---------|
| `documentTemplate` | Template registry (auto-created on first use) |
| `PatientDocuments` | Document ownership (patientId, templateId, issuedBy, created_at) |
| `documentData` | PDF storage (base64 encoded) |
| `HealthChat` | Chat tickets |
| `HealthChatPrompt` | Chat messages (text/file/system) |
| `MedicineTransactionLog` | Inventory dispensing (separate from document) |

### Future Enhancement (Optional)

```sql
-- Link documents to their source module
ALTER TABLE "PatientDocuments"
  ADD COLUMN IF NOT EXISTS "sourceModule" VARCHAR(50),     -- 'health-chat', 'consultation', 'appointment'
  ADD COLUMN IF NOT EXISTS "sourceId" INTEGER;              -- healthChatId or consultationId

-- Add physician credentials
ALTER TABLE "MedicalPersonnel"
  ADD COLUMN IF NOT EXISTS "licenseNo" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "ptrNo" VARCHAR(50);
```

---

## 13. RPi 5 Performance Notes

### Current JS PDFKit Performance (Measured)

| Operation | Time | Notes |
|-----------|------|-------|
| PDF generation (3 medications) | ~200-400ms | PDFKit direct rendering |
| Buffer to base64 encoding | ~10ms | Node.js native |
| DB insert (document + data) | ~20-50ms | PostgreSQL |
| **Total backend** | **~250-500ms** | Vs ~2-5s with Python/WeasyPrint |
| File upload (staging) | ~50ms | Local filesystem |
| sendMessage (GraphQL) | ~30ms | DB insert + socket emit |

### Optimization: No Need for Worker Threads

The Python architecture was slow enough to warrant async processing. The JS PDFKit generation is fast enough to run synchronously in the request handler without blocking the event loop significantly.

### Chart Generation (diagnosis-report only)

Uses `chartjs-node-canvas` which creates a canvas — this is the heaviest operation (~500ms). Prescriptions don't use charts, so no concern there.

---

## 14. Security Considerations

### Already Handled

| Concern | Protection |
|---------|-----------|
| Unauthorized access | `jwtProtect('medical')` on all document routes |
| Patient data isolation | `GET /documents/my/:id` checks `patientId = req.user.id` |
| File type validation | Media staging validates magic bytes |
| SQL injection | Parameterized queries throughout |

### Must Enforce

| Concern | Action |
|---------|--------|
| Input sanitization | Validate/sanitize medication names and instructions before PDF generation |
| PDF size limits | Set max medications per prescription (e.g., 20) |
| Rate limiting | Consider rate-limiting document generation (e.g., max 10/min per user) |
| Document access audit | Log all document downloads with user ID and timestamp (already done) |

---

## Appendix A: Template Data Quick Reference

### Minimal Prescription Payload

```javascript
// Minimum viable payload for POST /documents/prescription/generate
{
  patientId: 123,
  data: {
    patient: {
      id: 123,
      firstName: 'Juan',
      lastName: 'Cruz',
    },
    // physician: auto-filled from JWT + DB lookup
    // clinic: falls back to sample data defaults
    // issuedDate: defaults to today
    prescription: {
      medications: [
        { name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: '3 times a day' }
      ]
    }
  }
}
```

### Full Prescription Payload

```javascript
{
  patientId: 123,
  data: {
    patient: {
      id: 123, firstName: 'Juan', middleName: 'Dela', lastName: 'Cruz',
      suffix: '', dateOfBirth: '1990-05-15', sex: 'Male',
      contactNumber: '09171234567', address: '123 Sample St, Manila'
    },
    physician: {
      firstName: 'Maria', lastName: 'Santos', title: 'MD',
      licenseNo: 'PRC-123456', specialization: 'General Medicine'
    },
    issuedDate: '2026-03-30',
    prescription: {
      diagnosis: 'Upper Respiratory Tract Infection',
      medications: [
        { name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: '3 times a day',
          duration: '7 days', quantity: 21, instructions: 'Take after meals' },
        { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Every 4-6 hours PRN',
          duration: 'As needed', quantity: 10, instructions: 'For fever above 37.5°C' }
      ],
      specialInstructions: 'Complete full course of antibiotics. Return if symptoms persist.',
      followUpDate: '2026-04-06'
    }
  }
}
```

---

## Appendix B: Existing Frontend Reference Files

These files from `c:\Users\King\Documents\prescription\` were built for the old Python backend and serve as **design references** for the new implementation:

| File | Use As Reference For |
|------|---------------------|
| `PrescriptionModal.jsx` (panel version) | Side-panel UI layout, medication form fields, auto-fill logic |
| `chat-panel.jsx` | Horizontal flex layout with panel slot |
| `message-input.jsx` | Plus menu with prescription option, panel state delegation |
| `prescription-service.js` | API call pattern (adapt to REST instead of Python endpoint) |
| `prescription.html` | Visual design reference (TIP letterhead style) |

---

*End of Implementation Plan*
