# PR: SearchPatient Module, Appointment Queue Enhancements & Email Search

**Branch:** `frontend-jay` → `deployment`

---

## Summary

This PR delivers three interconnected improvements to the staff-facing MDS web app:

1. A fully rebuilt **SearchPatient module** with Chrome-like internal tab management
2. **Global patient search** (name / ID / email) wired across both SearchPatient and the Appointment module
3. **Appointment queue** improvements — email search, instant tab counts, and reactive count updates on staff actions

---

## Changes

### Backend

| File | Change |
|------|--------|
| `schema.graphql` | Added `patientEmail: String` to `patientSlot` type; added `StatusCount` type and `getAppointmentStatusCounts` query |
| `wrapper.js` | Added `LEFT JOIN "UserCredentials"` to `_searchAppointmentStatuses` to expose patient email; added `_getAppointmentStatusCounts` using a single `GROUP BY status` query |
| `medical-resolver.js` | Added `getAppointmentStatusCounts` resolver with `appointment_allow_view_records` permission guard |
| `emr/wrapper/query.js` | Fixed `searchPatients` SQL — cast `identifier::text` for `ILIKE`, wrapped names in `COALESCE`, added `UserCredentials` JOIN for email search |

### Frontend — Services & Context

| File | Change |
|------|--------|
| `src/services/patient-search-service.js` *(new)* | Reusable global search service — `searchPatients()`, `formatPatientName()`, `getPatientInitials()`, `getProfileLabel()` |
| `src/context/patient-tabs-context.jsx` *(new)* | `PatientTabsContext` — manages open patient tabs array and active tab ID; persists state across all routes via `PatientTabsProvider` in `Dashboard.jsx` |
| `staff-appointment-service.js` | Added `patientEmail` field to `searchByStatus` query; added `getStatusCounts()` — single GraphQL call returning `{ Pending: n, Scheduled: n, … }` |

### Frontend — SearchPatient Module

| File | Change |
|------|--------|
| `search-patient.jsx` | Full rewrite — Chrome-like tab bar (Search tab always first, non-closable), 2 s debounce (`SEARCH_DEBOUNCE_MS` constant), shows loader immediately on input, renders embedded `PatientRecord` per tab. All tabs kept mounted (hidden), preserving state |
| `search-bar.jsx` | Extracted search input component; fixed spinner — SVG `animate-spin` rotated around `0 0` (SVG default transform-origin), replaced with CSS border spinner on a wrapper element to eliminate the transform conflict |
| `patient-detail-panel.jsx` | Record sections (personal, medical, dental, appointments, history) now call `openTab()` from `PatientTabsContext` instead of `window.open()` |
| `patient-lookup.jsx` (appointment) | Replaced numeric ID-only input with debounced global search using `patient-search-service`; dropdown picker for multiple matches; uses `patient.id` directly as `resolvedUserId` — no extra `resolvePatientByIdentifier` round-trip needed |

### Frontend — Appointment Queue

| File | Change |
|------|--------|
| `appointment-queue.jsx` | Calls `getStatusCounts()` on mount (single request) to show all tab badges immediately with pulse placeholder while loading; counts update **without refresh** when the parent calls `removeAppointment(id, newStatus)` — old status decrements, new status increments; email search now works via `patientEmail` returned from backend |
| `PatientRecord.jsx` | Accepts `patientId`, `initialTab`, `embedded` props for rendering inside tabs; hides back-button in embedded mode; falls back to route params for standalone navigation |
| `Dashboard.jsx` | Wrapped routes in `PatientTabsProvider` so tab state persists when navigating to other modules |

---

## How Tab Counts Stay in Sync

```
Mount
  └─ getStatusCounts()  ←  single GROUP BY query, returns all 8 statuses at once

Staff action (approve / reject / mark done / etc.)
  └─ respondToAppointment() or recordAttendance()
       └─ queueRef.current.removeAppointment(slotId, newStatus)
            ├─ remove row from current tab list (optimistic)
            ├─ tabCounts[activeTab]  -= 1
            └─ tabCounts[newStatus] += 1
```

No full re-fetch needed. Counts and list stay consistent immediately.

---

## How Email Search Works

- **SearchPatient / Patient Lookup:** `searchPatients()` hits `/emr/medical` → SQL JOINs `UserCredentials` for email; returns results filtered by name OR identifier OR email.
- **Appointment Queue (client-side filter):** `searchByStatus` now requests `patientEmail` in its GraphQL query. The filter checks `patientName`, `patientIdentifier`, `patientEmail`, and appointment `id` against the search string.

---

## Loader Fix

SVG elements have a default CSS `transform-origin` of `0 0` (top-left), not `center`. Tailwind's `animate-spin` keyframe sets `transform: rotate(360deg)` which removes any `translateY` set on the same element, causing visible jitter. All spinners replaced with:

```jsx
/* outer — handles positioning only, never animated */
<span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 flex items-center justify-center">
  {/* inner — animated only, no conflicting transform */}
  <span className="animate-spin w-4 h-4 rounded-full border-2 border-current/20 border-t-current block" />
</span>
```

`border-current/20` and `border-t-current` derive color from the parent's `text-primary-500`, keeping theming consistent without hardcoded values.

---

## Testing Checklist

- [ ] SearchPatient: search by name, student/employee ID, email — results appear after 2 s debounce
- [ ] SearchPatient: clicking a record section opens an internal tab; tab persists when switching to Appointments module and back
- [ ] SearchPatient: close button removes tab; Search tab cannot be closed
- [ ] Appointment Queue: all 8 tab count badges appear on page load (no tab click required)
- [ ] Appointment Queue: search by patient name matches rows; search by email matches rows
- [ ] Appointment Queue: approving a Pending appointment — Pending count decrements, Scheduled count increments (no refresh)
- [ ] Appointment Queue: rejecting — Pending decrements, Rejected increments
- [ ] Appointment Queue: marking attendance — Scheduled decrements, InProgress increments
- [ ] Patient Lookup: search by name / ID / email returns matching patients; selecting one loads their appointment records
- [ ] Loader spinner renders as a smooth circle on all search inputs and queue loading state

---

## Commit Message

```
feat(staff): SearchPatient tab management, appointment queue email search & instant counts

- Rebuilt SearchPatient with Chrome-like internal tab system and PatientTabsContext
  for state persistence across route navigation
- 2s debounce on global search (name/ID/email) with immediate loader feedback
- Created reusable patient-search-service.js shared across SearchPatient and
  Appointment Patient Lookup
- Fixed backend searchPatients SQL: type cast identifier::text for ILIKE, COALESCE
  on null names, UserCredentials JOIN for email
- Added patientEmail to patientSlot via UserCredentials JOIN in appointment resolver
- Added getAppointmentStatusCounts GraphQL query (single GROUP BY query) to populate
  all tab count badges on mount without per-tab requests
- Tab count badges update reactively on approve/reject/mark-done without page refresh
- Fixed spinner CSS: split animate-spin and -translate-y-1/2 onto separate elements to
  eliminate SVG transform-origin conflict; switched to border-based CSS spinners

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
