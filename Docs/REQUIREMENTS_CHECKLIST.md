# MDSystem Requirements Checklist

> Last updated: April 23, 2026
> Source: Doc meeting notes + dev backlog

---

## EMR / Initial Record

- [ ] **Req 1 – Redundant Data Consent (One-Time Only)**
  Remove data consent prompt once account has already been registered; only re-prompt when the consent version changes.
  > *Tagalog: Tanggalin yung data consent once na register na yung account; i-prompt ulit lang kapag nagbago ang version ng consent.*

- [ ] **Req 2 – EMR Revision: Pre-fill All Fields**
  During revision of an initial EMR record, all existing data must be pre-populated in the form fields.
  > *Tagalog: Para sa revision, make sure na pre-fill lahat ng data (for EMR).*

- [ ] **Req 3 – EMR Initial Record Revision Submission Error**
  Fix the logic bug where revision submission fails because a pending/existing record is detected incorrectly (false conflict on existing or pending record).
  > *Tagalog: I-fix yung unang bug sa EMR employee case — revision failure case (existing or pending already existed — logic bug).*

---

## Notifications & Email

- [ ] **Req 4 – Account Approval: Email & System Notification**
  All users receive both an in-system notification and an email notification when their account/initial record has been approved.
  > *Tagalog: Lahat ng users makakatanggap ng email notification kapag na-approve na ang kanilang account.*

- [ ] **Req 12 – Dental Grading Completion Notification**
  When a dentist finishes dental grading, the patient is notified (in-system and email) with the recommendation details (e.g., "Tooth filling – Tooth 24").
  > *Tagalog: Kapag natapos ng dentist ang dental grading, dapat ma-notify ang patient sa system at email tungkol sa recommendation (e.g., tooth filling tooth 24).*

---

## Records / Update

- [ ] **Req 5 – "Change Type" Renamed to Cancel**
  Rename the "Change Type" action to "Cancel" to allow patients to cancel a record update if they choose not to continue.
  > *Tagalog: Para sa change type sa record update, gawing cancelable kapag di na tutuloy ang patient.*

- [ ] **Req 6 – Record Update: Context for Medical vs. Dental**
  On the update records screen, provide clear context/guidance on when to use Medical vs. Dental record update.
  > *Tagalog: Para sa update, magbigay ng context kung kailan gagamitin ang medical at dental record update.*

- [ ] **Req 7 – Address Update in System**
  Record update must also update the address stored in the system.
  > *Tagalog: Para sa record update, need i-update din ang address sa system.*

- [ ] **Req 8a – Staff Notifies Student After Record Update**
  When staff updates a student's record, the student receives a notification that their record has been updated.
  > *Tagalog: Para sa update, dapat makatanggap ng notif ang student mula sa staff kapag na-update na yung record nila.*

---

## Student Classification / Year Level

- [ ] **Req 8b – Add "Returnee" Student Type**
  Add "Returnee" as a student classification option.
  > *Tagalog: Mag-add ng "Returnee" sa student types.*

- [ ] **Req 9 – Year Level on Student Profile**
  Add year level field to student records (Freshman, Sophomore, Junior, Senior, Returnee); always visible to staff.
  > *Tagalog: Mag-add ng year level sa students (e.g., Freshman, Sophomore, Junior, Senior, Returnee).*

- [ ] **Req 10 – Staff: Always Show Year Level**
  When staff searches or views a patient, their year level (e.g., Sophomore, Junior, Senior, Returnee) must always be displayed.
  > *Tagalog: Sa search patient, dapat makikita ni staff kung anong year level ng student (e.g., sophomore, junior, senior).*

---

## Analytics

- [ ] **Req 11 – Analytics: Student Type Graphs**
  Add analytics graphs showing total students filtered/grouped by student type: Freshman, Sophomore, Junior, Senior, Returnee.
  > *Tagalog: Mag-add ng analytics tungkol sa mga returnee, freshman, junior, sophomore, at senior.*

---

## Appointment

