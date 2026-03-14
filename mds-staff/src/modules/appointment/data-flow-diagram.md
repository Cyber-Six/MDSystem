# Appointment System — Data Flow Diagram

> Source of truth: `Appointment System.drawio.svg`
> Last validated: 2026-03-10

## Symbol Legend

| Text Symbol      | Shape         | Meaning                                      |
|------------------|---------------|----------------------------------------------|
| `( Name )`       | Ellipse       | External Entity / Actor, or Terminal node    |
| `[ Name ]`       | Rectangle     | Process / Action step                        |
| `<? Question ?>` | Diamond       | Decision point (branches Yes / No)           |
| `-->`            | Arrow         | Data or control flow (unlabeled)             |
| `--[label]-->`   | Labeled arrow | Data or control flow with named payload      |
| `// text //`     | Annotation    | Description, business rule, or note          |

### Color Coding (from SVG)

| Color       | Tag          | Meaning                                                  |
|-------------|--------------|----------------------------------------------------------|
| **Green**   | `resolver`   | Triggered by a GraphQL resolver (manual / on-demand)     |
| **Purple**  | `auto`       | Automatic process (system-triggered, e.g. expiry timer)  |
| No fill     | —            | Decision points, labels, descriptions, or staff ops      |

---

## Actors / External Entities

| Symbol              | Role                                                                  |
|---------------------|-----------------------------------------------------------------------|
| `( Patient )`       | Initiates appointment requests; browses available schedules           |
| `( Staff )`         | Receives requests; approves or rejects them; manages all schedules    |
| `( End )`           | Terminal — flow exits here                                            |

---

## Patient Appointment Flow

### Phase 1 — Schedule Discovery

- [x] `listOpenAppointments` resolver implemented
- [x] `listAppointmentSchedule` resolver implemented
- [x] `listAppointmentRequirements` resolver implemented

```
( Patient )
  --> [ listOpen Appointments ]          // resolver (green) — get available appointment schedules for the patient
        --> [ listAppointment Schedules ]     // resolver (green) — get available dates for a schedule for the patient
              --> [ listAppointment Requirement ]  // resolver (green) — get requirements before scheduling the patient
                    --> <? patient finds a available Schedule? >
```

### Phase 2 — Schedule Availability Check

- [x] Frontend correctly handles "no available schedule" → End
- [x] Frontend correctly handles "schedule closed / no slot" → End

```
<? patient finds a available Schedule? >
  -- No  --> ( End )
  -- Yes --> <? is the schedule open / still has slot? >
                  -- No  --> ( End )
                  -- Yes --> <? is there pre requirements? >
```

### Phase 3 — Pre-Requirements Gate

- [x] `submitAppointment` mutation handles requirements inline
- [x] `submitAppointment` mutation implemented (green)
- [x] Pre-requirements correctly gate the submission

```
<? is there pre requirements? >
  -- No  --> [ Submit Appointment Request ]        // resolver (green)
  -- Yes --> [ Submit Requirements ]               // resolver (green)
               --> [ Submit Appointment Request ]  // resolver (green)
```

### Phase 4 — Submission & Logging

> **Note:** The SVG diagram labels this step `"InProgress"`, but the actual
> codebase inserts the slot as `"Pending"`.  `InProgress` is set later when
> the patient physically arrives (via `recordAppointmentAttendance`).

- [x] Patient slot logged as `"Pending"` on submission
- [ ] `decayed "expired"` auto-process triggers on timeout (purple) — not yet automated
- [x] Request forwarded to Staff for review
- [x] `( prevent multiple appointment )` rule enforced

```
[ Submit Appointment Request ]
  --> ( Staff )                                     // Staff Required — request forwarded for review
  --> [ entry patientSlot is logged "Pending" ]      // SVG says "InProgress" — code uses "Pending"
        |
        |--> [ decayed "expired" ]                  // auto (purple): slot expires if staff does not respond
        |      --> ( End )
        |
        --> <? Staff Approved? >
```

### Phase 5 — Staff Decision

- [x] `respondAppointment` resolver handles approve/reject
- [x] Rejection terminates flow → End
- [x] Approval sets status to `"Scheduled"`

```
<? Staff Approved? >
  -- No  --> ( End )
  -- Yes --> [ Appointment is Settled  status "scheduled" ]
               --> <? cancelled? >
```

