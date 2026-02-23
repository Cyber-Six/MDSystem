# Plan: Appointment Module — Patient & Staff Implementation

## Overview

The `appointment-page.jsx` currently holds a stub patient UI with no real API calls.
The goal is to split it into a **role-gated router** that delegates to two separate
feature sub-components — one for patients and one for staff — each backed by its own
service layer that calls the correct GraphQL endpoint. Role detection uses the
existing `useRole()` hook (subdomain-based). API calls follow the established
`axiosRequest.post(endpoint, { query, variables })` pattern from `emr-service.js`.

**File structure decision:** Keep `appointment-page.jsx` as the thin role-router;
build out the already-created-but-empty `patient/` and `staff/` directories.
This avoids a monolithic file while keeping a single registered route entry point.

---

## Backend Endpoints Reference

| Role   | Endpoint               | JWT guard               |
|--------|------------------------|-------------------------|
| Patient | `POST /appointment/patient` | `jwtProtect("patient")` |
| Staff  | `POST /appointment/medical` | `jwtProtect("medical")` |

All requests follow: `axiosRequest.post('/appointment/<role>', { query, variables })`

---

## Patient API Reference

### Queries (endpoint: `/appointment/patient`)

| Operation | Variables | Returns | Purpose |
|---|---|---|---|
| `getAppointmentStatus` | — | `SCHEDULING_STATUS \| null` | Check if the patient already has an active appointment before showing the booking form |
| `listOpenAppointments` | `offset`, `limit` | `[SlotScheduler!]!` | List available schedulers the patient can book (respects whitelist). Fields: `id`, `label`, `location`, `schedulePerWeek`, `morningAllowed`, `afternoonAllowed`, `notes`, `isActive`, `containsCustomDates`, `whiteListOnly` |
| `listAppointmentRequirements` | `schedulerId`, `offset`, `limit` | `[ScheduleRequirement!]!` | Fetch *active* requirements for a given scheduler (e.g. OJT lab forms). Fields: `id`, `slotId`, `label`, `notes`, `isDigital`, `isActive` |
| `listCustomDates` | `schedulerId`, `offset`, `limit` | `[Date!]!` | Extra one-off dates that the scheduler is open on |
| `listAppointmentSchedule` | `schedulerId`, `date` | `ScheduleDateEntity` | Slot availability for a specific date — includes `morningAllowed`, `morningRegistered`, `morningPending`, `afternoonAllowed`, `afternoonRegistered`, `afternoonPending`. Only dates within `MAX_SCHEDULING_DAYS` days from today are valid |

### Mutations (endpoint: `/appointment/patient`)

| Operation | Variables | Returns | Purpose |
|---|---|---|---|
| `submitAppointment` | `schedulerId: ID!`, `date: Date!`, `session: SCHEDULE_SESSION!`, `requirements: [patientScheduleRequirementInput!]!` | `patientSlot!` | Book the appointment. `requirements` is an array of `{ scheduleRequirementId: ID!, filename: UUID! }` — must exactly match all active requirements for the scheduler or the server throws 400 |
| `cancelAppointment` | — | `Boolean!` | Cancel the patient's current active appointment (Pending/Scheduled/InProgress) |

---

## Staff (Medical) API Reference

### Queries (endpoint: `/appointment/medical`)

| Operation | Variables | Returns | Purpose |
|---|---|---|---|
| `searchAppointmentStatuses` | `status: SCHEDULING_STATUS!`, `offset`, `limit` | `[patientSlot!]!` | Paginated list of all appointments by status. Main driver for the staff queue (Pending, Scheduled, etc.) |
| `getUserAppointmentStatus` | `userId: ID!` | `SCHEDULING_STATUS \| null` | Quick status of a specific patient |
| `getUserAppointmentRecords` | `userId: ID!`, `offset`, `limit` | `[patientSlot!]!` | Full appointment history for a patient including nested `requirements[]` |
| `listAllOpenAppointments` | `offset`, `limit` | `[SlotScheduler!]!` | All schedulers (no whitelist filter) for configuration panel |
| `listAllAppointmentRequirements` | `schedulerId`, `offset`, `limit` | `[ScheduleRequirement!]!` | All requirements (active + inactive) for a scheduler |

### Mutations (endpoint: `/appointment/medical`)

