# Medicine Requests & Notifications Analysis

## Overview
This document provides a thorough analysis of how medicine requests and notifications are handled across the MDSystem frontend applications (mds-patient and mds-staff).

---

## 1. PATIENT PORTAL (mds-patient) - Medicine Request Handling

### 1.1 Main Component
**File:** [mds-patient/src/modules/medicine-request/medicine-request-page.jsx](mds-patient/src/modules/medicine-request/medicine-request-page.jsx)

#### Key Functionality:
- **Fetch Available Medicines**: Queries `/medical-inventory/medicine-request/patient` endpoint
- **Request Submission**: Creates medicine requests with items, purpose, and location
- **Request History**: Fetches past requests via `getMedicineStatus` query
- **Branch/Location Logic**: 
  - Email prefix "m" → Access to multiple locations (Arlegui, Casal)
  - Email prefix "q" → Access to QuezonCity only (auto-assigned)

#### State Management:
```javascript
// User Info
const [userEmail, setUserEmail] = useState('');
const [emailPrefix, setEmailPrefix] = useState('');
const [assignedLocation, setAssignedLocation] = useState('');
const [allowedLocations, setAllowedLocations] = useState([]);

// Form State
const [formData, setFormData] = useState({
  purpose: '',
  location: '',
  items: [] // { itemCode, quantity }
});

// Notification State
const [notificationRequest, setNotificationRequest] = useState(null);
const [dismissedNotifications, setDismissedNotifications] = useState(() => {
  const saved = localStorage.getItem('dismissedMedicalNotifications');
  return saved ? JSON.parse(saved) : [];
});

// Data
const [requests, setRequests] = useState([]);
const [availableMedicines, setAvailableMedicines] = useState([]);
const [groupedMedicines, setGroupedMedicines] = useState({});
```

#### Key GraphQL Queries:

**1. Get Available Medicines:**
```graphql
query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
  getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
    id
    item_code
    item_name
    category
  }
}
```
- Endpoint: `/medical-inventory/medicine-request/patient`
- Medicine grouping by `item_code` for batch selection

**2. Get Request History:**
```graphql
query GetMedicineStatus {
  getMedicineStatus {
    id
    patientId
    status             # Pending, Approved, Rejected, Cancelled
    purpose
    notes
    approved_by
    created_at
    items {
      id
      medicineId
      requestId
      quantity
    }
  }
}
```

**3. Submit Medicine Request:**
```graphql
mutation CreateMedicineRequest($input: MedicineRequestInput!) {
  createMedicineRequest(input: $input) {
    id
    patientId
    status
    created_at
  }
}
```

---

## 2. PATIENT NOTIFICATIONS - Medicine Request Status

### 2.1 Notification Component
**File:** [mds-patient/src/modules/medicine-request/components/request-notification-modal.jsx](mds-patient/src/modules/medicine-request/components/request-notification-modal.jsx)

#### Notification Trigger Logic:
```javascript
// Check for notification-worthy requests (approved/rejected)
useEffect(() => {
  if (!requests || requests.length === 0) return;

  // Find first approved or rejected request that hasn't been dismissed
  const notificationReq = requests.find((r) => {
    const status = r.status?.toLowerCase();
    const isNotificationStatus = status === 'approved' || status === 'rejected';
    const isNotDismissed = !dismissedNotifications.includes(r.id);
    return isNotificationStatus && isNotDismissed;
  });

  setNotificationRequest(notificationReq || null);
}, [requests, dismissedNotifications]);
```

#### Persistent Dismissal:
- Uses `localStorage` key: `dismissedMedicalNotifications`
- Stores array of dismissed request IDs
- Prevents re-showing same notifications

#### Medicine Name Resolution:
The modal attempts to resolve medicine names in the following priority:
1. From `request.items[0].itemName` (direct property)
2. From `availableMedicines` list (API fetched)
3. From `batches` parameter (passed from parent)
4. From `groupedMedicines` (grouped by item_code)
5. Fallback: "Your medicine"