### Phase 6 — Post-Schedule Status Tracking

- [x] `cancelAppointment` mutation implemented (patient-side, green)
- [x] `Appointment status "completed"` — staff-side via `respondAppointment(status: Completed)` (InProgress → Completed)
- [x] `Appointment status "no-show"` — staff-side via `respondAppointment(status: NoShow)` (Scheduled/InProgress → NoShow)
- [ ] `decayed "expired"` auto-process triggers on timeout (purple) — not yet automated

```
<? cancelled? >
  -- Yes --> [ setAppointment Cancelled ]           // resolver (green)
               --> ( End )
  -- No  --> <? no show? >
               -- No  --> [ Appointment status "completed" ]   // resolver (green)
                            --> ( End )
               -- Yes --> [ Appointment status "no-show" ]     // auto (purple)
                            --> ( End )
```

---

## Complete Flow (Single Linear Trace)

```
( Patient )
  --> [ listOpen Appointments ]                         // resolver (green)
        --> [ listAppointment Schedules ]                // resolver (green)
              --> [ listAppointment Requirement ]        // resolver (green)
                    --> <? patient finds a available Schedule? >
                          -- No  --> ( End )
                          -- Yes --> <? is the schedule open / still has slot? >
                                          -- No  --> ( End )
                                          -- Yes --> <? is there pre requirements? >
                                                          -- No  -----> [ Submit Appointment Request ]
                                                          -- Yes --> [ Submit Requirements ]
                                                                         --> [ Submit Appointment Request ]

[ Submit Appointment Request ]                          // resolver (green)
  --> ( Staff )                                          // Staff Required
  --> [ entry patientSlot is logged "InProgress" ]
        |--> [ decayed "expired" ] --> ( End )           // auto (purple) — timeout
        --> <? Staff Approved? >
              -- No  --> ( End )
              -- Yes --> [ Appointment is Settled  status "scheduled" ]
                           --> <? cancelled? >
                                 -- Yes --> [ setAppointment Cancelled ] --> ( End )    // resolver (green)
                                 -- No  --> <? no show? >
                                               -- No  --> [ Appointment status "completed" ] --> ( End )  // resolver (green)
                                               -- Yes --> [ Appointment status "no-show" ]   --> ( End )  // auto (purple)
```

---

## Appointment Status State Machine

> Aligned to actual `schedulingStatus` enum and codebase behavior.

| Status              | Trigger                                         | Transition To       |
|---------------------|-------------------------------------------------|---------------------|
| `Pending`           | Patient submits appointment request             | Awaiting staff      |
| `Scheduled`         | Staff approves request                          | Monitoring phase    |
| `InProgress`        | Patient arrives (`recordAppointmentAttendance`) | Active visit        |
| `Completed`         | Appointment successfully fulfilled              | `( End )`           |
| `Rejected`          | Staff rejects the request                       | `( End )`           |
| `Expired`           | No staff response within time limit (auto)      | `( End )`           |
| `CancelledByPatient`| Patient cancels their own appointment           | `( End )`           |
| `CancelledByMedical`| Staff/medical cancels the appointment           | `( End )`           |
| `NoShow`            | Patient did not attend the appointment          | `( End )`           |

---

## Business Rule

```
( prevent multiple appointment )
// A patient may not hold more than one active (InProgress / scheduled) appointment at a time.
```

---

## Staff Schedule Management Operations

All operations below are initiated by `( Staff )`.

### Whitelist Management

- [x] `AddEntryWhitelist` resolver implemented
- [x] `deleteEntryWhitelist` resolver implemented

```
// Whitelist function — controls which patients may book specific schedules
( Staff ) --> [ AddEntryWhitelist ]
( Staff ) --> [ deleteEntryWhitelist ]
```

### Custom Date Management

- [x] `setCustomDates` resolver implemented
- [x] `unsetCustomDates` resolver implemented

```
// set custom dates — override default schedule availability dates
( Staff ) --> [ setCustomDates ]
( Staff ) --> [ unsetCustomDates ]
```

### Scheduler CRUD

- [x] `createScheduler` resolver implemented
- [x] `updateScheduler` resolver implemented
- [x] `deleteScheduler` resolver implemented

```
// create schedule appointments — manage appointment schedule templates
( Staff ) --> [ createScheduler ]
( Staff ) --> [ updateScheduler ]
( Staff ) --> [ deleteScheduler ]
```

