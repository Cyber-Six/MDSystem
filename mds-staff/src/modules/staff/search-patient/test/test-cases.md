# Search Patient Module - Test Cases

## Search Functionality
- **Create**  **Test**
- [ ] [ ] Search by student/employee ID returns matching patients
- [ ] [ ] Search by name (first, last, partial) returns matching patients
- [ ] [ ] Search by email returns matching patients
- [ ] [ ] Search with < 2 characters shows hint, no API call
- [ ] [ ] Debounce: rapid typing shows loader immediately, fires API after 2s pause
- [ ] [ ] Loader spinner appears during debounce wait period
- [ ] [ ] Loader spinner persists through API call until results arrive
- [ ] [ ] Empty results show "No patients found" message
- [ ] [ ] API error displays error message
- [ ] [ ] SEARCH_DEBOUNCE_MS constant at top of file is easy to change

## Type Filter
- **Create**  **Test**
- [ ] [ ] "All Types" shows all results
- [ ] [ ] "Students" filters to profile_type === 'Student'
- [ ] [ ] "Employees" filters to profile_type === 'Employee'

## Keyboard Navigation
- **Create**  **Test**
- [ ] [ ] ArrowDown moves focus to next result
- [ ] [ ] ArrowUp moves focus to previous result
- [ ] [ ] Enter on focused result selects patient (shows detail panel)
- [ ] [ ] Escape clears search term and closes detail panel

## Patient Selection & Detail Panel
- **Create**  **Test**
- [ ] [ ] Clicking a result row shows detail panel on the right
- [ ] [ ] Detail panel displays patient name, ID, branch, profile type
- [ ] [ ] Detail panel shows sex, program/department info
- [ ] [ ] Detail panel shows latest record status
- [ ] [ ] Clicking a different result updates the detail panel
- [ ] [ ] Close button on detail panel deselects patient
- [ ] [ ] Selected patient row is visually highlighted

## Chrome-like Tab Management
- **Create**  **Test**
- [ ] [ ] "Search" tab is always first and not closable
- [ ] [ ] Clicking a record section in detail panel opens a new internal tab
- [ ] [ ] Active tab has distinct styling (white bg, top border)
- [ ] [ ] Inactive tabs have muted styling
- [ ] [ ] Hovering over a tab reveals the close (x) button
- [ ] [ ] Clicking a tab switches to that tab's content
- [ ] [ ] Closing a tab removes it and switches back to search view
- [ ] [ ] Opening same patient+section does not create duplicate tab
- [ ] [ ] Tab label shows patient name + section name
- [ ] [ ] Tab tooltip shows full "Patient Name - Section" on hover
- [ ] [ ] Multiple tabs can be open simultaneously
- [ ] [ ] Tab bar scrolls horizontally when many tabs are open
- [ ] [ ] Patient record content renders correctly inside tab

## Tab Persistence
- **Create**  **Test**
- [ ] [ ] Navigating to Appointments module and back retains open tabs
- [ ] [ ] Navigating to Dashboard and back retains open tabs
- [ ] [ ] Navigating to Pending Requests and back retains open tabs
- [ ] [ ] Active tab selection is preserved when navigating back
- [ ] [ ] Search state (results, selected patient) is re-created on return

## Embedded PatientRecord
- **Create**  **Test**
- [ ] [ ] PatientRecord renders without back button when embedded
- [ ] [ ] PatientRecord loads correct patient data when given patientId prop
- [ ] [ ] PatientRecord opens to the correct tab via initialTab prop
- [ ] [ ] Tab switching within PatientRecord works normally when embedded
- [ ] [ ] Print and Edit buttons still visible when embedded

## Reusable Service (patient-search-service.js)
- **Create**  **Test**
- [ ] [ ] searchPatients() returns array of patient objects
- [ ] [ ] searchPatients() handles GraphQL errors gracefully
- [ ] [ ] formatPatientName() formats "Last, First M. Suffix" correctly
- [ ] [ ] getPatientInitials() returns uppercase first letters
- [ ] [ ] getProfileLabel() returns program/department info for Students
- [ ] [ ] getProfileLabel() returns department/role info for Employees

## Backend Fixes Applied
- **Create**  **Test**
- [ ] [ ] identifier column (integer) cast to text for ILIKE search
- [ ] [ ] COALESCE wraps nullable name fields to prevent NULL concatenation errors
- [ ] [ ] Email search added via JOIN to UserCredentials table

## Edge Cases
- **Create**  **Test**
- [ ] [ ] Special characters in search term do not break query
- [ ] [ ] Patient with no identifier (null) displays correctly
- [ ] [ ] Patient with no UsersPersonalLog entry still appears in results
- [ ] [ ] Patient with no latest_status shows "No record"
- [ ] [ ] Rapid patient selections do not cause stale state
- [ ] [ ] Switching search type while detail panel is open clears selection if patient is filtered out
- [ ] [ ] Opening many tabs does not degrade performance

## Future: Appointment Module Integration
- **Create**  **Test**
- [ ] [ ] Import searchPatients from shared service in patient-lookup.jsx
- [ ] [ ] Replace numeric-only input with general text search
- [ ] [ ] Show results picker when multiple matches found
- [ ] [ ] Selected patient ID is passed to getPatientStatus/getPatientRecords

---

Notes:
- Each line has two leading checkboxes: first for implementing, second for testing.
- Tab persistence relies on PatientTabsContext wrapping all routes in Dashboard.jsx.
- Debounce delay is configurable via SEARCH_DEBOUNCE_MS constant in search-patient.jsx.
- Reusable service located at: `src/services/patient-search-service.js`
- Module located at: `src/modules/staff/search-patient/`
- Tab context located at: `src/context/patient-tabs-context.jsx`
