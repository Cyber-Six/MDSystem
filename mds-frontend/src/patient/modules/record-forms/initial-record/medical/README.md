# Initial Medical Record Form

## Overview
This module implements a multi-step initial medical record form that users must complete after logging in for the first time before accessing the dashboard.

## Features
- **Multi-step Form**: 5 steps (4 for males) with progress tracking
- **Personal Information**: Basic user details and emergency contacts
- **Medical History**: Self and family medical conditions
- **Medical Background**: Immunizations, allergies, lifestyle, visual acuity
- **OB-GYNE History**: Female-only section for reproductive health
- **Review & Certification**: Summary and digital signature

## File Structure

```
mds-frontend/src/modules/record-forms/initial-record/medical/
├── initial-medical-record-form.jsx   # Main form controller
├── personal-info.jsx                  # Personal info and emergency contacts
├── medical-history.jsx                # Medical conditions (self & family)
├── medical-background.jsx             # Immunizations, allergies, lifestyle
├── obygyne.jsx                        # OB-GYNE history (female only)
├── review-form.jsx                    # Review and certification
├── progress-stepper.jsx               # Visual progress indicator
├── form-elements.jsx                  # Reusable form components
├── graphql-operations.js              # GraphQL queries and mutations
└── index.js                           # Module exports
```

## Form Steps

### Step 1: Personal Information
- **Required Fields**:
  - Full name (Surname, First Name, Middle Name)
  - Birthday, Age (auto-calculated), Gender
  - Civil Status, Nationality
  - Address, Contact Number
  - Program, Department, Student Number
  - Two emergency contacts (Name, Relationship, Contact Number)

### Step 2: Medical History
- **Tabs**:
  - **Yourself**: Checkboxes for 16 common conditions
  - **Family**: Same conditions with relationship field

- **Conditions**:
  - Heart Condition
  - High Blood Pressure
  - Epilepsy/Seizure
  - Psychiatric Illness
  - Bronchial Asthma
  - Diabetes (Type I & II)
  - Hepatitis (A, B, C, D, E)
  - Amoebiasis
  - Tuberculosis
  - Typhoid Fever
  - Malaria

### Step 3: Medical Background
Accordion sections for:
- **Immunizations**: BCG, Chickenpox, HPV, Hepatitis A/B, MMR, Anti-Tetanus
- **Allergies**: Drug, Food, Other
- **Medical Background**: Hospitalizations, Operations, Medications
- **Body Modifications**: Tattoo, Piercing locations
- **Lifestyle**: Smoking, Alcohol consumption
- **Visual Acuity**: Eyeglasses, Contact Lenses, Eye grades
- **Physical Measurements**: Height, Weight

### Step 4: OB-GYNE History (Female Only)
- Menarche (year/age)
- Menstruation Duration
- Dysmenorrhea (Yes/No)

### Step 5: Review & Certification
- Summary of all entered data
- Edit button for each section
- Certification checkbox
- Digital signature (typed name)
- Date

## GraphQL Integration

### Queries
- `CHECK_MEDICAL_RECORD_STATUS`: Check if user has completed EMR
- `GET_MEDICAL_HISTORY`: Retrieve medical history
- `GET_LIFESTYLE`: Get lifestyle information
- `GET_OBGYN_HISTORY`: Get OB-GYNE data
- `GET_IMMUNIZATION_PROFILE`: Get immunizations
- `GET_ALLERGY_PROFILE`: Get allergies

### Mutations
- `CREATE_STUDENT_PROFILE`: Create student profile
- `CREATE_EMPLOYEE_PROFILE`: Create employee profile
- `CREATE_EMERGENCY_CONTACT`: Save emergency contacts
- `CREATE_MEDICAL_HISTORY`: Save medical conditions
- `CREATE_LIFESTYLE`: Save lifestyle data
- `CREATE_OBGYN_HISTORY`: Save OB-GYNE data
- `CREATE_IMMUNIZATION_PROFILE`: Save immunizations
- `CREATE_ALLERGY_PROFILE`: Save allergies
- `CREATE_MEDICATION_PROFILE`: Save medications
- `CREATE_HOSPITALIZATION_PROFILE`: Save hospitalizations
- `CREATE_OPERATION_PROFILE`: Save operations
- `CREATE_VISUAL_ACUITY_PROFILE`: Save visual acuity

