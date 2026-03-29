# Prescription PDF Generation — Implementation Changelog

> **Date**: March 29, 2026  
> **Status**: Phase 1 Complete — PDF generation from health-chat

---

## Summary of Changes

### Architecture Decision

**Direct HTML → PDF** via WeasyPrint (not DOCX → PDF via LibreOffice).  
- ~1-2s generation time on RPi 5 vs ~3-5s with DOCX+LibreOffice
- Template matches the TIP physical prescription pad layout
- Filename convention: `<lastname>_prescription.pdf`

---

## Files Created

### 1. `Backend/services/docx-generation/models/prescription.py`
Pydantic models for the prescription endpoint:
- `PrescriptionMedication` — name, dosage, frequency, duration, quantity, instructions
- `PrescriptionRequest` — patient_name, patient_age, patient_sex, date, medications[], notes, doctor_name, license_no, ptr_no, filename

### 2. `Backend/services/docx-generation/templates/prescription/prescription.html`
Jinja2 HTML template matching the TIP prescription pad:
- A5 page size (148mm × 210mm)
- TIP logo (base64-embedded) + institution header
- "MEDICAL – DENTAL SERVICES" department line
- Rx symbol, date, patient info (Name, Age, Sex)
- Medications table with `{% for med in medications %}` loop
- Notes section
- Signature block with M.D./DMD, License No., PTR No.

### 3. `Backend/services/docx-generation/routes/prescription.py`
FastAPI route:
- `POST /prescription/generate` — renders HTML template → PDF via WeasyPrint
- Caches TIP logo base64 at startup
- Uses `sanitize_filename()` for safe Content-Disposition header

### 4. `Backend/services/docx-generation/assets/tip_logo.jpg`
Copy of `mds-staff/src/assets/tip_logoo.jpg` for server-side embedding.

---

## Files Modified

### 5. `Backend/services/docx-generation/main.py`
```python
+ from routes.prescription import router as prescription_router
+ app.include_router(prescription_router)
```