- [ ] **Req 13 – Specific Appointment Time Slots**
  Replace "Morning / Afternoon" availability with specific time slots per day (coordinate exact times with the clinic/docs — should come from the client, not developers).
  > *Tagalog: Para sa appointment, maglagay ng mga time availability sa mismong day — dapat specific ang oras, hindi lang "morning/afternoon". Ang gagawin na rules/schedule ay dapat galing sa clinic/docs mismo, hindi sa devs.*

---

## Prescription / Medical Documents

- [ ] **Req 14 – Add PTR Number to Prescriptions**
  Add PTR number field to prescription documents.
  > *Tagalog: Dagdag ng PTR number para sa prescription.*

- [ ] **Req 15 – PTR Number on All Papers**
  All official papers (Medical Certificate, Prescription, etc.) must include the PTR number.
  > *Tagalog: Lahat ng papers (e.g., medical cert, prescription) dapat may PTR number.*

- [ ] **Req 16 – Medical Clearance: Change Template**
  Update/redesign the Medical Clearance document template.
  > *Tagalog: Medical clearance — baguhin ang template.*

- [ ] **Req 17 – Rename "Diagnosis" to "Morbidity"**
  Rename all instances of "Diagnosis" to "Morbidity" across the system.
  > *Tagalog: I-rename ang "Diagnosis" sa "Morbidity" sa buong system.*

---

## Role Management / Activity Logs

- [ ] **Req 18 – Activity Log: Staff Account Management**
  Activity logs must record which staff member approved/managed a patient account and whose account was managed (admin-visible).
  > *Tagalog: Sa activity log, dapat malalaman ng admin kung sinong staff ang nag-approve kay patient at kanino.*

---

## Inventory

- [ ] **Req 19 – Automatic Stock Fallback (Casal → Arlegui)**
  When stock runs out at Casal, the system automatically draws from Arlegui inventory.
  > *Tagalog: Kapag wala na stock sa Casal, kukuha siya automatically sa Arlegui.*

- [ ] **Req 20 – Inventory Activity Logs**
  Log all inventory transactions: when released, who released it, to whom, and at what time.
  > *Tagalog: Activity logs sa inventory — kelan nirelease, sino nag-release, kanino, at anong oras.*

- [ ] **Req 21 – Downloadable Inventory Record**
  Provide a downloadable/printable inventory record document.
  > *Tagalog: Downloadable inventory record/paper.*

---

## Process / Documentation

- [ ] **Req 22 – Process Flowcharts for Every Process**
  Add process flowcharts (converted from use-case to flowchart) for every system process.
  > *Tagalog: Every processes lagyan lahat ng flowchart (use case to flowchart — process flowchart).*

- [ ] **Req 23 – Update SRS**
  Update the Software Requirements Specification to reflect all current requirements.
  > *Tagalog: Please update SRS!*

- [ ] **Req 24 – Objectives Section Completion**
  Complete the missing/incomplete objectives section in the system papers.
  > *Tagalog: Objectives kulang sa papers.*

---

## Pending / Needs Client Input

- [ ] **Req 25 – Payment Slip Method (Dental)**
  Interview dental staff/docs to clarify payment slip process and requirements before implementation.
  > *Tagalog: Need magpa-interview sa dental about sa payment slip method.*

- [ ] **Req 26 – Appointment Important Info Rules**
  Coordinate with clinic/docs for the exact rules and important information patients must follow for appointments (e.g., "Arrive 10 minutes early"). Content must come from the client.
  > *Tagalog: Yung important information na ibibigay sa patient (e.g., "arrive in 10 mins") dapat galing sa mismong client/docs — hindi sa devs. Dapat "specific" ang oras ng appointment.*

---

## Doc Meeting Talking Points

- [ ] What is the problem? / Ano ang problema?
- [ ] What is the goal? / Ano ang layunin?
- [ ] Explaining the system to stakeholders / Ipaliwanag ang sistema sa mga stakeholders

---

> **Note:** Requirements marked with client input dependencies (Req 25, Req 26) must not be implemented until sign-off is received from the clinic/docs.
