## Use Case Name: Patient Scheduling Appointment
ID: UC-04.1
Priority: High
Actor: Patient

Description: This use case allows a patient to schedule an appointment for various services. The system enforces specific rules and form requirements based on the appointment type (e.g., OJT, Clearance, or Dental) and then automatically accepts the appointment if the time slot is available.

Trigger: The patient selects the "Schedule an Appointment" option from their system dashboard.

Type: External

### Preconditions:
* The patient is logged in.
* The system's schedule of available staff/time slots is up-to-date.

### Normal Course:

1. The patient selects "Schedule an Appointment." 
2. The system displays the available appointment types: Medical Clearance, OJT, Screening, NSTP.
3. The user  selects the desired appointment type
4. The system displays the specific requirements for that type:  
- OJT : The system requires the user to fill out forms and attach lab workups (CVC, Chest X-ray, Drug Test). 
- Medical Clearance, Screening, NSTP : The system proceeds directly to time selection.

5. The system displays a calendar with available dates and time slots, enforcing all scheduling rules
6. The patient selects an available date and time. 
7. The patient clicks "Submit Appointment."
8. The system validates that the slot is still available and automatically accepts the appointment.
9. The system saves the new appointment with an "Approved" status.

### Information for Steps: (with respect/corresponding number to normal course)

1. -> Menu selection
2. <-Appointment type list

3. -> Selected appointment type
4. <- Dynamic form requirements



5. <- Available time slots

6. -> Selected date/time
7. <- Submit command
8. <- Auto-acceptance validation
9. <- Saved appointment record

### Postconditions:
* The new appointment is saved in the system with an "Approved" status.
* The selected time slot is now marked as "Unavailable" in the schedule.

## Summary

| Inputs | Source | Outputs | Destination |
|---|---|---|---|
| Selected Feature | Patient | Authenticated session | System |
| Appointment type selection | Patient | Displayed requirements and dynamic forms | User Interface |
| OJT Forms / Lab Workup | Patient | Validated documents | System |
| Date/Time selection | Patient | Available time slots | System |
| Submit appointment request | Patient | Approved appointment record and confirmation message | System Database & User Interface |


