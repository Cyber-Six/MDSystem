# Search Patient Module Refactoring & Reusability Plan

**Project Goal:** Move `SearchPatient` from `src/pages/` to `src/modules/staff/`, enhance it to support searching by Student/Employee ID, Name, and Email, and create a reusable patient search service for use across other modules (e.g., Appointment scheduling).

**Start Date:** March 15, 2026  
**Status:** In Progress

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase Timeline](#phase-timeline)
3. [Detailed Implementation Steps](#detailed-implementation-steps)
4. [File Structure](#file-structure)
5. [Service Layer Design](#service-layer-design)
6. [Component Hierarchy](#component-hierarchy)
7. [Integration Points](#integration-points)
8. [Test Strategy](#test-strategy)
9. [Verification Checklist](#verification-checklist)

---

## Architecture Overview

### Current State
- `SearchPatient` component lives in `src/pages/SearchPatient.jsx`
- Routed via `src/pages/Dashboard.jsx`
- GraphQL query hardcoded in component
- Search logic tightly coupled to UI
- Appointment module uses separate `patient-lookup.jsx` with ID-only search

### Target State
- `SearchPatient` moved to `src/modules/staff/search-patient/`
- Reusable `patient-search.service.js` in `src/services/`
- Modular component structure with record tabs & modal viewers
- Unified search supporting ID/name/email
- Appointment module uses new service (with fallback to ID-only)
- Test cases & documentation in `TEST-CASES.md`

### Diagram
```
User Interface Layer
├── src/pages/Dashboard.jsx (routing)
└── src/modules/staff/search-patient/
    ├── search-patient.jsx (main component)
    └── components/
        ├── search-results.jsx
        ├── patient-detail-panel.jsx
        ├── record-viewer-modal.jsx
        ├── medical-record-detail.jsx
        ├── dental-record-detail.jsx
        └── appointment-record-detail.jsx

Service/Business Logic Layer
├── src/services/patient-search.service.js
├── src/services/patient-records.service.js
└── src/services/patient-search.adapter.js

Integration Points
├── src/modules/appointment/components/patient-lookup.jsx
└── src/modules/appointment/staff-appointment-service.js
```

---

## Phase Timeline

| Phase | Tasks | Dependencies | Estimated Files |
|-------|-------|--------------|-----------------|
| **Phase 1** | Create reusable services | Backend `/emr/medical` available | 3 files |
| **Phase 2** | Build SearchPatient refactored UI | Phase 1 complete | 7 files |
| **Phase 3** | Update routing & imports | Phase 2 complete | 1 file (Dashboard.jsx) |
| **Phase 4** | Integrate with Appointment module | Phase 1-3 complete | 1 file (patient-lookup.jsx) |
| **Phase 5** | Testing & documentation | Phases 1-4 complete | 1 file (TEST-CASES.md) |

---

## Detailed Implementation Steps

### Phase 1: Create Reusable Services

#### Step 1.1: Create `src/services/patient-search.service.js`

**Purpose:** Core patient search service supporting multiple search methods (ID, name, email).

**Function Signature:**
```javascript
/**
 * Unified patient search supporting ID, name, and email
 * @param {string} searchTerm - Search input (ID, name, or email)
 * @param {number} limit - Max results (default: 15)
 * @returns {Promise<Array>} Array of PatientSearchResult objects
 */
export const searchPatients = async (searchTerm, limit = 15) => { }

/**
 * Get patient's basic info by user ID
 * @param {string} userId - Internal user ID from database
 * @returns {Promise<Object>} Patient basic info
 */
export const getPatientBasicInfo = async (userId) => { }
```

**GraphQL Query to Use:**
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

**Implementation Notes:**
- Use `axiosRequest.post('/emr/medical', ...)` from `packages-core-adapter`
- Handle GraphQL errors and throw meaningful messages
- Return empty array if search term < 2 characters
- Backend handles ID prefix match, name contains match, email match
- Debouncing should be handled at component level, not service

---

#### Step 1.2: Create `src/services/patient-records.service.js`

**Purpose:** Fetch various patient record types (medical, dental, appointments, profile).

**Function Signatures:**
```javascript
/**
 * Fetch medical records for a patient
 * @param {string} patientId - Patient user ID
 * @param {number} offset - Pagination offset (default: 0)
 * @param {number} limit - Results per page (default: 10)
 * @returns {Promise<Array>} Medical records
 */
export const getMedicalRecords = async (patientId, offset = 0, limit = 10) => { }

/**
 * Fetch dental records for a patient
 * @param {string} patientId - Patient user ID
 * @param {number} offset - Pagination offset (default: 0)
 * @param {number} limit - Results per page (default: 10)
 * @returns {Promise<Array>} Dental records
 */
export const getDentalRecords = async (patientId, offset = 0, limit = 10) => { }

/**
 * Fetch appointment history for a patient
 * @param {string} patientId - Patient user ID
 * @param {number} offset - Pagination offset (default: 0)
 * @param {number} limit - Results per page (default: 10)
 * @returns {Promise<Array>} Appointment records
 */
export const getAppointmentHistory = async (patientId, offset = 0, limit = 10) => { }

/**
 * Fetch full patient profile details
 * @param {string} patientId - Patient user ID
 * @returns {Promise<Object>} Full profile with all personal & medical info
 */
export const getPatientFullProfile = async (patientId) => { }
```

**Implementation Notes:**
- Use existing GraphQL queries where available, or create new ones
- Each function should handle pagination naturally
- Include error handling & logging
- Return null/empty array on not found or error

---

#### Step 1.3: Create `src/services/patient-search.adapter.js`

**Purpose:** Provide module-specific filtering/adaptation of search results.

**Function Signatures:**
```javascript
/**
 * Create a patient search adapter for specific module use
 * @param {string} moduleName - Module name ('appointment', 'staff-search', etc.)
 * @param {Object} config - Module-specific config {allowedProfileTypes, recordTypes, etc.}
 * @returns {Object} Adapter with filter() and format() methods
 */
export const createPatientSearchAdapter = (moduleName, config = {}) => {
  return {
    filter: (patients) => { },
    format: (patient) => { }
  };
}

/**
 * Pre-built adapters
 */
export const adapters = {
  appointment: createPatientSearchAdapter('appointment', {
    allowedProfileTypes: ['Student', 'Employee'],
    hideRecords: ['dental'] // Hide dental records in appointment context
  }),
  staffSearch: createPatientSearchAdapter('staff-search', {
    // Show everything
  }),
};
```

**Implementation Notes:**
- Each adapter filters/transforms search results for module context
- Can hide/show specific record types
- Can filter by profile_type if needed
- Keep adapters composable for future extensibility

---

### Phase 2: Build SearchPatient Refactored UI

#### Step 2.1: Create `src/modules/staff/search-patient/search-patient.jsx`

**Purpose:** Main search patient component with integrated record viewer.

**Component Structure:**
```jsx
const SearchPatient = () => {
  // State: search input, results, selected patient, active tab
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [recordType, setRecordType] = useState(null); // 'medical'|'dental'|'appointments'|'profile'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Debounced search
  useEffect(() => { /* handle search */ }, [searchTerm]);
  
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <SearchResults /* ... */ />
      </div>
      {selectedPatient && (
        <div className="w-96">
          <PatientDetailPanel /* ... */ />
        </div>
      )}
      {recordType && <RecordViewerModal /* ... */ />}
    </div>
  );
};
```

**Key Features:**
- Search UI with type filter (all/student/employee)
- Results table with patient names, identifiers, profile type
- Patient detail panel (right sidebar) showing:
  - Basic info (name, ID, branch, profile type)
  - Tabs: Medical Records, Dental Records, Appointments, Full Profile
- Record viewer modal (overlay) for detailed view
- Debounced search (300ms)
- Keyboard navigation support
- Error handling & loading indicators

---

#### Step 2.2: Create `src/modules/staff/search-patient/components/search-results.jsx`

**Purpose:** Results table component.

**Display Columns:**
- Avatar/initials
- Full name (formatted: Last, First Middle.)
- Student/Employee ID
- Profile type badge
- Department/Program
- Latest record status badge
- Latest update date

**Interactions:**
- Click row → select patient (highlight, show detail panel)
- Sortable columns (optional)
- Pagination if results > 15

---

#### Step 2.3: Create `src/modules/staff/search-patient/components/patient-detail-panel.jsx`

**Purpose:** Right sidebar showing selected patient info & record type tabs.

**Sections:**
1. **Patient Header**
   - Avatar with initials
   - Full name
   - Student/Employee ID
   - Profile type & department/program

2. **Record Type Tabs** (clickable to view)
   - Medical Records (icon + count if available)
   - Dental Records (icon + count if available)
   - Appointment History (icon + count if available)
   - Full Profile (icon)

3. **Additional Info** (collapsible)
   - Branch
   - Sex
   - Latest update status & date
   - Contact info (if available)

**Interactions:**
- Click tab → open RecordViewerModal with that record type
- Allow deselection to return to search results
- Responsive to patient changes (if new patient selected)

---

#### Step 2.4: Create `src/modules/staff/search-patient/components/record-viewer-modal.jsx`

**Purpose:** Modal overlay for viewing detailed records.

**Modal Structure:**
```
┌─ Record Viewer Modal ──────────────────────┐
│ [Close] Title (Medical Records - John Doe) │
│                                            │
│ ├─ Loading/Error Messages                 │
│ ├─ Record List/Details                    │
│ │  (Tabs: Medical | Dental | Appt History |
│ │   Full Profile)                          │
│ ├─ Pagination (if needed)                 │
│ │                                          │
│ └─ [Close] [Download/Actions - Optional]  │
└────────────────────────────────────────────┘
```

**Handlers:**
- Load records based on record type
- Display loading state
- Handle errors gracefully
- Support pagination
- Close on backdrop click or close button
- Keyboard escape to close

---

#### Step 2.5: Create `src/modules/staff/search-patient/components/medical-record-detail.jsx`

**Purpose:** Display medical record details.

**Displays:**
- Record title/ID
- Date created/updated
- Staff member who created it
- Record content/details
- Related patient info (name, ID, branch)
- Action buttons (optional: view full, download, etc.)

---

#### Step 2.6: Create `src/modules/staff/search-patient/components/dental-record-detail.jsx`

**Purpose:** Display dental record details.

**Same structure as medical record detail** but for dental-specific fields.

---

#### Step 2.7: Create `src/modules/staff/search-patient/components/appointment-record-detail.jsx`

**Purpose:** Display appointment record/history details.

**Displays:**
- Appointment date & time
- Session (morning/afternoon)
- Status (scheduled, completed, no-show, etc.)
- Staff assigned
- Location
- Patient notes (if any)
- Any requirements/attachments

---

### Phase 3: Update Routing & Imports

#### Step 3.1: Update `src/pages/Dashboard.jsx`

**Current:**
```jsx
import SearchPatient from './SearchPatient';
```

**Change to:**
```jsx
import SearchPatient from '../modules/staff/search-patient/search-patient';
```

**Notes:**
- Keep route path `/search` unchanged
- Lazy loading should still work with new path
- Ensure all imports resolve correctly

---

### Phase 4: Integrate with Appointment Module

#### Step 4.1: Update `src/modules/appointment/components/patient-lookup.jsx`

**Current Behavior:** ID-only search via `resolvePatientByIdentifier()`

**New Behavior:**
- Support ID search (use new `patientSearchService`)
- Optionally expose search field for name/email
- Keep UI/UX consistent with appointment flow
- Fall back to ID-only if name search is not needed for appointments

**Implementation Pattern:**
```jsx
// Old way (keep as fallback or remove)
const internalId = await resolvePatientByIdentifier(identifierNum);

// New way (recommended)
const results = await patientSearchService.searchPatients(searchTerm);
const internalId = results[0]?.id; // First exact match or most relevant
```

**Configuration:**
- Use `adapters.appointment` to filter results if needed
- Only show student/employee record types

---

### Phase 5: Testing & Documentation

#### Step 5.1: Create `src/modules/staff/search-patient/TEST-CASES.md`

**Contents:**
- Feature test matrix (search types, record views, interactions)
- Edge cases (no results, duplicates, permissions)
- Integration tests (appointment module usage)
- Performance benchmarks (search speed, modal load time)
- Regression tests (existing functionality preserved)

---

## File Structure

### New Files to Create

```
src/services/
├── patient-search.service.js
├── patient-records.service.js
└── patient-search.adapter.js

src/modules/staff/
└── search-patient/
    ├── search-patient.jsx
    ├── components/
    │   ├── search-results.jsx
    │   ├── patient-detail-panel.jsx
    │   ├── record-viewer-modal.jsx
    │   ├── medical-record-detail.jsx
    │   ├── dental-record-detail.jsx
    │   └── appointment-record-detail.jsx
    └── TEST-CASES.md
```

### Files to Modify

```
src/pages/Dashboard.jsx                          (update import)
src/modules/appointment/components/patient-lookup.jsx  (use new service)
```

### Existing File to Keep (for backward compatibility)

```
src/pages/SearchPatient.jsx                      (can be removed after verification)
```

---

## Service Layer Design

### `patient-search.service.js` - Public API

```javascript
export const patientSearchService = {
  /**
   * Search patients by term (supports ID, name, email)
   */
  searchPatients: async (searchTerm, limit = 15) => Promise<Array>,
  
  /**
   * Get patient basic info by ID
   */
  getPatientBasicInfo: async (userId) => Promise<Object>,
};
```

### `patient-records.service.js` - Public API

```javascript
export const patientRecordsService = {
  getMedicalRecords: async (patientId, offset, limit) => Promise<Array>,
  getDentalRecords: async (patientId, offset, limit) => Promise<Array>,
  getAppointmentHistory: async (patientId, offset, limit) => Promise<Array>,
  getPatientFullProfile: async (patientId) => Promise<Object>,
};
```

### `patient-search.adapter.js` - Public API

```javascript
export const adapters = {
  appointment: { filter, format },
  staffSearch: { filter, format },
};

export const createPatientSearchAdapter = (moduleName, config) => ({
  filter: (patients) => { },
  format: (patient) => { }
});
```

---

## Component Hierarchy

```
SearchPatient (main)
├── SearchResults (child)
│   └── Result Row × N
├── PatientDetailPanel (child, conditional)
│   ├── Patient Header
│   ├── Record Type Tabs
│   └── Additional Info
└── RecordViewerModal (child, conditional)
    ├── MedicalRecordDetail (or DentalRecordDetail, etc.)
    ├── Pagination
    └── Actions
```

**Props Flow:**
- `SearchPatient` → manages all state
- Results/Panel/Modal receive `selectedPatient`, `recordType`, callbacks
- Each component handles its own loading/error states

---

## Integration Points

### 1. Dashboard Routing
```jsx
// src/pages/Dashboard.jsx
<Route path="/search" element={<SearchPatient />} />
```

### 2. Appointment Module (Optional)
```jsx
// src/modules/appointment/components/patient-lookup.jsx
const results = await patientSearchService.searchPatients(searchTerm);
```

### 3. Other Future Modules
```jsx
// Any module needing patient search
import { patientSearchService } from '../../services/patient-search.service';
```

---

## Test Strategy

### Unit Tests (Service Layer)
- **patient-search.service.js:**
  - Search by ID returns matching patients
  - Search by name returns matching patients
  - Search by email returns matching patients
  - Search < 2 chars returns empty array
  - Error handling for GraphQL failures

- **patient-records.service.js:**
  - Medical records fetch works
  - Dental records fetch works
  - Appointment history fetch works
  - Full profile fetch returns complete data

- **patient-search.adapter.js:**
  - Adapters filter correctly per module
  - Adapters format data as expected

### Component Tests
- **SearchPatient:**
  - Search UI renders and accepts input
  - Results display after search
  - Patient selection works
  - Detail panel shows on selection
  - Record tabs load data when clicked
  - Modal opens on tab click
  - Modal closes on close button/escape

- **RecordViewerModal:**
  - Correct record type displayed
  - Pagination works if needed
  - Close handlers work

### Integration Tests
- **Appointment Module:**
  - Patient lookup still works with ID
  - Patient lookup works with new service (optional)
  - Results filter correctly for appointments

### Manual Testing
1. Search by ID → verify results
2. Search by name → verify fuzzy match
3. Search by email → verify results
4. Select patient → verify detail panel
5. Click record tabs → verify modal opens
6. View each record type → verify data displays
7. Test Appointment lookup with new service

---

## Verification Checklist

### Pre-Implementation
- [ ] Backend GraphQL `/emr/medical` endpoint confirmed available
- [ ] GraphQL query `searchPatients` supports all search types (ID, name, email)
- [ ] Database schema reviewed for patient records

### Implementation
- [ ] Phase 1: Services created & tested locally
- [ ] Phase 2: SearchPatient refactored & components built
- [ ] Phase 3: Dashboard routing updated & verified
- [ ] Phase 4: Appointment integration tested
- [ ] Phase 5: Test cases documented

### QA
- [ ] Search by ID returns results
- [ ] Search by name returns results
- [ ] Search by email returns results
- [ ] Patient detail panel displays correctly
- [ ] Record viewers load & display
- [ ] Modal opens/closes properly
- [ ] Appointment module unchanged (backward compatible)
- [ ] No console errors or warnings
- [ ] Performance acceptable (search < 500ms)

### Deployment
- [ ] Old `src/pages/SearchPatient.jsx` removed or kept for reference
- [ ] All imports updated
- [ ] Documentation (TEST-CASES.md) complete
- [ ] Team briefed on new service API

---

## Success Criteria

1. ✓ SearchPatient moved to `src/modules/staff/search-patient/`
2. ✓ Search supports ID, name, and email
3. ✓ Record tabs show medical, dental, appointments, profile
4. ✓ Clicking records opens modal viewer
5. ✓ Reusable service available for other modules
6. ✓ Appointment module can use new service (optional)
7. ✓ Test cases documented
8. ✓ No breaking changes to existing functionality

---

## Notes & Assumptions

- **Backend Support:** GraphQL `/emr/medical` endpoint & `searchPatients` query available ✓
- **Email Search:** Backend already handles email search in GraphQL query ✓
- **Record Filtering:** Show all record types for all users (no profile_type filtering)
- **Modal Display:** Use modal overlay (not new browser tab) for record viewing
- **Backward Compatibility:** Keep Appointment module ID-only search as option
- **Error Handling:** All services include try-catch & logging via logger

---

## Timeline Estimate

| Phase | Est. Duration | Actual |
|-------|---------------|--------|
| Phase 1 (Services) | 1-2 hours | |
| Phase 2 (Components) | 2-3 hours | |
| Phase 3 (Routing) | 30 mins | |
| Phase 4 (Integration) | 1 hour | |
| Phase 5 (Testing/Docs) | 1 hour | |
| **Total** | **5-7 hours** | |

---

## Questions & Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Record view mode (modal vs tab)? | Modal overlay | Keeps search context, cleaner UX |
| Email search support? | Yes (backend ready) | Enhance search flexibility |
| Filter by profile_type? | No, show all | More flexible for staff viewing |
| Appt module compatibility? | Keep ID-only as option | Gradual migration, no breaking changes |

---

## Rollback Plan

If issues arise:
1. Revert `src/pages/Dashboard.jsx` to old import
2. Keep old `src/pages/SearchPatient.jsx` as fallback
3. Don't touch Appointment module (only optional enhancement)
4. Services remain; just not used

---

**Document Version:** 1.0  
**Last Updated:** March 15, 2026  
**Author:** Copilot  
**Status:** Approved by User
