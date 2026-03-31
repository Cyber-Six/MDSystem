# Dashboard Dynamic Stats — Implementation Documentation

## Summary
Converted the staff dashboard from static/hardcoded values to fully dynamic, real-time data fetched from a new backend REST endpoint. All dashboard widgets now reflect live database state and auto-refresh every 60 seconds.

---

## Changes Made

### 1. New Backend Endpoint
**File**: `Backend/routes/staff/staff.js`  
**Route**: `GET /staff/dashboard/stats`  
**Auth**: `jwtProtect("medical")`

A single REST endpoint that runs **9 parallel SQL queries** via `Promise.all` for maximum efficiency. All queries are branch-scoped using the authenticated staff member's branch.

#### Queries Executed
| # | Metric | Tables | Filter |
|---|--------|--------|--------|
| 1 | Pending EMR tickets | `patientUpdateLog`, `UsersPersonal` | status IN (Pending, InProgress, Revision, RevisionSubmitted) |
| 2 | Pending appointment requests | `patientSlot` | status = 'Pending' |
| 3 | Pending medicine requests | `MedicineRequestLog` | status = 'Pending', branch-filtered |
| 4 | Active consultations | `Consultation`, `UsersPersonal` | status IN (Open, ReOpen, Created), branch-filtered |
| 5 | Low stock items | `MedicalItems`, `MedicineBatch`, `MedicineEntity` | active medicines with ≤10 available units |
| 6 | Today's appointments | `patientSlot`, `ScheduleDateEntity` | scheduledDate = today, status IN (Scheduled, InProgress, Completed) |
| 7 | Tomorrow's slot availability | `slotScheduler`, `ScheduleDateEntity`, `patientSlot` | active schedulers, scheduledDate = tomorrow |
| 8 | Recent patients (last 5) | `patientSlot`, `UsersPersonal`, `Patients` | arrived_at IS NOT NULL, branch-filtered |
| 9 | Pending requests detail (last 5) | `patientUpdateLog` UNION `patientSlot` + `UsersPersonal` | pending statuses, branch-filtered |

#### Response Schema
```json
{
  "stats": {
    "pendingRequests": 5,
    "pendingBreakdown": { "emr": 2, "appointments": 2, "medicine": 1 },
    "todayAppointments": 12,
    "todayRemaining": 4,
    "activeConsultations": 3,
    "lowStockItems": 7
  },
  "tomorrowAvailability": {
    "Medical": { "open": 8, "total": 20 },
    "Dental": { "open": 5, "total": 10 }
  },
  "recentPatients": [
    { "id": "uuid", "name": "Juan Dela Cruz", "identifier": "12345", "program": "BSCS", "lastVisit": "2026-03-31T..." }
  ],
  "pendingRequests": [
    { "id": "1", "name": "Jane Doe", "type": "EMR Update", "status": "Pending", "submitted": "2026-03-30T..." }
  ]
}
```

### 2. New Frontend Service
**File**: `mds-staff/src/modules/dashboard/dashboard-service.js` (NEW)

Single function `fetchDashboardStats()` that calls `GET /staff/dashboard/stats` via `axiosRequest` (auto-JWT injection).

### 3. Updated Dashboard Component
**File**: `mds-staff/src/modules/dashboard/dashboard-home.jsx`

#### What Changed
- Replaced all static/hardcoded values with state variables populated from the API
- Added `useState` for: `loading`, `error`, `stats`, `tomorrowAvailability`, `recentPatients`, `pendingRequests`
- Added `useEffect` with `loadDashboard()` callback + 60-second auto-refresh interval
- Stat cards now show pending breakdown text (e.g., "2 EMR · 2 Appt · 1 Rx")
- Stat cards with navigation targets (Pending, Appointments, Inventory) are now clickable `<Link>` elements with hover effects
- Tomorrow's Availability is now dynamically rendered from scheduler data (not hardcoded Medical/Dental)
- Added loading states (pulse animation, dash placeholders)
- Added error banner with retry button
- Added empty states for Recent Patients and Pending Requests
- Pending request arrow buttons now navigate to the relevant module (/appointments or /pending)

#### Removed
- Static `appointmentStats` object with hardcoded zeros
- Static `recentPatients = []` and `pendingRequests = []`
- All TODO comments (replaced with working implementations)
- OJT missing docs warning (no backend data source exists for this yet)

---

## Architecture Notes

### Why a Single REST Endpoint (Not GraphQL)
- The dashboard needs data from **6+ different domain tables** across appointments, EMR, consultations, inventory, and medicine requests
- Each domain has its own separate GraphQL endpoint with different auth middleware
- A REST endpoint on `/staff` can run all queries in parallel with a single JWT check
- This avoids N+1 HTTP request waterfalls from the frontend

### Security
- All queries use **parameterized SQL** (`$1`, `$2`, etc.) — no SQL injection risk
- Branch scoping ensures staff only see data from their assigned branch
- JWT authentication enforced via `jwtProtect("medical")` middleware

### Performance
- All 9 queries run in parallel via `Promise.all`
- Frontend caches results in React state, refreshes every 60 seconds
- No heavy JOINs — most queries are simple COUNTs