```javascript
// Look up logic
if (request.items?.[0]) {
  const firstItem = request.items[0];
  
  // Try availableMedicines
  const medicine = availableMedicines?.find((m) => 
    String(m.id) === String(batchId) || 
    String(m.id) === String(medicineId) ||
    String(m.batchId) === String(medicineId)
  );
  
  // Try batches
  const batch = batches?.find((b) => 
    String(b.id) === String(batchId) || 
    String(b.medicalItemId) === String(medicineId) ||
    String(b.id) === String(medicineId)
  );
  
  // Try groupedMedicines
  if (groupedMedicines && Object.values(groupedMedicines).length > 0) {
    const medicineGroup = Object.values(groupedMedicines).find(m =>
      m.batches?.some(b => 
        String(b.id) === String(medicineId) || 
        String(b.id) === String(batchId)
      )
    );
  }
}
```

#### Notification Modal Output:
- **Approved**: Green header, message: "Your medicine request for [medicine] has been approved. You may now proceed to the clinic to collect your medicine."
- **Rejected**: Red header, displays rejection reason/notes
- **Dismissible**: Shows "Got it" button that marks request as dismissed

---

## 3. STAFF PORTAL (mds-staff) - Medicine Request & Patient Info Display

### 3.1 Medical Inventory Main Component
**File:** [mds-staff/src/modules/medical-inventory/medical-inventory.jsx](mds-staff/src/modules/medical-inventory/medical-inventory.jsx)

#### Key Features:
- Loads all medicine requests via `fetchAllMedicineRequests()`
- Displays requests in dispense queue
- Allows filtering by patient ID
- Shows patient name as `Patient #${req.patientId}` (currently generic)

#### Patient Lookup:
```javascript
// Direct patient lookup by ID
const loadPatientMedicineRequests = async (patientId) => {
  if (!patientId) return;
  
  setIsFetchingPatientReqs(true);
  try {
    const rawRequests = await fetchPatientMedicineRequests(String(patientId));
    // Enrich with generic patient name
    const enriched = rawRequests.map(req => ({
      ...req,
      patientName: `Patient #${req.patientId}`,
    }));
    setRequests(enriched);
  } catch (error) {
    // ... error handling
  }
};
```

### 3.2 Dispense Queue Component
**File:** [mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx)

#### Display Logic:
- Shows all medicine requests in a table format
- Columns: ID, Patient, Item, Qty, Purpose, Type, Date, Status, Notes, Approved By, Actions
- Filters by:
  - Location (Casal, Arlegui, QuezonCity)
  - Status (Pending, Approved, Completed, Rejected, Cancelled)
  - Search term (patient name, request ID, medicine name)

#### Current Patient Name Display:
```javascript
// In dispense-queue.jsx - Line 70+
<td className="px-3 py-1.5">
  <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">
    {req.patientName}
  </p>
  {req.patientId && (
    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">
      ID: {req.patientId}
    </p>
  )}
</td>
```

**Current Issue:** `req.patientName` is hardcoded as `Patient #${req.patientId}` with no actual patient name lookup

### 3.3 Request Action Modal (Approve/Reject)
**File:** [mds-staff/src/modules/medical-inventory/components/dispense-queue/request-action-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/request-action-modal.jsx)

#### Functionality:
- Modal for approving or rejecting pending requests
- Collect optional notes/rejection reason
- Display request ID, date created, purpose, medicines
- Shows medicine items with quantities

#### Request Info Display:
```javascript
/* Request Info */
<div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-3">
  /* Request ID */
  <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300">
    #{request.id}
  </p>
  
  /* Date Created */
  <p className="text-xs text-secondary-600 dark:text-neutral-400">
    {formatDate(request.created_at)}
  </p>
  
  /* Purpose */
  {request.purpose && (
    <p className="text-xs text-secondary-600 dark:text-neutral-400 break-words whitespace-pre-wrap">
      {request.purpose}
    </p>
  )}
  
  /* Medicines */
  {request.items?.length > 0 && (
    request.items.map((item, idx) => (
      <div key={idx} className="flex items-start justify-between text-xs">
        <span className="text-secondary-600 dark:text-neutral-300 font-medium">
          {item.itemName || `Medicine #${item.medicineId || item.batchId}`}
        </span>
        <span className="text-secondary-500 dark:text-neutral-400">
          {item.quantity} unit{item.quantity > 1 ? 's' : ''}
        </span>
      </div>
    ))
  )}
