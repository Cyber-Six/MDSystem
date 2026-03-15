# Appointment Module

Handles appointment scheduling between patients and medical staff. Exposes **two separate GraphQL endpoints** — one for patients, one for medical staff — sharing the same schema but with different resolver subsets and authorization.

---

## Endpoints

| Endpoint | Middleware | Resolver |
|----------|-----------|----------|
| `POST /appointment/patient` | `jwtProtect("patient")` + `checkCredentialsStatus` | `patient-resolver.js` |
| `POST /appointment/medical` | `jwtProtect("medical")` | `medical-resolver.js` |

---

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `LOCATION_DESIGNATION` | `Arlegui`, `Casal`, `QuezonCity` |
| `SCHEDULING_STATUS` | `Pending`, `Scheduled`, `InProgress`, `Rejected`, `Expired`, `Completed`, `NoShow`, `CancelledByPatient`, `CancelledByMedical` |
| `SCHEDULE_SESSION` | `Morning`, `Afternoon` |
| `PATIENT_TYPE` | `Student`, `Employee` |

### Types

**SlotScheduler** (appointment slot configuration)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `label` | `String!` | e.g. "Medical Consultation", "Dental Consultation" |
| `location` | `LOCATION_DESIGNATION!` | Branch location |
| `patientType` | `PATIENT_TYPE` | Nullable — `null` means all types |
| `schedulePerWeek` | `[String!]!` | Days of the week (decoded from bitmask) |
| `morningAllowed` | `Int!` | Default morning slot capacity |
| `afternoonAllowed` | `Int!` | Default afternoon slot capacity |
| `notes` | `String` | |
| `isActive` | `Boolean!` | |
| `containsCustomDates` | `Boolean!` | Whether custom date overrides exist |
| `whitelistOnly` | `Boolean` | If true, only whitelisted patients can book |
| `created_at` | `Date` | |

**ScheduleDateEntity** (per-date schedule instance)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `slotId` | `ID!` | FK to `SlotScheduler` |
| `scheduledDate` | `Date!` | |
| `morningAllowed` / `afternoonAllowed` | `Int!` | Can override scheduler defaults |
| `morningRegistered` / `afternoonRegistered` | `Int!` | Computed: count of Scheduled/InProgress/Completed slots |
| `morningPending` / `afternoonPending` | `Int!` | Computed: count of Pending slots |
| `allowDuring` | `Boolean!` | |

