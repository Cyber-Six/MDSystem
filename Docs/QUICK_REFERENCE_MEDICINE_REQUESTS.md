# Quick Reference: Medicine Requests & Notifications

## Main Components Checklist

### ✅ PATIENT PORTAL (mds-patient)

**Medicine Request Creation & Display:**
- [medicine-request-page.jsx](mds-patient/src/modules/medicine-request/medicine-request-page.jsx) — Main request page
  - Fetches available medicines from `/medical-inventory/medicine-request/patient`
  - Manages form state (purpose, location, items)
  - Submits requests via `createMedicineRequest` mutation
  - Fetches history via `getMedicineStatus` query

**Notifications:**
- [request-notification-modal.jsx](mds-patient/src/modules/medicine-request/components/request-notification-modal.jsx) — Notification display
  - Triggers on approved/rejected requests
  - Persists dismissed notifications in `localStorage` under key: `dismissedMedicalNotifications`
  - Resolves medicine names via 4-tier lookup (itemName → availableMedicines → batches → groupedMedicines)
  - No actual patient name to show (patient sees their own requests)

**Utilities:**
- [graphql-client.js](mds-patient/src/utils/graphql-client.js) — GraphQL request wrapper
- [emr-service.js](mds-patient/src/services/emr-service.js) — EMR-related queries

---

### ✅ STAFF PORTAL (mds-staff)

**Medicine Request Management:**
- [medical-inventory.jsx](mds-staff/src/modules/medical-inventory/medical-inventory.jsx) — Main page
  - Loads requests via `fetchAllMedicineRequests()` or patient lookup
  - **ISSUE:** Uses placeholder patient names: `Patient #${req.patientId}`
  - Manages modals for approve/reject/dispense actions

**Request Display & Processing:**
- [dispense-queue.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx) — Request table
  - Shows: ID, Patient ⚠️ (placeholder name), Item, Qty, Purpose, Status, Actions
  - Filters by: Location, Status, Search term
  - Table columns: 11 total including patient name field
  - **CRITICAL:** `req.patientName` hardcoded as `Patient #${req.patientId}`

**Request Status Updates:**
- [request-action-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/request-action-modal.jsx) — Approve/Reject modal
  - Shows request details (ID, date, purpose, medicines)
  - Collects notes/rejection reason
  - Calls: `setMedicineRequestStatus(requestId, status, notes)`

**Dispense Operation:**
- [dispense-medicine-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-medicine/dispense-medicine-modal.jsx) — Dispense modal
  - Requires: `patientId`, `patientName` props
  - Currently receives: `Patient #${patientId}` placeholder
  - Fetches available medicines and creates prescription

**Services:**
- [medicine-request-service.jsx](mds-staff/src/modules/medical-inventory/medicine-request-service.jsx) — GraphQL service
  - Functions: `fetchAllMedicineRequests()`, `fetchPatientMedicineRequests()`, `setMedicineRequestStatus()`
  - Endpoint: `/medical-inventory/medicine-request/medical`
  - **Issue:** Returns only `{id, patientId, status, purpose, notes, approved_by, location, created_at, items[]}`
  - No patient name/details included in response

**Patient Data Integration:**
- [patient-search-service.js](mds-staff/src/services/patient-search-service.js) — Patient lookup service
  - Function: `formatPatientName(patient)` — Formats as "Last, First M. Suffix"
  - Function: `getPatientInitials(patient)` — Gets initials for avatars
  - Query: searchPatients via `/emr/medical` endpoint
  - Returns: first_name, last_name, middle_name, suffix + profile info

- [medicine-requests-tab.jsx](mds-staff/src/modules/search-patient/components/medicine-requests-tab.jsx) — Patient profile medicine requests
  - Displays requests from `patient.history.medicineRequests`
  - Filters by status
  - Uses actual patient data from patient object

- [patient-tabs-context.jsx](mds-staff/src/context/patient-tabs-context.jsx) — Tab management
  - Uses `formatPatientName()` when opening patient tabs
  - Maintains patient name properly in context

---

## Data Flow Summary

### How Requests Are Fetched

**Patient Creates Request:**
1. Patient portal: Submit via `createMedicineRequest` mutation
2. Backend stores in MedicineRequest table
3. Sets status: "Pending"

**Staff Views Requests:**
1. Staff portal: Calls `fetchAllMedicineRequests()` or `fetchPatientMedicineRequests(patientId)`
2. Backend returns: `[{id, patientId, status, purpose, notes, approved_by, location, created_at, items[]}]`
3. **No patient.first_name/last_name included** ⚠️
4. Frontend hardcodes: `patientName = Patient #${patientId}`

**Staff Approves/Rejects:**
1. Modal shows request details with hardcoded patient name
2. Staff submits via: `setMedicineRequestStatus(requestId, status, notes)`
3. Backend updates MedicineRequest status

**Patient Receives Notification:**
1. Patient portal polls: `getMedicineStatus` query
2. Finds request with status: "Approved" or "Rejected"
3. Shows modal if request ID not in `dismissedMedicalNotifications`
4. Modal displays medicine name (via 4-tier lookup)

---

## Patient Name Mapping

### ⚠️ CURRENT GAP: No patient name in medicine requests display

