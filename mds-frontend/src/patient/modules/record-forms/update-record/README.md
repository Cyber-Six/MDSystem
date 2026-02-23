# Update Record Module

This module provides a comprehensive form system for users to update their medical and dental records. It implements a multi-step form with validation, state management, and GraphQL integration for seamless record updates.

## Overview

The update-record module handles:
- **Medical Record Updates** - Update patient medical history and information
- **Dental Record Updates** - Update patient dental history and information
- **Combined Updates** - Update both medical and dental records in a single form submission
- **Personal Information** - Update personal details alongside record updates

## File Structure

### Core Components

| File | Purpose |
|------|---------|
| **record-update-form.jsx** | Main form container component that orchestrates the entire multi-step form flow. Manages form state, current step tracking, and navigation between steps. |
| **progress-stepper.jsx** | Visual progress indicator showing which step the user is currently on, with completed step indicators and styling. |
| **record-choice-page.jsx** | Full-page selection interface where users choose what type of record they want to update (Medical, Dental, or Both). Replaces the modal version. |

### Form Steps

| File | Purpose |
|------|---------|
| **personal-info-step.jsx** | First form step for updating personal information (name, contact details, etc.). |
| **medical-history-step.jsx** | Step for updating medical history information (diagnoses, medications, conditions, etc.). |
| **dental-history-step.jsx** | Step for updating dental history information (dental conditions, treatments, etc.). |
| **review-step.jsx** | Final review step displaying all entered information before submission. |

### UI & Helper Components

| File | Purpose |
|------|---------|
| **form-elements.jsx** | Reusable form input components and styled form elements used across all steps. |

### Service & API Integration

| File | Purpose |
|------|---------|
| **update-record-service.jsx** | Main service handling GraphQL mutations for creating/updating medical and dental records. Manages API communication and error handling. |
| **personal-info-service.jsx** | Service for personal information updates through GraphQL. |
| **medical-history-service.jsx** | Service for medical history record updates through GraphQL. |
| **dental-history-service.jsx** | Service for dental history record updates through GraphQL. |

## Form Flow

```
Record Update Form
  ├── Record Choice Modal
  ├── Step 1: Personal Info
  ├── Step 2: Medical History (conditional)
  ├── Step 3: Dental History (conditional)
  └── Final Step: Review & Submit
```

The form dynamically builds steps based on the user's record type selection:
- **Medical Only**: Personal Info → Medical History → Review
- **Dental Only**: Personal Info → Dental History → Review
- **Both**: Personal Info → Medical History → Dental History → Review

## Usage

This module is used in the **Dashboard** to allow patients to update their medical and dental information.

### Import Example
```jsx
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';

// Then render in your component
<RecordUpdateForm />
```

### Used By
- [Dashboard.jsx](../../pages/Dashboard.jsx) - Main dashboard page imports and renders the RecordUpdateForm component

## Key Features

- **Multi-step Form Navigation** - Users progress through form steps with next/back buttons
- **Conditional Steps** - Medical and dental steps only appear based on user selection
- **State Management** - Form data is accumulated across steps and stored until submission
- **GraphQL Integration** - Uses GraphQL mutations to communicate with the backend
- **Validation** - Form validation on each step before proceeding
- **Progress Tracking** - Visual progress indicator shows current step and completion status
- **Responsive Design** - Tailwind CSS styling for mobile and desktop views

## API Endpoints Used

- `/emr/patient` - GraphQL endpoint for medical/dental record updates

## Dependencies

- React 18+
- Tailwind CSS (for styling)
- axios (via packages-core-adapter)
- GraphQL (queries & mutations)

## Component Hierarchy

```
RecordUpdateForm
├── ProgressStepper
├── RecordChoicePage
└── Step Components (dynamic)
    ├── PersonalInfoStep
    ├── MedicalHistoryStep (conditional)
    ├── DentalHistoryStep (conditional)
    └── ReviewStep
```

## State Management

The RecordUpdateForm maintains:
- `currentStep` - Index of the current form step
- `formData` - Accumulated form data from all steps
- `isSubmitting` - Loading state during form submission
- `recordType` - Type of record being updated ('medical', 'dental', or 'both')
