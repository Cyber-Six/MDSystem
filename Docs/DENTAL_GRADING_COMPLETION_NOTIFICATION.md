# Dental Grading Completion Notification

Last updated: April 24, 2026

## Objective

When a dentist/staff finishes dental grading for a patient, notify that same patient with recommendation details.

Required behavior:
- If patient is online: send in-system notification.
- If patient is offline: send email notification.
- Notification is patient-specific (only the graded patient receives it).

---

## Implemented Location

Backend trigger and delivery logic:
- Backend/routes/staff/emr/mutation.js

Triggered after successful dental grading save in both flows:
- createDentalRecord(patientId, input)
- updateDentalRecord(id, input)

---

## Flow

1. Staff saves dental grade (create/update dental record).
2. Backend builds recommendation details from ToothPlacements.
3. Backend prepares patient-friendly title/message.
4. Backend checks patient online state.
5. Delivery decision:
- online -> emit in-system event staff:notification
- offline -> enqueue notification email

---

## Recommendation Detail Formatting

Recommendation detail format:
- <Recommendation label> - Tooth <FDI number>

Example:
- Tooth filling - Tooth 24

Legend-to-label mapping includes:
- DUE_FILLING_DECAYED -> Tooth filling
- DUE_EXTRACTION -> Tooth extraction
- ROOT_FRAGMENT -> Root fragment treatment
- MISSING -> Missing tooth management
- FILLED -> Existing filling
- GOLD_CROWN -> Gold crown
- JACKET_CROWN -> Jacket crown
- ABUTMENT -> Abutment
- PONTIC -> Pontic
- FIXED_BRIDGE -> Fixed bridge
- REMOVABLE_DENTURE -> Removable denture
- FULL_DENTURE -> Full denture

Message summarization:
- Shows up to 8 recommendation items inline.
- If more than 8, appends: "and N more recommendations."

---

## Notification Content (Patient-Facing)

Title:
- Dental Grading Completed

Body template:
- Your dentist has completed your dental grading. Recommendation details: <summary>

Good example body:
- Your dentist has completed your dental grading. Recommendation details: Tooth filling - Tooth 24; Tooth extraction - Tooth 36.

Why this wording works:
- States what happened (grading completed).
- States why patient was notified (new recommendations exist).
- Includes concrete actionable context (tooth number + recommendation).

---

## Targeting and Safety

Targeting:
- Uses patientId from the saved dental record operation.
- Sends to only that specific patient.

Resilience:
- Notification block is wrapped in try/catch.
- Grading save is not rolled back if notification/email fails.
- Logs delivery path (in_system or email).

---

## Notes for Frontend

No frontend API changes are required because patient clients already handle:
- in-system staff:notification event
- structured title/body payload parsing for display

---

## Manual QA Checklist

1. Login as staff/dentist and open a patient dental grade.
2. Mark at least one recommendation (example: for filling on tooth 24).
3. Save grade.
4. While patient is online, verify in-system notification appears.
5. Logout patient (offline), save another grade change, verify email arrives.
6. Verify message contains recommendation details and tooth numbers.

---

## Future Improvements (Optional)

- Add dental-specific event name (example: dental:grading:completed) if product wants dedicated module filtering/sounds.
- Add clickable CTA link in email to open patient dental record page directly.
- Track notification acknowledgement for this flow if reporting is required.
