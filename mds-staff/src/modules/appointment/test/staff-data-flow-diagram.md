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

- [ ] Staff receives inbound appointment request notification
- [ ] `respondAppointmentRequest` resolver implemented

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

- [ ] Approval sets status to `"scheduled"`
- [ ] Rejection terminates the request → End

```
( Staff ) --> [ respondAppointment Request ]
                --> <? Staff Approved? >
                      -- No  --> ( End )
                      -- Yes --> [ Appointment is Settled  status "scheduled" ]
                                   --> <? cancelled? >
```

### Post-Schedule Tracking (Staff-side)

- [ ] `setAppointment Cancelled` resolver implemented (green)
- [ ] `Appointment status "completed"` resolver implemented (green)
- [ ] `Appointment status "no-show"` auto-process implemented (purple)

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

- [ ] `AddEntryWhitelist` resolver implemented
- [ ] `deleteEntryWhitelist` resolver implemented

```
( Staff ) --> [ AddEntryWhitelist ]
( Staff ) --> [ deleteEntryWhitelist ]
```

### Custom Date Management

> Override default schedule availability dates.

- [ ] `setCustomDates` resolver implemented
- [ ] `unsetCustomDates` resolver implemented

```
( Staff ) --> [ setCustomDates ]
( Staff ) --> [ unsetCustomDates ]
```

### Scheduler CRUD

> Create and manage appointment schedule templates.

- [ ] `createScheduler` resolver implemented
- [ ] `updateScheduler` resolver implemented
- [ ] `deleteScheduler` resolver implemented

```
( Staff ) --> [ createScheduler ]
( Staff ) --> [ updateScheduler ]
( Staff ) --> [ deleteScheduler ]
```

### Date Identity

> Update the morning / afternoon slots allowed for a specific day only.

- [ ] `updateDateIdentity` resolver implemented

```
( Staff ) --> [ updateDateIdentity ]
```

### Requirements Management

- [ ] `updateScheduler Requirement` resolver implemented
- [ ] `deleteScheduler Requirement` resolver implemented

```
( Staff ) --> [ updateScheduler Requirement ]
( Staff ) --> [ deleteScheduler Requirement ]
```

### Query Operations (Staff View)

- [ ] `listAllOpenAppointment` resolver implemented
- [ ] `listAllAppointmentSchedules` resolver implemented
- [ ] `listAppointmentPreRequirement` resolver implemented
- [ ] `listAppointmentIdentity` resolver implemented

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

| Status        | Staff Action                                 | Result                    |
|---------------|----------------------------------------------|---------------------------|
| `InProgress`  | Patient submitted; awaiting staff response   | Review & respond          |
| `expired`     | Staff did not respond in time (auto)         | Slot released             |
| `scheduled`   | Staff approved the request                   | Appointment active        |
| `cancelled`   | Staff or patient cancels                     | Appointment terminated    |
| `no-show`     | Patient did not attend (auto)                | Record marked             |
| `completed`   | Appointment fulfilled                        | Record closed             |

---

## Implementation Checklist Summary

### Schedule Management Resolvers

- [ ] `createScheduler`
- [ ] `updateScheduler`
- [ ] `deleteScheduler`
- [ ] `setCustomDates`
- [ ] `unsetCustomDates`
- [ ] `updateDateIdentity`
- [ ] `AddEntryWhitelist`
- [ ] `deleteEntryWhitelist`
- [ ] `updateSchedulerRequirement`
- [ ] `deleteSchedulerRequirement`

### Appointment Response Resolvers

- [ ] `respondAppointmentRequest`
- [ ] `setAppointmentCancelled`

### Query Resolvers

- [ ] `listAllOpenAppointment`
- [ ] `listAllAppointmentSchedules`
- [ ] `listAppointmentPreRequirement`
- [ ] `listAppointmentIdentity`

### Status Transitions (Staff-side)

- [ ] Approval → `"scheduled"`
- [ ] Rejection → `( End )`
- [ ] `decayed "expired"` auto-triggers when staff doesn't respond
- [ ] `setAppointmentCancelled` → `"cancelled"`
- [ ] `"completed"` set post-appointment
- [ ] `"no-show"` auto-set when patient absent