**patientSlot** (a patient's appointment record)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `patientId` | `ID!` | |
| `patientIdentifier` | `Int` | Joined from `UsersPersonal` |
| `patientName` | `String` | Joined from `UsersPersonal` |
| `patientEmail` | `String` | Joined from `UserCredentials` |
| `slotEntityId` | `ID!` | FK to `ScheduleDateEntity` |
| `status` | `SCHEDULING_STATUS!` | |
| `session` | `SCHEDULE_SESSION!` | |
| `requirements` | `[patientScheduleRequirement!]!` | Submitted files |
| `approvedBy` | `String` | Staff name who responded |
| `notes` | `String` | |
| `arrived_at` | `Date` | When patient checked in |
| `rejection_acknowledged` | `Boolean` | |
| `created_at` | `Date!` | |

---

## Patient Queries

| Query | Parameters | Description |
|-------|------------|-------------|
| `listOpenAppointments` | `offset?, limit?` | Lists active schedulers visible to the patient (filtered by branch, patient type, whitelist) |
| `listCustomDates` | `schedulerId!, offset?, limit?` | Lists custom date overrides for a scheduler |
| `listAppointmentSchedule` | `schedulerId!, date!` | Gets the `ScheduleDateEntity` for a specific date. Creates the row if it doesn't exist. Enforces 7-day future timeframe |
| `listAppointmentRequirements` | `schedulerId!, offset?, limit?` | Lists active requirements for a scheduler |
| `getAppointmentStatus` | (none, uses JWT `user.id`) | Returns the patient's most recent appointment record |

## Patient Mutations

| Mutation | Parameters | Description |
|----------|------------|-------------|
| `submitAppointment` | `schedulerId!, date!, session!, requirements!` | Books an appointment. Validates no active appointment exists, checks capacity, promotes uploaded files, inserts `patientSlot` with status `Pending` |
| `cancelAppointment` | (none) | Cancels the patient's latest active appointment (status must be Pending/Scheduled/InProgress) |
| `acknowledgeRejection` | (none) | Sets `rejection_acknowledged = true` on any rejected slot |

---

## Medical Queries

| Query | Permission | Parameters | Description |
|-------|------------|------------|-------------|
| `getUserAppointmentStatus` | `appointment_allow_view_records` | `userId!` | Get latest appointment status for any patient |
| `getUserAppointmentRecords` | `appointment_allow_view_records` | `userId!, offset?, limit?` | List appointment records for a patient with details |
| `resolvePatientByIdentifier` | `appointment_allow_view_records` | `identifier!` | Look up patient ID from their identifier number |
| `listAllOpenAppointments` | `appointment_allow_view_configuration` | `offset?, limit?` | List all schedulers (no branch/type filtering) |
| `listAllAppointmentRequirements` | `appointment_allow_view_configuration` | `schedulerId!, offset?, limit?` | List all requirements (including inactive) |
| `searchAppointmentStatuses` | `appointment_allow_view_records` | `status!, offset?, limit?` | Search all appointment records by status |
| `getAppointmentStatusCounts` | `appointment_allow_view_records` | (none) | Counts of all records grouped by status |
| `listAppointmentSchedule` | `appointment_allow_view_configuration` | `schedulerId!, date!` | Same as patient version but skips timeframe validation |
| `listCustomDates` | `appointment_allow_view_configuration` | `schedulerId!, offset?, limit?` | List custom dates for a scheduler |

## Medical Mutations

### Appointment Response

| Mutation | Permission | Parameters | Description |
|----------|------------|------------|-------------|
| `respondAppointment` | `appointment_allow_approval` | `userId!, status!, notes?` | Approve/reject a patient's appointment. Validates state machine transitions. Emits socket notification |
| `recordAppointmentAttendance` | `appointment_allow_approval` | `slotId!, arrived_at!` | Records patient arrival. Status must be `Scheduled`. Sets status to `InProgress`. Emits socket notification |

### Scheduler Configuration

| Mutation | Permission | Parameters | Description |
|----------|------------|------------|-------------|
| `createScheduler` | `appointment_allow_edit_configuration` | `input: SlotSchedulerInput!` | Creates a scheduler with weekly schedule (bitmask), optional custom dates and whitelist (transaction) |
| `updateScheduler` | `appointment_allow_edit_configuration` | `schedulerId!, input!` | Dynamically updates scheduler fields |
| `deleteScheduler` | `appointment_allow_edit_configuration` | `schedulerId!` | Deletes scheduler (blocked if any patient slots reference it) |
| `updateSchedulerRequirement` | `appointment_allow_edit_configuration` | `schedulerId!, input!` | Upserts a requirement by label |
| `deleteSchedulerRequirement` | `appointment_allow_edit_configuration` | `schedulerId!, label!` | Deletes a requirement and its patient submissions |
| `setCustomDates` | `appointment_allow_edit_configuration` | `schedulerId!, dates!` | Batch-inserts custom dates |
| `unsetCustomDates` | `appointment_allow_edit_configuration` | `schedulerId!, dates!` | Batch-deletes custom dates |
| `addEntryWhitelist` | `appointment_allow_edit_configuration` | `schedulerId!, patientIds!` | Batch-adds patients to whitelist |
| `removeEntryWhitelist` | `appointment_allow_edit_configuration` | `schedulerId!, patientIds!` | Batch-removes patients from whitelist |
| `updateDateIdentity` | `appointment_allow_edit_configuration` | `schedulerId!, date!, input!` | Update a specific `ScheduleDateEntity` (capacity overrides, allowDuring flag) |

---

## State Machine

```
[submitAppointment]
        |
        v
     Pending ────[respondAppointment]───> Scheduled ──[recordAttendance]──> InProgress ──> Completed
        |                                     |                                 |
        |──> Rejected                         |──> CancelledByMedical           |──> NoShow
        |                                     |
        |──> CancelledByPatient               |──> NoShow
        |
        |──> CancelledByMedical
```

**Patient can cancel**: `Pending`, `Scheduled`, `InProgress` --> `CancelledByPatient`

**Medical transitions**:
| From | To |
|------|----|
| `Pending` | `Scheduled`, `Rejected` |
| `Scheduled` | `CancelledByMedical`, `NoShow` |
| `InProgress` | `Completed`, `NoShow` |

---

## Database Tables

### slotScheduler
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `label` | Text | Unique with location |
| `location` | Enum | `Arlegui`, `Casal`, `QuezonCity` |
| `patientType` | Enum (nullable) | `Student`, `Employee`, or null (all) |
| `scheduleFlags` | Int | Bitmask (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64) |
| `morningAllowed` | Int | Default morning capacity |
| `afternoonAllowed` | Int | Default afternoon capacity |
| `whitelistOnly` | Boolean | |
| `containsCustomDates` | Boolean | Synced flag |
| `notes` | Text (nullable) | |
| `isActive` | Boolean | |
| `created_at` | Timestamp | |

### ScheduleDateEntity
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `slotId` | FK | References `slotScheduler.id` |
| `scheduledDate` | Date | Unique with `slotId` |
| `morningAllowed` | Int | Can override scheduler default |
| `afternoonAllowed` | Int | Can override scheduler default |
| `allowDuring` | Boolean | |

### patientSlot
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `patientId` | FK | References `UsersPersonal.id` |
| `slotEntityId` | FK | References `ScheduleDateEntity.id` |
| `status` | Enum | Lifecycle state |
| `session` | Enum | `Morning` or `Afternoon` |
| `approvedBy` | FK (nullable) | Staff who responded |
| `notes` | Text (nullable) | |
| `arrived_at` | Timestamp (nullable) | |
| `rejection_acknowledged` | Boolean | |
| `created_at` | Timestamp | |

### patientScheduleRequirement
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `patientSlotId` | FK | References `patientSlot.id` |
| `scheduleRequirementId` | FK | References `scheduleRequirement.id` |
| `filename` | UUID | File on disk |
| `created_at` | Timestamp | |

### scheduleRequirement
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `slotId` | FK | References `slotScheduler.id` |
| `label` | Text | Unique per scheduler |
| `notes` | Text (nullable) | |
| `isDigital` | Boolean | |
| `isActive` | Boolean | |

### SlotCustomDate
| Column | Type |
|--------|------|
| `id` | PK |
| `slotScheduleId` | FK |
| `scheduledDate` | Date |

### schedulerWhitelist
| Column | Type |
|--------|------|
| `id` | PK |
| `slotSchedulerId` | FK |
| `patientId` | FK |

---

## Auth & Permissions

### Patient Endpoint
1. `jwtProtect("patient")` -- JWT validation, role check
2. `checkCredentialsStatus` -- blocks access unless `credentials_status = 'Active'`
3. Resolver uses `user.id` from JWT — patients can only act on their own data

### Medical Endpoint
1. `jwtProtect("medical")` -- JWT validation, medical identity DB check, Redis session anchor validation
2. Every resolver calls `permit.isMedicalPermitted(user.id, permission, patientId?)`
   - Admin bypass for `IS_ADMIN` role
   - Branch matching when `patientId` is provided
   - `PRIVILEGED_TO_PERFORM_ON_SUPERIOR` required for superior-identity patients

| Permission Key | Maps To | Used By |
|----------------|---------|---------|
| `appointment_allow_approval` | `ALLOW_TO_APPROVE_APPOINTMENT` | `respondAppointment`, `recordAppointmentAttendance` |
| `appointment_allow_view_records` | `ALLOW_TO_VIEW_APPOINTMENT` | All record-viewing queries |
| `appointment_allow_view_configuration` | `ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION` | All scheduler-viewing queries |
| `appointment_allow_edit_configuration` | `ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION` | All scheduler CRUD mutations |

---

## Socket Emissions

Two events emitted from the medical resolver via `notifyUser()`:

| Event | Trigger | Payload | Offline Handling |
|-------|---------|---------|-----------------|
| `appointment:responded` | `respondAppointment` | `{ status, notes, slotId }` | Queued in Redis + optional email |
| `appointment:attendance-recorded` | `recordAppointmentAttendance` | `{ slotId, arrived_at }` | Queued in Redis + optional email |

`notifyUser()` checks if the patient is online (Redis-backed, cross-node). If online, emits via Socket.IO to `user:{userId}`. If offline, pushes to `notif:pending:{userId}` (TTL 7 days, max 100 items) and optionally enqueues an email via BullMQ.

---

## Appointment Submission Flow (Patient)

```
1. Check no active appointment exists (Pending/Scheduled/InProgress)
2. Validate scheduler is open to patient (active, branch match, patient type, whitelist)
3. Validate date is within 7-day future window
4. Validate date falls on scheduler's weekly schedule or custom dates
5. Check session capacity (morning/afternoon not full)
6. Validate all required documents are provided
7. Promote uploaded files from staging to committed/appointment_requirements/
8. INSERT patientSlot (status = 'Pending')
9. INSERT patientScheduleRequirement rows
10. On failure: delete promoted files, return error
```

---

## File Upload Handling

- Files are first staged to `{MEDIA_PATH}/staging/` via the `/media` upload endpoint.
- During `submitAppointment`, each requirement file is promoted from staging to `{MEDIA_PATH}/committed/appointment_requirements/` via `promoteFile()`.
- On failure, cleanup calls `deleteFile()` for each promoted file.

---

## Seed Data

Six schedulers are seeded in `post_build_setup.sql`:

| Label | Location | Morning | Afternoon | Schedule |
|-------|----------|---------|-----------|----------|
| Medical Consultation | Arlegui | 20 | 15 | Mon-Sat |
| Medical Consultation | Casal | 25 | 20 | Mon-Sat |
| Medical Consultation | QuezonCity | 30 | 25 | Mon-Sat |
| Dental Consultation | Arlegui | 15 | 10 | Mon-Sat |
| Dental Consultation | Casal | 20 | 15 | Mon-Sat |
| Dental Consultation | QuezonCity | 25 | 20 | Mon-Sat |

---

## Helper Functions

| Function | Description |
|----------|-------------|
| `encodeSchedulingFlags(days)` | Converts day name array to bitmask (Mon=1, ..., Sun=64) |
| `decodeSchedulingFlags(flags)` | Converts bitmask back to day name array |
| `validateSchedulerDate(schedulerId, date)` | Checks date against weekly schedule + custom dates |
| `getAppointmentCounts(schedulerId, date)` | Counts registered/pending slots per session from `patientSlot` |
| `isWithinFutureTimeframe(date, nDays)` | Returns true if date is between today and today+N |
| `validateSatisfiedAllRequirements(scheduleId, requirements)` | Ensures submitted requirements match what the scheduler requires |
| `insertSlotCustomDates(slotScheduleId, dates, db)` | Batch-inserts custom dates (used in transaction) |
| `insertSchedulerWhitelist(slotSchedulerId, patientIds, db)` | Batch-inserts whitelist entries (used in transaction) |

---

## File Structure

```
routes/appointment/
  schema.graphql                                # Type definitions
  graphql.js                                    # Express GraphQL route setup (two endpoints)
  resolvers/
    patient/patient-resolver.js                 # Patient-facing resolvers
    medical/medical-resolver.js                 # Medical-facing resolvers (permission-checked)
    wrapper/wrapper.js                          # Shared database logic
    wrapper/helper.js                           # Utilities (flags, validation, counting)
```