### 6. `Backend/routes/documents/documents.js`
Added `POST /documents/prescription` orchestrator route:
- Validates required fields (patient_name, medications)
- Fetches doctor name from `"UsersPersonal"` table using JWT-authenticated user
- Fetches license_no/ptr_no from `"MedicalPersonnel"` table (LEFT JOIN — returns empty if columns don't exist yet)
- Generates today's date, builds `<lastname>_prescription` filename
- Forwards to FastAPI `POST /prescription/generate`
- Returns PDF to client

### 7. `mds-staff/src/modules/health-chat/prescription-service.js`
Added `generatePrescriptionPdf(data)` — sends POST to `/documents/prescription` with `responseType: 'blob'`.  
Existing `getAvailableMedicine()` and `issuePrescription()` kept for backward compatibility.

### 8. `mds-staff/src/modules/health-chat/components/PrescriptionModal.jsx`
**Full rewrite** from inventory-based catalogue to free-text entry form:
- **Patient info section**: Name (pre-filled from chat), Age, Sex (editable fields)
- **Medication entries**: Free-text rows with name, dosage, frequency (dropdown with medical abbreviations), duration, quantity, instructions
- **Notes** textarea
- **Submit**: Calls `generatePrescriptionPdf()` → receives PDF blob → auto-sends as file message in active chat
- **Success screen**: Shows "Prescription Generated" with download link + "Done" button
- No inventory dependency — staff can prescribe any medicine

### 9. `mds-staff/src/modules/health-chat/components/message-input.jsx`
- **Fixed `isActive` temporal dead zone bug**: Moved `const isActive = selectedTicket?.status === 'Ongoing'` before its first use at `canSend`
- **Updated PrescriptionModal props**: Passes `patientName` (from `selectedTicket.patient.firstName + lastName`), `activeTicketId`, `sendMessage`

---

## Data Flow (End-to-End)

```
Staff clicks "Issue Prescription" (Pill icon in chat input)
  ↓
PrescriptionModal opens — patient name pre-filled from chat context
  ↓
Staff enters: medications (free-text), dosage, frequency, etc.
  ↓
"Generate Prescription" button clicked
  ↓
Frontend: POST /documents/prescription { patient_name, medications, ... }
  ↓
Node.js documents.js:
  1. Validates required fields
  2. Fetches doctor info from DB (name, license_no, ptr_no)
  3. Forwards to FastAPI: POST /prescription/generate
  ↓
FastAPI prescription.py:
  1. Renders prescription.html with Jinja2
  2. Converts HTML → PDF with WeasyPrint
  3. Returns PDF bytes
  ↓
Frontend receives PDF blob
  ↓
Auto-send: Upload blob as file → POST /media/stage/ → fileId
  → sendMessage(ticketId, null, fileId, 'file')
  → Backend promotes file → emits socket → patient sees PDF in chat
  ↓
Success screen: "Prescription Generated" + Download PDF link
```

---

## Pending Backend Changes (Future)

### Database Migration Needed

The `"MedicalPersonnel"` table currently has: `id, role, title, designation, is_active`.  
To display doctor credentials on prescriptions, add:

```sql
ALTER TABLE "MedicalPersonnel"
  ADD COLUMN IF NOT EXISTS license_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ptr_no VARCHAR(50);
```

Until this migration runs, prescriptions will generate with **empty** License No. and PTR No. fields.

## Phase 2 — Side Panel, Pre-fill, Consultation Integration (March 29, 2026)

### Prescription Panel (Side Panel Redesign)

`PrescriptionModal.jsx` has been rewritten as **`PrescriptionPanel`** — a 380px right-side panel that
renders alongside the chat messages (Facebook-style), so staff can see the conversation while writing prescriptions.

**Layout change:**
- `ChatPanel` now wraps content in a horizontal flex: `[chat column (flex-1)] [PrescriptionPanel (380px)]`
- State `showPrescription` lifted from `message-input.jsx` into `chat-panel.jsx`
- `MessageInput` receives `onOpenPrescription` callback prop (no longer manages modal state)
- Panel auto-closes when patient/chat selection changes

### Patient Age/Sex Pre-fill

**Backend changes (GraphQL):**
- `Backend/routes/health-chat/schema.graphql` — Added `dateOfBirth: String` and `sex: String` to `ChatParticipant` type
- `Backend/routes/health-chat/resolvers/wrapper/helper.js` — `getParticipantInfo()` now SELECTs `up.date_of_birth, up.sex` from `"UsersPersonal"`
- `mds-staff/src/modules/health-chat/health-chat-service.js` — All 6 patient GraphQL fragments updated with `dateOfBirth` and `sex` fields

**Frontend:**
- `PrescriptionPanel` receives `patientDob` and `patientSex` props from `ChatPanel`
- Age is auto-calculated from `dateOfBirth` using `calcAge()` helper
- Sex is pre-filled from `selectedTicket.patient.sex`
- Both fields remain editable

> **Note:** Backend must be deployed for pre-fill to work. Until then, fields are editable but empty.

### Consultation Record on Prescription

`Backend/routes/documents/documents.js` — `POST /documents/prescription` now also:
1. Accepts optional `patient_id` in the request body
2. Creates a `Consultation` record (mode: Virtual, type: Medical, status: Completed)
3. Creates a `ConsultationOutcome` with treatment text derived from medications
4. Creates `ConsultationTreatment` entries (one per medication, as formatted text strings)

This means every prescription issued through health-chat is recorded in the patient's consultation history
and will appear alongside onsite consultations.

The consultation creation is **non-blocking** — if it fails, the PDF still generates and sends.

---

### Future: "Issue Prescription" Tab in Patient Search

A standalone prescription form (not requiring an active chat) that:
1. Allows searching/selecting any patient
2. Opens the same PrescriptionModal (reusable component)
3. Generates the PDF and saves it to patient records

### Future: Consultation Integration (Enhanced)

Link the created consultation to the health-chat ticket ID for full traceability.
Add ConsultationDiagnosis entries if staff provides diagnosis in the prescription form.

---

## Frequency Options (PrescriptionModal)

| Abbreviation | Meaning |
|---|---|
| OD | Once daily |
| BID | Twice daily |
| TID | Three times daily |
| QID | Four times daily |
| q4h | Every 4 hours |
| q6h | Every 6 hours |
| q8h | Every 8 hours |
| q12h | Every 12 hours |
| PRN | As needed |
| STAT | Immediately |
| HS | At bedtime |
| AC | Before meals |
| PC | After meals |
