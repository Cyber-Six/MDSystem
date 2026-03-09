# Patient Appointment Flow — Data Flow Diagram

> Extracted from: `Appointment System.drawio.svg`
> Scope: Patient-side flows only
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

| Symbol              | Role                                                      |
|---------------------|-----------------------------------------------------------|
| `( Patient )`       | Initiates appointment requests; browses available schedules |
| `( Staff )`         | Receives and responds to appointment requests (external)   |
| `( End )`           | Terminal — flow exits here                                 |

---

## Phase 1 — Schedule Discovery

> Patient browses available appointment schedules, dates, and requirements.

- [ ] `listOpenAppointments` resolver implemented
- [ ] `listAppointmentSchedules` resolver implemented
- [ ] `listAppointmentRequirement` resolver implemented

```
( Patient )
  --> [ listOpen Appointments ]               // resolver (green) — get available appointment schedules for the patient
        --> [ listAppointment Schedules ]      // resolver (green) — get available dates for a schedule for the patient
              --> [ listAppointment Requirement ]   // resolver (green) — get requirements before scheduling the patient
                    --> <? patient finds a available Schedule? >
```

---

## Phase 2 — Schedule Availability Check

> System validates that the schedule exists and has open slots.

- [ ] Frontend correctly handles "no available schedule" → End
- [ ] Frontend correctly handles "schedule closed / no slot" → End

```
<? patient finds a available Schedule? >
  -- No  --> ( End )
  -- Yes --> <? is the schedule open / still has slot? >
                  -- No  --> ( End )
                  -- Yes --> <? is there pre requirements? >
```

---

## Phase 3 — Pre-Requirements Gate

> If the schedule has pre-requirements, the patient must submit them before booking.

- [ ] `Submit Requirements` resolver implemented (green)
- [ ] `Submit Appointment Request` resolver implemented (green)
- [ ] Pre-requirements correctly gate the submission flow

```
<? is there pre requirements? >
  -- No  --> [ Submit Appointment Request ]        // resolver (green)
  -- Yes --> [ Submit Requirements ]               // resolver (green)
               --> [ Submit Appointment Request ]  // resolver (green)
```

---

## Phase 4 — Submission & Logging

> Request is sent to Staff. The patient's slot is held as "InProgress".
> If Staff does not respond within the time window, the slot auto-expires.

- [ ] Patient slot logged as `"InProgress"` on submission
- [ ] `decayed "expired"` auto-process triggers on timeout (purple)
- [ ] Request forwarded to Staff for review
- [ ] `( prevent multiple appointment )` business rule enforced

```
[ Submit Appointment Request ]
  --> ( Staff )                                     // Staff Required — request forwarded for review
  --> [ entry patientSlot is logged "InProgress" ]
        |
        |--> [ decayed "expired" ]                  // auto (purple): slot expires if staff does not respond
        |      --> ( End )
        |
        --> <? Staff Approved? >
```

---

## Phase 5 — Staff Decision (patient perspective)

> Patient waits. Staff either approves or rejects.

- [ ] Patient receives notification on approval
- [ ] Patient receives notification on rejection → End

```
<? Staff Approved? >
  -- No  --> ( End )
  -- Yes --> [ Appointment is Settled  status "scheduled" ]
               --> <? cancelled? >
```

---

## Phase 6 — Post-Schedule Status Tracking

> After the appointment is scheduled, it can be cancelled, completed, or marked no-show.

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

## Complete Patient Flow (Single Linear Trace)

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

## Appointment Status State Machine (Patient View)

| Status        | Trigger                                     | What Patient Sees          |
|---------------|---------------------------------------------|----------------------------|
| `InProgress`  | Patient submits appointment request         | "Awaiting staff approval"  |
| `expired`     | No staff response within time limit (auto)  | "Request expired"          |
| `scheduled`   | Staff approves request                      | "Appointment confirmed"    |
| `cancelled`   | Cancellation by staff or patient            | "Appointment cancelled"    |
| `no-show`     | Patient did not attend                      | "Marked as no-show"        |
| `completed`   | Appointment successfully fulfilled          | "Appointment completed"    |

---

## Business Rule

```
( prevent multiple appointment )
// A patient may not hold more than one active (InProgress / scheduled) appointment at a time.
```

---

## Implementation Checklist Summary

### Resolvers (Patient-facing)

- [ ] `listOpenAppointments` — list open appointment schedules
- [ ] `listAppointmentSchedules` — list available dates for a schedule
- [ ] `listAppointmentRequirement` — list pre-requirements
- [ ] `submitRequirements` — submit pre-requirements
- [ ] `submitAppointmentRequest` — submit the appointment request

### Status Transitions

- [ ] Slot logged as `"InProgress"` on submission
- [ ] `decayed "expired"` auto-triggers on staff timeout
- [ ] `"scheduled"` set on staff approval
- [ ] `setAppointmentCancelled` transitions to `"cancelled"`
- [ ] `"completed"` set when appointment fulfilled
- [ ] `"no-show"` auto-set when patient doesn't attend

### Business Rules

- [ ] Prevent multiple active appointments per patient
- [ ] Pre-requirements gate enforced before submission