| Operation | Variables | Returns | Purpose |
|---|---|---|---|
| `respondAppointment` | `userId: ID!`, `status: SCHEDULING_STATUS!` (`"Scheduled"` or `"Rejected"`), `notes: String` | `patientSlot!` | Approve or reject a Pending appointment |
| `recordAppointmentAttendance` | `slotId: ID!`, `arrived_at: Date!` | `patientSlot!` | Mark patient as arrived (slot must be `Scheduled` → becomes `InProgress`) |
| `createScheduler` | `input: SlotSchedulerInput!` | `SlotScheduler!` | Create a new slot scheduler. Input: `label`, `location` (Arlegui/Casal/QuezonCity), `schedulePerWeek: [String]` (day names, e.g. `["Monday","Wednesday"]`), `morningAllowed`, `afternoonAllowed`, `notes`, `slotCustomDates: [Date]`, `whiteLists: [ID]`, `whiteListOnly: Boolean` |
| `updateScheduler` | `schedulerId: ID!`, `input: SlotSchedulerUpdateInput!` | `SlotScheduler!` | Partial update (all input fields optional except `schedulePerWeek` which replaces existing) |
| `deleteScheduler` | `schedulerId: ID!` | `Boolean!` | Delete a scheduler |
| `updateSchedulerRequirement` | `schedulerId: ID!`, `input: ScheduleRequirementInput!` | `ScheduleRequirement!` | Upsert a requirement (label, notes, isDigital, isActive) |
| `deleteSchedulerRequirement` | `schedulerId: ID!`, `label: String!` | `Boolean!` | Delete requirement by label |
| `setCustomDates` | `schedulerId: ID!`, `dates: [Date!]!` | `[Date!]!` | Add extra open dates to a scheduler |
| `unsetCustomDates` | `schedulerId: ID!`, `dates: [Date!]!` | `[Date!]!` | Remove custom dates |
| `addEntryWhitelist` | `schedulerId: ID!`, `patientIds: [ID!]!` | `[ID!]!` | Whitelist patients for a restricted scheduler |
| `removeEntryWhitelist` | `schedulerId: ID!`, `patientIds: [ID!]!` | `[ID!]!` | Remove patients from whitelist |
| `updateDateIdentity` | `schedulerId: ID!`, `date: Date!`, `input: ScheduleDateEntityUpdate!` | `ScheduleDateEntity!` | Override slot counts or dates for a specific calendar date |

---

## SCHEDULING_STATUS Enum Values

`Pending` · `Scheduled` · `Rejected` · `Expired` · `Completed` · `NoShow` · `CancelledByPatient` · `CancelledByMedical`

---

## Implementation Steps

### Step 1 — Update `appointment-page.jsx` as Role Router

In `mds-frontend/src/modules/appointment/appointment-page.jsx`:
- Import `useRole` from `../hooks/use-role`  
- If `role === 'patient'` → render `<PatientAppointment />`  
- If `role === 'medical'` (staff) → render `<StaffAppointment />`  
- Otherwise render an access-denied fallback  
- Remove all the current hardcoded form/state/table code; this file becomes a 10-line router

---

### Step 2 — Create Patient Service Layer

Create `mds-frontend/src/modules/appointment/patient/patient-appointment-service.js`:

- Use `axiosRequest` from `../../../packages-core-adapter`
- All calls go to `POST /appointment/patient`
- Export individual async functions:
  - `getAppointmentStatus()` → query `getAppointmentStatus`
  - `listOpenAppointments(offset, limit)` → query `listOpenAppointments`
  - `listRequirements(schedulerId)` → query `listAppointmentRequirements`
  - `listCustomDates(schedulerId)` → query `listCustomDates`
  - `getScheduleAvailability(schedulerId, date)` → query `listAppointmentSchedule`
  - `submitAppointment(schedulerId, date, session, requirements)` → mutation `submitAppointment`
  - `cancelAppointment()` → mutation `cancelAppointment`

---

### Step 3 — Build Patient UI

Create `mds-frontend/src/modules/appointment/patient/patient-appointment.jsx`:

**State:** `currentStatus` (from `getAppointmentStatus`), `currentStep` (stepper: 0=select scheduler, 1=select date, 2=upload requirements, 3=confirm), loading/error states.

**If patient has an active appointment** (status is `Pending` or `Scheduled`):
- Show **read-only appointment card**: date, session, scheduler label, status badge, requirements list
- Show **Cancel Appointment** button → calls `cancelAppointment()` then refetches

**If no active appointment** — show multi-step booking wizard:

**Step 0 — Select Appointment Type**
- Call `listOpenAppointments()` on mount
- Render a card grid showing each `SlotScheduler`: `label`, `location`, `notes`, `schedulePerWeek` (day pills), `morningAllowed`/`afternoonAllowed`
- On select, store `selectedScheduler` and advance to Step 1

**Step 1 — Select Date & Session**
- Call `listCustomDates(selectedScheduler.id)` to get bonus dates
- Render a calendar restricted to:  
  - Days matching `selectedScheduler.schedulePerWeek` (e.g. only Mon/Wed/Fri enabled)  
  - Plus any custom dates from `listCustomDates`  
  - Only within the server-enforced future window (display a note: "Bookings only available up to N days ahead")
- On date select: call `getScheduleAvailability(schedulerId, date)` and display:
  - Morning: `X / morningAllowed` slots remaining (= `morningAllowed - morningRegistered - morningPending`)
  - Afternoon: same
  - Disable the session radio if the session is full
- User picks Morning or Afternoon, advances to Step 2