## Routing

- **Route**: `/initial-medical-record`
- **Protection**: Requires authentication (wrapped in `PrivateRoute`)
- **Redirect**: After login, users without completed EMR are sent here

## Login Flow

1. User logs in successfully
2. System checks if user has completed initial medical record
3. If **not completed**: Redirect to `/initial-medical-record`
4. If **completed**: Redirect to `/` (dashboard)

## Form Behavior

### Navigation
- **Next Button**: Validates current step before proceeding
- **Back Button**: Allows returning to previous steps
- **Smart Skip**: OB-GYNE step automatically skipped for males
- **Step Counter**: Adjusts based on gender (4 steps for males, 5 for females)

### Validation
- **Step 0**: All personal info fields and 2 emergency contacts required
- **Steps 1-3**: Optional (no validation)
- **Step 4**: Certification checkbox and signature required

### Submission
- Form data logged to console (TODO: implement GraphQL mutation)
- Success message displayed
- Redirect to dashboard

## Styling

All styles are in `src/styles/index.css`:
- `.form-label`: Input labels
- `.form-input`: Text inputs, selects, textareas
- `.form-checkbox`: Checkboxes
- `.form-section`: Form section containers
- `.progress-step`: Step indicator circles
- `.btn-primary`, `.btn-secondary`, `.btn-outline`: Button variants

## Data Structure

```javascript
{
  personalInfo: {
    surname, firstName, middleName,
    birthday, age, gender, civilStatus,
    nationality, religion, address, contactNumber,
    program, department, studentNumber,
    emergencyContacts: [
      { name, relationship, contactNumber },
      { name, relationship, contactNumber }
    ]
  },
  medicalHistory: {
    self: { condition1: boolean, ... },
    family: { condition1: { checked: boolean, relationship: string }, ... }
  },
  medicalBackground: {
    immunizations: { bcg: boolean, chickenpox: boolean, ... },
    drugAllergy, foodAllergy, otherAllergy,
    hospitalizations, operations, maintenanceMedications,
    tattooLocation, piercingLocation,
    smoker, smokerSticksPerDay, smokerYears,
    alcoholDrinker, alcoholFrequency,
    eyeglasses, contactLenses, gradeOD, gradeOS, visualAcuityDate,
    height, weight
  },
  obgyne: {
    menarcheYearAge, menstruationDuration, dysmenorrhea
  },
  certification: {
    verified, fullName, signature, date
  }
}
```

## TODOs

1. **Backend Integration**:
   - Connect GraphQL mutations to actual backend
   - Implement profile completion check
   - Handle API errors gracefully

2. **Form Enhancements**:
   - Add field-level validation
   - Implement auto-save (draft mode)
   - Add file upload for documents
   - Implement progress persistence

3. **UX Improvements**:
   - Add tooltips for medical terms
   - Include help text for each section
   - Add loading states
   - Implement form field hints

4. **Security**:
   - Sanitize all inputs
   - Implement CSRF protection
   - Add data encryption for sensitive info

## Usage Example

```jsx
import { InitialMedicalRecordForm } from '@/modules/record-forms/initial-record/medical';

// In routing
<Route 
  path="/initial-medical-record" 
  element={
    <PrivateRoute>
      <InitialMedicalRecordForm />
    </PrivateRoute>
  } 
/>
```

## Alignment with GraphQL Schema

This form aligns with the backend GraphQL schema:
- `StudentProfile` / `EmployeeProfile`
- `EmergencyContact`
- `MedicalHistory`
- `Lifestyle`
- `ObgynHistory`
- `ImmunizationProfile`
- `AllergyProfile`
- `MedicationProfile`
- `HospitalizationProfile`
- `OperationProfile`
- `VisualAcuityProfile`

All input structures match the backend `Input` types.