</div>
```

### 3.4 Dispense Medicine Modal
**File:** [mds-staff/src/modules/medical-inventory/components/dispense-medicine/dispense-medicine-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-medicine/dispense-medicine-modal.jsx)

#### Parameters:
```javascript
const DispenseMedicineModal = ({ patientId, patientName, onClose, onSuccess })
```

#### Patient Info Display:
```javascript
<div>
  <h2 className="text-sm font-bold text-secondary-900 dark:text-white">
    Dispense Medicine
  </h2>
  <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">
    Issue medicine to <span className="font-medium">{patientName}</span>
  </p>
</div>
```

**Current Usage:** Called with:
```javascript
openDispenseMedicine(patientId, patientName)
// Example: openDispenseMedicine(123, `Patient #${patientId}`)
```

---

## 4. MEDICINE REQUEST SERVICE (Staff-Side)
**File:** [mds-staff/src/modules/medical-inventory/medicine-request-service.jsx](mds-staff/src/modules/medical-inventory/medicine-request-service.jsx)

Endpoint: `POST /medical-inventory/medicine-request/medical` (JWT guard: medical)

### Key Functions:

#### 4.1 Fetch All Medicine Requests
```javascript
export const fetchAllMedicineRequests = async (status = null, offset = 0, limit = 50) => {
  // status: 'Pending', 'Approved', 'Rejected', 'Cancelled'
  // Returns: MedicineRequest[]
  // Fields: id, patientId, status, purpose, notes, approved_by, location, created_at, items[]
}
```

#### 4.2 Fetch Patient-Specific Requests
```javascript
export const fetchPatientMedicineRequests = async (patientId, offset = 0, limit = 50) => {
  // Returns requests for a specific patient
}
```

#### 4.3 Fetch Single Request
```javascript
export const fetchMedicineRequestById = async (requestId) => {
  // Returns full request details
}
```

#### 4.4 Update Request Status
```javascript
export const setMedicineRequestStatus = async (requestId, status, notes = null) => {
  // status: 'Approved', 'Rejected', 'Cancelled'
  // notes: optional reason/notes
  // Returns: Updated MedicineRequest
}
```

---

## 5. PATIENT DATA LOOKUP - Search Patient Service
**File:** [mds-staff/src/services/patient-search-service.js](mds-staff/src/services/patient-search-service.js)

### Patient Search Query
```graphql
query SearchPatients($searchTerm: String!, $limit: Int) {
  searchPatients(searchTerm: $searchTerm, limit: $limit) {
    id
    identifier
    branch
    sex
    first_name
    last_name
    middle_name
    suffix
    profile_type
    program
    year
    department
    role
    latest_ticket_id
    latest_status
    latest_scope
    latest_updated_at
  }
}
```

### Patient Name Formatting Function
```javascript
export function formatPatientName(patient) {
  if (!patient.last_name && !patient.first_name) return 'Unknown';
  if (!patient.last_name) return patient.first_name;
  return `${patient.last_name}, ${patient.first_name}${
    patient.middle_name ? ' ' + patient.middle_name[0] + '.' : ''
  }${patient.suffix ? ' ' + patient.suffix : ''}`;
}
```

**Format:** "Last, First M. Suffix" (e.g., "Doe, John A. Jr.")

### Patient Initials Function
```javascript
export function getPatientInitials(patient) {
  const f = patient.first_name?.[0] || '';
  const l = patient.last_name?.[0] || '';
  return (f + l).toUpperCase() || '?';
}
```

---

## 6. SEARCH PATIENT MODULE - Medicine Requests Tab
**File:** [mds-staff/src/modules/search-patient/components/medicine-requests-tab.jsx](mds-staff/src/modules/search-patient/components/medicine-requests-tab.jsx)

### Integration with Patient Profile
- Shows patient's medicine request history
- Filters by status: All, Pending, Dispensed, Cancelled, Rejected
- Displays per request:
  - Medicine name
  - Quantity
  - Request ID
  - Date
  - Prescribed by (doctor name)
  - Dispensed date (if applicable)

### Data Structure
```javascript
const requests = patient.history.medicineRequests || [];

