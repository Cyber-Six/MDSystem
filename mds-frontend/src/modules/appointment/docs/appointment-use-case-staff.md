## Use Case Name: Appointment Management and Consultation Handling
ID: UC-02.5
Priority: High
Actor: Medical Staff

Description: This use case allows authorized medical staff to view, verify, accept, or reject student appointment requests. The system manages appointment slots, validates required documents (OJT forms/lab workups, medical clearance requirements), supports optional online or face-to-face consultations, and displays pending and approved appointments.

Trigger: The staff accesses the appointment management system.

Type: External

### Preconditions:
* The staff is logged in.
* Appointment slots are defined (Medical default: 60 morning, 60 afternoon, Dental default: 1 morning, 1 afternoon).
* Students have submitted appointment requests.
* Consultation type (online or face-to-face) is already set for appointments.

### Normal Course:

1. The staff views pending appointment requests.
2. The staff selects an appointment request to review.
3. The staff verifies required documents:
- For OJT: QR form submitted one day before, lab workups (CVC, Chest X-ray, Drug Test).
- For medical clearance: only date/time selection required.
- For consultations: date/time and prefer consultation type.

4. The system checks slot availability(For medical clearance):
- If slot available  auto-accept appointment.
- If slot unavailable system prompts to reschedule.

5. The staff accepts or rejects the appointment request.
6. The system updates the appointment status (Pending to Approved or Rejected).
7. The system displays updated lists of pending and approved appointments for staff.

### Information for Steps:
1. → View appointment requests
2. ← Appointment list displayed

3. → Select appointment request to review
3. ← Appointment details displayed
3. → Verify required documents

4. → System checks slot availability


5. → Accept or reject appointment
6. ← Appointment status updated

7. ← Updated appointment lists


### Postconditions: 
* Appointment request status is updated to Approved or Rejected.
* Patients can view their pending or approved appointments.
* Slot adjustments are applied if necessary.
* Consultation type is recorded for the appointment.


## Summary

| Inputs | Source | Outputs | Destination |
|---|---|---|---|
| View pending appointments | Staff | Pending appointment list displayed | System |
| Select appointment request | Staff | Appointment details displayed | System |
| Verify required documents | Staff | Document validation status | System |
| Slot availability check | System | Slot availability / reschedule prompt | Staff |
| Accept or reject appointment | Staff | Appointment status updated | System |
| Updated appointments list | System | Pending and approved appointments displayed | Staff |
| Confirmation | System | Success message displayed | Staff |


