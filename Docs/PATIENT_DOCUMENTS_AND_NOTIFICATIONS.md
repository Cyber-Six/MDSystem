# Patient Documents & Notifications — Implementation Plan

> **Date**: April 3, 2026  
> **Status**: Ready for Implementation  
> **Scope**: Prescription PDF → Patient Documents tab + Real-time notification  
> **Future**: Medical Certificate (same pattern)

---

## 1. Problem Statement

When staff issues a prescription (from health-chat or consultation), the PDF is:
- ✅ Saved to DB (`PatientDocuments` + `documentData` tables)
- ✅ Sent as a file attachment in health-chat (virtual only)
- ❌ **NOT visible** in the patient's "My Documents" tab → returns 404
- ❌ **NO notification** sent to patient about the new document

**Root Cause**: The `/documents` route is only mounted on the **staff server** (`staff.js`), not the **patient server** (`server.js`). The patient portal has a fully built "My Documents" page that calls `GET /documents/my`, but that endpoint is unreachable from the patient server.

---

## 2. Current Architecture

### What Already Works

| Component | File | Status |
|---|---|---|
| Document generation API | `Backend/routes/documents/documents.js` | ✅ `POST /:docType/generate` |
| Patient list endpoint | `documents.js` → `GET /my` | ✅ Code exists, `jwtProtect('patient')` |
| Patient download endpoint | `documents.js` → `GET /my/:documentId` | ✅ Code exists, `jwtProtect('patient')` |
| Staff document mount | `Backend/staff.js` | ✅ `app.use('/documents', documentRoutes)` |
| Patient "My Documents" page | `mds-patient/src/modules/my-documents/my-documents-page.jsx` | ✅ Full UI with view/download |
| Patient documents service | `mds-patient/src/services/documents-service.js` | ✅ `getMyDocuments()`, `downloadMyDocument()` |
| DB persistence | `PatientDocuments`, `documentTemplate`, `documentData` | ✅ Working |
| Notification infrastructure | Socket.IO + Redis queue + email + push | ✅ Working |
| Notification context (patient) | `mds-patient/src/modules/notification/notification-context.jsx` | ✅ EVENT_MAP pattern |

### What's Missing

| # | Gap | Impact | Fix |
|---|------|--------|-----|
| 1 | `/documents` not mounted in patient `server.js` | Patient portal gets 404 on `/documents/my` | Mount route in `server.js` |
| 2 | No `/documents` proxy in patient `vite.config.js` | Dev mode requests don't reach backend | Add proxy entry |
| 3 | No `document:new` socket event | Patient not notified when document issued | Emit after DB insert |
| 4 | No `document:new` handler in notification-context | Patient UI won't display notification | Add EVENT_MAP entry |

---

## 3. Data Flow

### Current Flow (Staff → DB only)
```
Staff issues prescription
  → POST /documents/prescription/generate (staff server)
    → Generate PDF → Save to PatientDocuments + documentData
    → Return { documentId }
  → (Optional) Download blob → Upload to media → Send as chat file
  ✅ PDF in DB
  ❌ Patient can't see it in My Documents
  ❌ No notification
```

### Target Flow (Staff → DB → Patient notified → Patient views)
```
Staff issues prescription
  → POST /documents/prescription/generate (staff server)
    → Generate PDF → Save to PatientDocuments + documentData
    → notifyUser(patientId, 'document:new', { documentId, type, ... })
      → Patient online? → Socket emit → real-time notification
      → Patient offline? → Redis queue → delivered on next login
    → Return { documentId }
  → (Optional) Send as chat file in health-chat

Patient opens portal
  → Notification bell shows "New Prescription Available"
  → Click → navigates to /my-documents
  → GET /documents/my (patient server)
    → Returns list of all documents
  → Click View/Download → GET /documents/my/:id
    → Returns PDF blob
```

---

## 4. Implementation Details

### 4.1 Backend: Mount documents route in patient server

**File**: `Backend/server.js`

```javascript
// Add import (after existing requires, ~line 21)
const documentRoutes = require('./routes/documents/documents.js');

// Mount BEFORE static file serve and catch-all (before ~line 100)
app.use('/documents', documentRoutes);
```

**Why this works**: `documents.js` already has patient-specific endpoints (`GET /my`, `GET /my/:documentId`) protected by `jwtProtect('patient')`. Staff-only endpoints (`POST /:docType/generate`, `GET /patient/:patientId`) use `jwtProtect('medical')` — they'll return 401 on the patient server since patients don't have medical tokens. Security is maintained.

---

### 4.2 Backend: Emit notification after document generation

**File**: `Backend/routes/documents/documents.js`

In the `POST /:docType/generate` handler, after the `documentData` INSERT succeeds:

```javascript
// Import at top of file
const { notifyUser } = require('../../config/sockets/socket-emitter.js');

// After documentData INSERT, before res.json():
try {
  const physicianName = enrichedData.physician?.firstName
    ? `${enrichedData.physician.firstName} ${enrichedData.physician.lastName}`.trim()
    : 'your healthcare provider';

  await notifyUser(
    String(actualPatientId),
    'document:new',
    {
      documentId,
      templateType: docType,
      issuedBy: physicianName,
      message: `A new ${template.displayName.toLowerCase()} has been issued for you by ${physicianName}.`,
    }
  );
} catch (notifErr) {
  // Non-critical — log but don't fail the document generation
  logger.warn('Document notification failed', { error: notifErr.message, documentId });
}
```

**Notification delivery** (handled by existing `notifyUser`):
- Patient online → Socket.IO emit to `user:{patientId}` room
- Patient offline → Queued in Redis (`notif:pending:{patientId}`, 7-day TTL)
- If push token exists → Expo push notification
- Email notification can be added later with `emailNotif` parameter

---

### 4.3 Frontend: Add proxy for patient dev server

**File**: `mds-patient/vite.config.js`

```javascript
// Add after the '/healthchat' proxy entry
'/documents': {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: BACKEND_URL.startsWith('https'),
},
```

**Note**: In production, the patient server serves the React app directly (`express.static`), so the proxy is only needed for development. Once `server.js` mounts the route, production works without proxy.

---

### 4.4 Frontend: Add document notification event handler

**File**: `mds-patient/src/modules/notification/notification-context.jsx`

Add to `EVENT_MAP`:

```javascript
'document:new': (data) => ({
  type: 'document',
  route: '/my-documents',
  title: 'New Document Available',
  message: data?.message || `A new ${data?.templateType || 'document'} has been issued for you.`,
}),
```

**Optional**: Add document type color in `top-bar.jsx` notification display. The existing color scheme can use the `document` type:
- Suggested icon color: Blue or teal (similar to existing document icon)

---

## 5. Database Schema (Existing — No Changes Needed)

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   PatientDocuments   │     │   documentTemplate   │     │   documentData   │
├──────────────────────┤     ├──────────────────────┤     ├──────────────────┤
│ id (PK)              │──┐  │ id (PK)              │     │ documentId (FK)  │
│ patientId (FK)       │  └──│ template (varchar)   │     │ data (text/b64)  │
│ templateId (FK) ─────│────>│ description          │     └──────────────────┘
│ issuedBy (FK→Users)  │     │ revisedDate          │            ▲
│ expired_at           │     │ createdBy            │            │
│ created_at           │     └──────────────────────┘     documentId = PatientDocuments.id
└──────────────────────┘
```

**No schema changes required.** The document generation already inserts into all three tables.

---

## 6. File Change Inventory

| # | File | Change | Lines |
|---|------|--------|-------|
| 1 | `Backend/server.js` | Mount `/documents` route | ~3 lines |
| 2 | `Backend/routes/documents/documents.js` | Import `notifyUser`, emit `document:new` after save | ~15 lines |
| 3 | `mds-patient/vite.config.js` | Add `/documents` proxy entry | ~5 lines |
| 4 | `mds-patient/src/modules/notification/notification-context.jsx` | Add `document:new` to EVENT_MAP | ~6 lines |

**Total**: ~29 lines across 4 files. No new files needed.

---

## 7. Security Considerations

- Patient endpoints use `jwtProtect('patient')` — only authenticated patients can access their own documents
- `GET /documents/my/:documentId` validates `patientId = req.user.id` — patients can only download their own documents
- Staff-only endpoints (`POST /:docType/generate`) use `jwtProtect('medical')` — will 401 on patient server
- Notification includes only minimal data (documentId, type, issuer name) — no sensitive medical content in socket payload
- PDF binary stays in DB — only served via authenticated download endpoint

---

## 8. Testing Checklist

- [ ] Staff generates prescription from health-chat → PDF saved to DB
- [ ] Patient sees notification bell badge increment (if online)
- [ ] Patient opens My Documents → sees prescription in list
- [ ] Patient clicks View → PDF opens in new tab
- [ ] Patient clicks Download → PDF downloads with proper filename
- [ ] Offline patient → logs in → receives pending notification
- [ ] Walk-in patient (no chat) → staff generates prescription → appears in My Documents
- [ ] Filter by document type works
- [ ] Multiple documents show in chronological order (newest first)

---

## 9. Future Expansion

| Feature | Implementation | Effort |
|---------|---------------|--------|
| Medical Certificate | Same `POST /documents/medical-certificate/generate` → same flow | Template already exists |
| Diagnosis Report | Same pattern, but `persistToDatabase = false` currently | Change to `true` in template |
| Email notification | Pass `emailNotif` param to `notifyUser()` | ~5 lines |
| Push notification | Add `document:new` to `eventToPushContent()` in `push-notification.js` | ~5 lines |
| Document expiry badge | Add "Expired" styling in `my-documents-page.jsx` | ~10 lines |