**Available Patient Name Function:**
```javascript
// In mds-staff/src/services/patient-search-service.js
export function formatPatientName(patient) {
  if (!patient.last_name && !patient.first_name) return 'Unknown';
  if (!patient.last_name) return patient.first_name;
  return `${patient.last_name}, ${patient.first_name}${
    patient.middle_name ? ' ' + patient.middle_name[0] + '.' : ''
  }${patient.suffix ? ' ' + patient.suffix : ''}`;
}
```

**Usage Context:**
- ✅ Used in: search-results-list.jsx, patient-tabs-context.jsx, health-chat modules
- ❌ NOT used in: dispense-queue.jsx, medical-inventory.jsx
- ❌ Patient data NOT available: medicine-request-service.jsx results

**Proposed Solutions:**

1. **Backend Change:** Include patient name in medical request response
   ```graphql
   getMedicineRequests(patientId: $patientId) {
     id
     patientId
     patient {
       first_name
       last_name
       middle_name
       suffix
     }
     status
     # ... rest
   }
   ```

2. **Cache Patient Mapping:** Query patients once, store ID→name map
   ```javascript
   const patientNames = {}; // Cache
   requests.forEach(req => {
     req.patientName = patientNames[req.patientId] || `Patient #${req.patientId}`;
   });
   ```

3. **Separate Patient Lookup:** Batch fetch patient details after requests
   ```javascript
   const patientIds = requests.map(r => r.patientId);
   const patients = await searchPatients(patientIds);
   // Map onto requests
   ```

---

## Notification System Details

### Patient-Side Notifications

**Where Notifications Live:**
- Component: RequestNotificationModal
- Trigger: Any request with status "Approved" or "Rejected"
- Persistence: localStorage key = `dismissedMedicalNotifications`

**Notification Detection Logic:**
```javascript
// On every request list change
useEffect(() => {
  const notificationReq = requests.find((r) => {
    const status = r.status?.toLowerCase();
    const isNotificationStatus = status === 'approved' || status === 'rejected';
    const isNotDismissed = !dismissedNotifications.includes(r.id);
    return isNotificationStatus && isNotDismissed;
  });
  setNotificationRequest(notificationReq || null);
}, [requests, dismissedNotifications]);
```

**Medicine Name Resolution Priority:**
1. `request.items[0].itemName` — Direct property
2. `availableMedicines.find(m => m.id === batchId)` — API list
3. `batches.find(b => b.id === batchId)` — Passed parameter
4. `groupedMedicines` — Grouped by item_code
5. Fallback: "Your medicine"

**Dismissal Mechanism:**
- User clicks "Got it" button → `handleDismissNotification()`
- Adds `notificationRequest.id` to `dismissedNotifications` array
- Updates localStorage immediately
- Won't show same notification again

**Multi-Request Behavior:**
- Only shows ONE notification at a time (first approved/rejected)
- User must dismiss to see next notification
- Good UX but slightly asynchronous

---

## Missing Features / Current Limitations

| Issue | Location | Impact | Priority |
|-------|----------|--------|----------|
| No patient names in medicine requests | dispense-queue.jsx, medicine-request-service.jsx | Staff sees only ID | 🔴 High |
| No real-time request notifications | Staff-side | Staff must refresh | 🟡 Medium |
| No notification for new requests | Patient-side | No indication of status change | 🟡 Medium |
| Medicine name lookup is fragile | request-notification-modal.jsx | May show "Your medicine" | 🟡 Medium |
| No request status history | All | Can't see approval timeline | 🟠 Low |
| No email/push notifications | All | Staff alone, Patient unaware | 🟠 Low |

---

## File Paths Quick Lookup

### Patient Portal Files
```
mds-patient/
  src/
    modules/medicine-request/
      ├─ medicine-request-page.jsx ✅
      └─ components/request-notification-modal.jsx ✅
    utils/
      └─ graphql-client.js
    services/
      └─ emr-service.js
```

### Staff Portal Files
```
mds-staff/
  src/
    modules/
      ├─ medical-inventory/
      │  ├─ medical-inventory.jsx ⚠️ (placeholder patient names)
      │  ├─ medicine-request-service.jsx ⚠️ (no patient data)
      │  └─ components/
      │     ├─ dispense-queue/
      │     │  ├─ dispense-queue.jsx ⚠️ (displays placeholder name)
      │     │  └─ request-action-modal.jsx
      │     └─ dispense-medicine/
      │        └─ dispense-medicine-modal.jsx
      ├─ search-patient/
      │  └─ components/medicine-requests-tab.jsx ✅ (correct names)
      └─ pending-requests/
         ├─ initial-record-service.js
         └─ patient-record-service.js
    services/
      └─ patient-search-service.js ✅ (has formatPatientName)
    context/
      └─ patient-tabs-context.jsx ✅ (uses formatPatientName)
```

---

## Endpoint Reference

```
Patient Side:
  POST /medical-inventory/medicine-request/patient
    - getAvailableMedicine(location, offset, limit)
    - getMedicineStatus()
    - createMedicineRequest(input)

Staff Side:
  POST /medical-inventory/medicine-request/medical
    - getAllMedicineRequests(status, offset, limit)
    - getMedicineRequests(patientId, offset, limit)
    - getMedicineRequestById(requestId)
    - setStatusMedicineRequest(requestId, status, notes)

Search/Patient Data:
  POST /emr/medical
    - searchPatients(searchTerm, limit)

Other:
  POST /profile/medical (for profile updates)
  POST /profile/patient (for patient profile)
```

---

**Last Updated:** 2026-03-27
**Status:** Ready for implementation improvements