**Step 2 — Upload Requirements** (conditional)
- Call `listRequirements(schedulerId)`
- If requirements list is empty → skip to Step 3 automatically
- For each active `ScheduleRequirement`: show `label`, `notes`, file upload input (UUID filename expected)
- Build `requirements` array as `[{ scheduleRequirementId, filename }]`

**Step 3 — Review & Submit**
- Show summary of: scheduler label + location, date, session, requirement filenames
- Submit button calls `submitAppointment(schedulerId, date, session, requirements)` → on success show confirmation and reset to "active appointment" view

---

### Step 4 — Create Staff Service Layer

Create `mds-frontend/src/modules/appointment/staff/staff-appointment-service.js`:

- All calls go to `POST /appointment/medical`
- Export:
  - `searchByStatus(status, offset, limit)` → `searchAppointmentStatuses`
  - `getPatientStatus(userId)` → `getUserAppointmentStatus`
  - `getPatientRecords(userId, offset, limit)` → `getUserAppointmentRecords`
  - `listAllSchedulers(offset, limit)` → `listAllOpenAppointments`
  - `listAllRequirements(schedulerId)` → `listAllAppointmentRequirements`
  - `respondToAppointment(userId, status, notes)` → `respondAppointment`
  - `recordAttendance(slotId, arrivedAt)` → `recordAppointmentAttendance`
  - `createScheduler(input)` → `createScheduler`
  - `updateScheduler(schedulerId, input)` → `updateScheduler`
  - `deleteScheduler(schedulerId)` → `deleteScheduler`
  - `updateRequirement(schedulerId, input)` → `updateSchedulerRequirement`
  - `deleteRequirement(schedulerId, label)` → `deleteSchedulerRequirement`
  - `setCustomDates(schedulerId, dates)` → `setCustomDates`
  - `unsetCustomDates(schedulerId, dates)` → `unsetCustomDates`
  - `addWhitelist(schedulerId, patientIds)` → `addEntryWhitelist`
  - `removeWhitelist(schedulerId, patientIds)` → `removeEntryWhitelist`
  - `updateDateIdentity(schedulerId, date, input)` → `updateDateIdentity`

---

### Step 5 — Build Staff UI

Create `mds-frontend/src/modules/appointment/staff/staff-appointment.jsx`:

**Layout:** Two-panel or tabbed layout with a top-level tab bar:
- **Appointments** tab (default)
- **Scheduler Config** tab

---

**Appointments Tab:**

Status filter pills: `Pending` · `Scheduled` · `Completed` · `NoShow` · `CancelledByPatient` · `CancelledByMedical` · `Rejected` · `Expired`

On filter select → call `searchByStatus(status)` → render paginated table:
- Columns: Patient ID, Date, Session, Scheduler, Status badge, Location, Created At, Actions
- Action per row:
  - If `Pending` → **Approve** (calls `respondAppointment(userId, "Scheduled")`) + **Reject** (opens a notes modal then calls `respondAppointment(userId, "Rejected", notes)`)
  - If `Scheduled` → **Mark Arrived** (calls `recordAttendance(slotId, new Date())`)
  - Always → **View History** (opens a side drawer calling `getPatientRecords(userId)`)

**Patient History Drawer:**
- Shows all past `patientSlot` records for a patient
- Each record: date, session, status badge, notes, requirements list (filenames)

---

**Scheduler Config Tab:**

Sub-tabs: **Schedulers** | **Requirements** | **Custom Dates** | **Whitelist**

**Schedulers sub-tab:**
- Table listing all schedulers from `listAllSchedulers()`
- Fields shown: label, location, schedulePerWeek pills, morning/afternoon capacity, isActive toggle, containsCustomDates, whitelistOnly
- Actions: **Edit** (inline form using `updateScheduler`) | **Delete** (`deleteScheduler` with confirm dialog)
- **+ New Scheduler** button → modal form with all `SlotSchedulerInput` fields:
  - label (text), location (select: Arlegui/Casal/QuezonCity), schedulePerWeek (multi-checkboxes: Mon-Sun), morningAllowed (number), afternoonAllowed (number), notes (text), slotCustomDates (date-picker), whiteLists (ID input array), whiteListOnly (checkbox)
  - On submit → `createScheduler(input)`

**Requirements sub-tab:**
- Scheduler selector first → load `listAllRequirements(schedulerId)`
- Table: label, notes, isDigital, isActive toggle
- **Add** / **Edit** → `updateSchedulerRequirement` | **Delete** → `deleteSchedulerRequirement`

**Custom Dates sub-tab:**
- Scheduler selector → load existing custom dates
- Calendar/date-picker to add (`setCustomDates`) or remove (`unsetCustomDates`) dates
- Also **Override Slot** button per date → opens `updateDateIdentity` form (change morningAllowed/afternoonAllowed for that specific date)

**Whitelist sub-tab:**
- Scheduler selector (only shown when `whiteListOnly = true` for that scheduler)
- Input patient IDs to add (`addEntryWhitelist`) or remove (`removeEntryWhitelist`)

---

## File Breakdown Summary