// Each request has:
{
  medicine: string,        // Medicine name
  quantity: number,
  status: string,          // Pending, Dispensed, Cancelled, Rejected
  id: string,
  date: string,
  reason: string,          // Medical purpose
  prescribedBy: string,    // Doctor/staff name
  dispensedDate: string    // Optional
}
```

---

## 7. PATIENT TABS CONTEXT - Staff Portal Patient Management
**File:** [mds-staff/src/context/patient-tabs-context.jsx](mds-staff/src/context/patient-tabs-context.jsx)

### Tab Management
```javascript
const openTab = useCallback((patient, section) => {
  const tabId = `${patient.id}-${section}`;
  // Creates tab with:
  {
    id: tabId,
    patientId: String(patient.id),
    patientName: formatPatientName(patient),  // Uses search service function
    section,
    label: SECTION_LABELS[section]
  }
}, []);
```

**Available Sections:** personal, medical, dental, appointments, history, obgyne, medicines, documents

---

## 8. CURRENT GAPS & OBSERVATIONS

### 8.1 Patient Name Display Issues

**Problem:** Staff-side medical inventory module doesn't use actual patient names
- Current: `Patient #${req.patientId}`
- Should: Use `formatPatientName()` with patient data

**Locations:**
- [mds-staff/src/modules/medical-inventory/medical-inventory.jsx](mds-staff/src/modules/medical-inventory/medical-inventory.jsx#L389)
- [mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx#L70)

### 8.2 Patient Lookup Missing from Medicine Request Service
- `fetchPatientMedicineRequests()` and `fetchAllMedicineRequests()` return only:
  - `id, patientId, status, purpose, notes, approved_by, location, created_at, items[]`
- No `patient.first_name`, `patient.last_name` included in response
- Would need backend API change to return patient details

### 8.3 Medicine Request GraphQL Schema
- Backend schema doesn't expose patient name in MedicineRequest type
- Must either:
  1. Fetch patient separately after getting request
  2. Update backend to include patient data in response
  3. Cache patient data mapping

### 8.4 Notification System
- Patient-side notifications work well with localStorage persistence
- No staff-side notifications for request status changes
- No real-time update mechanism for new medicine requests

---

## 9. DATA FLOW DIAGRAMS

### Patient Side: Medicine Request Flow
```
Patient Portal (mds-patient)
    ↓
medicine-request-page.jsx
    ├─ Fetch: getAvailableMedicine (endpoint: /medical-inventory/medicine-request/patient)
    ├─ Display: Available medicines grouped by item_code
    ├─ Submit: createMedicineRequest mutation
    ├─ Fetch: getMedicineStatus (request history)
    └─ Notify: RequestNotificationModal (localStorage dismissed tracking)
         ├─ Detects approved/rejected requests
         └─ Shows modal with medicine name resolution logic
```

### Staff Side: Request Processing Flow
```
Staff Portal (mds-staff)
    ↓
medical-inventory.jsx
    ├─ Fetch: fetchAllMedicineRequests() or fetchPatientMedicineRequests(patientId)
    │   └─ Endpoint: /medical-inventory/medicine-request/medical
    │
    ├─ Component: dispense-queue.jsx
    │   ├─ Table display of requests (with hardcoded patient names)
    │   ├─ Search/filter by status and location
    │   └─ Actions: Approve, Reject, Dispense (for approved requests)
    │
    ├─ Modal: request-action-modal.jsx (Approve/Reject)
    │   ├─ Calls: setMedicineRequestStatus(requestId, status, notes)
    │   └─ Updates request in database
    │
    └─ Modal: dispense-medicine-modal.jsx (Dispense)
        └─ Calls: issuePrescription(patientId, items, notes)
            └─ Creates medicine transaction
```

### Notification Flow (Patient)
```
Patient submits request
    ↓
Backend stores in MedicineRequest table
    ↓
Staff approves/rejects (setMedicineRequestStatus)
    ↓
Patient side: getMedicineStatus query fetches updated request
    ↓
React effect detects status = approved/rejected
    ↓
Check if notification ID in dismissedNotifications
    ↓
If not dismissed: show RequestNotificationModal
    ↓
User dismisses: add to localStorage
    ↓
Request ID saved in dismissedMedicalNotifications
```

---

## 10. KEY FILES SUMMARY

### Patient Portal
| File | Purpose |
|------|---------|
| [medicine-request-page.jsx](mds-patient/src/modules/medicine-request/medicine-request-page.jsx) | Main page for creating/viewing medicine requests |
| [request-notification-modal.jsx](mds-patient/src/modules/medicine-request/components/request-notification-modal.jsx) | Notification modal for approved/rejected requests |
| [graphql-client.js](mds-patient/src/utils/graphql-client.js) | GraphQL request utility |
| [emr-service.js](mds-patient/src/services/emr-service.js) | EMR-related queries/mutations |

### Staff Portal
| File | Purpose |
|------|---------|
| [medical-inventory.jsx](mds-staff/src/modules/medical-inventory/medical-inventory.jsx) | Main inventory & request management page |
| [medicine-request-service.jsx](mds-staff/src/modules/medical-inventory/medicine-request-service.jsx) | GraphQL service for medicine requests |
| [dispense-queue.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx) | Request queue display & filtering |
| [request-action-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-queue/request-action-modal.jsx) | Approve/reject modal |
| [dispense-medicine-modal.jsx](mds-staff/src/modules/medical-inventory/components/dispense-medicine/dispense-medicine-modal.jsx) | Dispense medicine modal |
| [medicine-requests-tab.jsx](mds-staff/src/modules/search-patient/components/medicine-requests-tab.jsx) | Patient profile medicine requests display |
| [patient-search-service.js](mds-staff/src/services/patient-search-service.js) | Patient search & name formatting |
| [patient-tabs-context.jsx](mds-staff/src/context/patient-tabs-context.jsx) | Patient tab management context |

---

## 11. RECOMMENDATIONS FOR IMPROVEMENT

### 1. **Implement Patient Name Lookup**
   - Update `fetchAllMedicineRequests()` and `fetchPatientMedicineRequests()` to return patient names
   - Alternative: Cache patient data mapping in staff portal
   - Use existing `formatPatientName()` function for consistent formatting

### 2. **Real-Time Notifications**
   - Implement WebSocket connection for live request status updates
   - Add staff-side notifications for new medicine requests
   - Add patient-side notifications via push notifications or email

### 3. **Request Status History**
   - Track approval/rejection timestamps in database
   - Display approval timeline in UI
   - Show who approved/rejected each request

### 4. **Medicine Name Resolution in Requests**
   - Include `item_name` directly in MedicineRequest.items response
   - Reduces need for multiple lookups and complex resolution logic

### 5. **Search/Filter Enhancements**
   - Add filters by patient ID directly in dispense-queue
   - Add date range filters for requests
   - Add approved by/staff member filter

### 6. **Audit Trail**
   - Log all request status changes with timestamps and user info
   - Display in both patient and staff views
   - Archive old requests properly

---

## 12. APPENDIX - GraphQL Endpoints Used

### Patient Side
- **Endpoint:** `/medical-inventory/medicine-request/patient`
- **Queries:** getAvailableMedicine, getMedicineStatus
- **Mutations:** createMedicineRequest

### Staff Side
- **Endpoint:** `/medical-inventory/medicine-request/medical`
- **Queries:** getMedicineRequests, getAllMedicineRequests, getMedicineRequestById
- **Mutations:** setStatusMedicineRequest

### Patient Search
- **Endpoint:** `/emr/medical`
- **Query:** searchPatients

---

**Document Generated:** March 27, 2026
**Analysis Coverage:** mds-patient v1.0, mds-staff v1.0
**Status:** Complete
