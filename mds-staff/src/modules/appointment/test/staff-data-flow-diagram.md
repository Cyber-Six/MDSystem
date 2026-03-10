# Staff Appointment Management — Data Flow Diagram

> Extracted from: `Appointment System.drawio.svg`
> Scope: Staff-side flows and operations only
> Last validated: 2026-03-10

## Symbol Legend

| Text Symbol      | Shape         | Meaning                                      |
|------------------|---------------|----------------------------------------------|
| `( Name )`       | Ellipse       | External Entity / Actor, or Terminal node    |
| `[ Name ]`       | Rectangle     | Process / Action step                        |
| `<? Question ?>` | Diamond       | Decision point (branches Yes / No)           |
| `-->`            | Arrow         | Data or control flow                         |
| `// text //`     | Annotation    | Description or business rule                 |

### Color Coding

| Color       | Tag          | Meaning                                                  |
|-------------|--------------|----------------------------------------------------------|
| **Green**   | `resolver`   | Triggered by a GraphQL resolver (manual / on-demand)     |
| **Purple**  | `auto`       | Automatic process (system-triggered, e.g. expiry timer)  |

---

## Actors

| Symbol              | Role                                                                  |
|---------------------|-----------------------------------------------------------------------|
| `( Staff )`         | Manages schedules, reviews and responds to appointment requests       |
| `( Patient )`       | Submits appointment requests (external, triggers the inbound flow)    |
| `( End )`           | Terminal — flow exits here                                            |

---

## Staff Appointment Response Flow

> When a patient submits an appointment request, Staff receives it for review.
> This is the staff-side perspective of Phases 4–6 of the full diagram.

### Inbound Request

- [x] Staff receives inbound appointment request notification
- [x] `respondAppointmentRequest` resolver implemented

```
( Patient ) --> [ Submit Appointment Request ]
                  --> ( Staff )                          // Staff Required
                  --> [ entry patientSlot is logged "InProgress" ]
                        |
                        |--> [ decayed "expired" ]       // auto (purple): if staff does not respond in time
                        |      --> ( End )
                        |
                        --> <? Staff Approved? >
```

### Staff Decision

- [x] Approval sets status to `"Scheduled"`
- [x] Rejection terminates the request → End

```
( Staff ) --> [ respondAppointment Request ]
                --> <? Staff Approved? >
                      -- No  --> ( End )
                      -- Yes --> [ Appointment is Settled  status "scheduled" ]
                                   --> <? cancelled? >
```

### Post-Schedule Tracking (Staff-side)

- [x] `setAppointment Cancelled` resolver implemented (green) — via `respondAppointment(status: CancelledByMedical)`
- [x] `Appointment status "completed"` resolver implemented (green) — via `respondAppointment(status: Completed)`
- [x] `Appointment status "no-show"` resolver implemented (green) — via `respondAppointment(status: NoShow)`
- [ ] `decayed "expired"` auto-process not yet automated (purple)

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

## Schedule Management Operations

All operations below are initiated by `( Staff )`.

### Whitelist Management

> Controls which patients may book specific schedules.

- [x] `AddEntryWhitelist` resolver implemented
- [x] `deleteEntryWhitelist` resolver implemented

```
( Staff ) --> [ AddEntryWhitelist ]
( Staff ) --> [ deleteEntryWhitelist ]
```

### Custom Date Management

> Override default schedule availability dates.

- [x] `setCustomDates` resolver implemented
- [x] `unsetCustomDates` resolver implemented

```
( Staff ) --> [ setCustomDates ]
( Staff ) --> [ unsetCustomDates ]
```

### Scheduler CRUD

> Create and manage appointment schedule templates.

- [x] `createScheduler` resolver implemented
- [x] `updateScheduler` resolver implemented
- [x] `deleteScheduler` resolver implemented

```
( Staff ) --> [ createScheduler ]
( Staff ) --> [ updateScheduler ]
( Staff ) --> [ deleteScheduler ]
```

### Date Identity

> Update the morning / afternoon slots allowed for a specific day only.

- [x] `updateDateIdentity` resolver implemented

```
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

---

## Complete Staff Flow (Single Linear Trace)

```
( Patient ) --> [ Submit Appointment Request ] --> ( Staff )

( Staff ) --> [ respondAppointment Request ]
                --> <? Staff Approved? >
                      -- No  --> ( End )
                      -- Yes --> [ Appointment is Settled  status "scheduled" ]
                                   --> <? cancelled? >
                                         -- Yes --> [ setAppointment Cancelled ] --> ( End )     // resolver (green)
                                         -- No  --> <? no show? >
                                                       -- No  --> [ Appointment status "completed" ] --> ( End )  // resolver (green)
                                                       -- Yes --> [ Appointment status "no-show" ]   --> ( End )  // auto (purple)
```

---

## Appointment Status State Machine (Staff View)

| Status              | Staff Action                                        | Result                    |
|---------------------|-----------------------------------------------------|---------------------------|
| `Pending`           | Patient submitted; awaiting staff response          | Review & respond          |
| `Scheduled`         | Staff approved the request                          | Appointment active        |
| `InProgress`        | Patient arrived (`recordAppointmentAttendance`)     | Active visit              |
| `Completed`         | Staff marks appointment fulfilled                   | Record closed             |
| `Rejected`          | Staff rejects the request                           | `( End )`                 |
| `Expired`           | Staff did not respond in time (auto)                | Slot released             |
| `CancelledByPatient`| Patient cancels their own appointment               | Appointment terminated    |
| `CancelledByMedical`| Staff cancels the appointment                       | Appointment terminated    |
| `NoShow`            | Patient did not attend                              | Record marked             |

---

## Implementation Checklist Summary

### Schedule Management Resolvers

- [x] `createScheduler`
- [x] `updateScheduler`
- [x] `deleteScheduler`
- [x] `setCustomDates`
- [x] `unsetCustomDates`
- [x] `updateDateIdentity`
- [x] `AddEntryWhitelist`
- [x] `deleteEntryWhitelist`
- [x] `updateSchedulerRequirement`
- [x] `deleteSchedulerRequirement`

### Appointment Response Resolvers

- [x] `respondAppointmentRequest`
- [x] `setAppointmentCancelled`

### Query Resolvers

- [x] `listAllOpenAppointment`
- [x] `listAllAppointmentSchedules`
- [x] `listAppointmentPreRequirement`
- [x] `listAppointmentIdentity`

### Status Transitions (Staff-side)

- [x] Approval → `"Scheduled"`
- [x] Rejection → `( End )`
- [ ] `decayed "expired"` auto-triggers when staff doesn't respond
- [x] `setAppointmentCancelled` → `"CancelledByMedical"`
- [x] `"Completed"` set post-appointment
- [x] `"NoShow"` set by staff when patient absent