### Date Identity

- [x] `updateDateIdentity` resolver implemented

```
// update the morning / afternoon allowed for that day only
( Staff ) --> [ updateDateIdentity ]
```

### Requirements Management

- [x] `updateScheduler Requirement` resolver implemented
- [x] `deleteScheduler Requirement` resolver implemented

```
( Staff ) --> [ updateScheduler Requirement ]
( Staff ) --> [ deleteScheduler Requirement ]
```

### Query Operations (Staff View)

- [x] `listAllOpenAppointment` resolver implemented
- [x] `listAllAppointmentSchedules` resolver implemented
- [x] `listAppointmentPreRequirement` resolver implemented
- [x] `listAppointmentIdentity` resolver implemented

```
( Staff ) --> [ listAllOpen Appointment ]
( Staff ) --> [ listAllAppointment Schedules ]
( Staff ) --> [ listAppointment PreRequirement ]
( Staff ) --> [ listAppointmentIdentity ]
```

### Appointment Response

- [x] `respondAppointmentRequest` resolver implemented
- [x] Approval / rejection logic wired to `<? Staff Approved? >`

```
( Staff ) --> [ respondAppointment Request ] --> <? Staff Approved? >
```

---

## Node Reference Table

| ID Suffix | Shape     | Label                                          | Role                              |
|-----------|-----------|------------------------------------------------|-----------------------------------|
| -1        | ELLIPSE   | Patient                                        | External entity / actor           |
| -2        | ELLIPSE   | Staff                                          | External entity / actor           |
| -15       | ELLIPSE   | End                                            | Terminal                          |
| -79       | ELLIPSE   | prevent multiple appointment                   | Business rule annotation          |
| -3        | RECTANGLE | listOpen Appointments                          | Process                           |
| -5        | RECTANGLE | listAppointment Schedules                      | Process                           |
| -6        | RECTANGLE | listAppointment Requirement                    | Process                           |
| -25       | RECTANGLE | entry patientSlot is logged "InProgress"       | Process                           |
| -38       | RECTANGLE | Appointment is Settled — status "scheduled"    | Process                           |
| -39       | RECTANGLE | Appointment status "completed"                 | Process                           |
| -48       | RECTANGLE | Appointment status "no-show"                   | Process                           |
| -57       | RECTANGLE | setAppointment Cancelled                       | Process                           |
| -62       | RECTANGLE | Submit Appointment Request                     | Process                           |
| -69       | RECTANGLE | Submit Requirements                            | Process                           |
| -75       | RECTANGLE | decayed "expired"                              | Process (auto timeout)            |
| -80       | RECTANGLE | AddEntryWhitelist                              | Staff operation                   |
| -81       | RECTANGLE | deleteEntryWhitelist                           | Staff operation                   |
| -82       | RECTANGLE | setCustomDates                                 | Staff operation                   |
| -83       | RECTANGLE | createScheduler                                | Staff operation                   |
| -84       | RECTANGLE | updateDateIdentity                             | Staff operation                   |
| -85       | RECTANGLE | updateScheduler                                | Staff operation                   |
| -86       | RECTANGLE | deleteScheduler                                | Staff operation                   |
| -87       | RECTANGLE | unsetCustomDates                               | Staff operation                   |
| -89       | RECTANGLE | updateScheduler Requirement                    | Staff operation                   |
| -91       | RECTANGLE | deleteScheduler Requirement                    | Staff operation                   |
| -92       | RECTANGLE | listAllOpen Appointment                        | Staff query                       |
| -93       | RECTANGLE | listAllAppointment Schedules                   | Staff query                       |
| -95       | RECTANGLE | listAppointment PreRequirement                 | Staff query                       |
| -96       | RECTANGLE | listAppointmentIdentity                        | Staff query                       |
| -97       | RECTANGLE | respondAppointment Request                     | Staff operation                   |
| -9        | DIAMOND   | patient finds an available Schedule?           | Decision                          |
| -19       | DIAMOND   | is the schedule open / still has slot?         | Decision                          |
| -30       | DIAMOND   | Staff Approved?                                | Decision                          |
| -42       | DIAMOND   | no show?                                       | Decision                          |
| -52       | DIAMOND   | cancelled?                                     | Decision                          |
| -64       | DIAMOND   | is there pre-requirements?                     | Decision                          |
