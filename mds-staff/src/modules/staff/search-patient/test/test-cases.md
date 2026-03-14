# Search Patient Module - Test Cases

## Search Functionality
- **Create**  **Test**
- [ ] [ ] Search by student/employee ID returns matching patients
- [ ] [ ] Search by name (first, last, partial) returns matching patients
- [ ] [ ] Search by email returns matching patients
- [ ] [ ] Search with < 2 characters shows hint, no API call
- [ ] [ ] Debounce: rapid typing only fires one search after 300ms pause
- [ ] [ ] Empty results show "No patients found" message
- [ ] [ ] API error displays error message
- [ ] [ ] Loading spinner shows during search

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

## Open in New Tab (Record Sections)
- **Create**  **Test**
- [ ] [ ] "Full Details" opens /patient/{id}?tab=personal in new browser tab
- [ ] [ ] "Medical Records" opens /patient/{id}?tab=medical in new browser tab
- [ ] [ ] "Dental Records" opens /patient/{id}?tab=dental in new browser tab
- [ ] [ ] "Appointment Records" opens /patient/{id}?tab=appointments in new browser tab
- [ ] [ ] "Consultation History" opens /patient/{id}?tab=history in new browser tab
- [ ] [ ] New tab loads PatientRecord with correct tab pre-selected
- [ ] [ ] New tab authentication works (JWT in localStorage shared across tabs)

## PatientRecord Tab Deep-Linking
- **Create**  **Test**
- [ ] [ ] /patient/{id}?tab=personal opens Personal Info tab
- [ ] [ ] /patient/{id}?tab=medical opens Medical Record tab
- [ ] [ ] /patient/{id}?tab=dental opens Dental Record tab
- [ ] [ ] /patient/{id}?tab=appointments opens Appointments tab
- [ ] [ ] /patient/{id}?tab=history opens Consultation History tab
- [ ] [ ] /patient/{id} (no tab param) defaults to Personal Info
- [ ] [ ] /patient/{id}?tab=invalid defaults to Personal Info

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
- [ ] [ ] Browser back button from new tab returns to search

## Future: Appointment Module Integration
- **Create**  **Test**
- [ ] [ ] Import searchPatients from shared service in patient-lookup.jsx
- [ ] [ ] Replace numeric-only input with general text search
- [ ] [ ] Show results picker when multiple matches found
- [ ] [ ] Selected patient ID is passed to getPatientStatus/getPatientRecords

---

Notes:
- Each line has two leading checkboxes: first for implementing, second for testing.
- "Open in new tab" tests require manual verification in browser.
- Reusable service located at: `src/services/patient-search-service.js`
- Module located at: `src/modules/staff/search-patient/`
