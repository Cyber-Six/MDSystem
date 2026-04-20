import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressStepper from './progress-stepper';
import PersonalInfoForm from './personal-info';
import MedicalHistoryForm from './medical-history';
import MedicalBackgroundForm from './medical-background';
import DentalHistoryForm from './dental-history';
import OBGYNEForm from './obygyne';
import ReviewForm from './review-form';
import { Button } from './form-elements';
import ValidationWarningModal from '@core/components/modals/validation-warning-modal';
import { createInitialMedicalRecord, fetchAllCatalogs, ensureUpdateTicket } from '@core/services/emr-service';
import { sanitizeFormData, logDataStructure } from '@core/utils/data-transformer';

/**
 * Initial Medical Record Form Component
 * Can be used as a standalone page or within a modal
 * 
 * @param {Object} props
 * @param {Function} props.onComplete - Optional callback when form is successfully submitted
 * @param {boolean} props.isModal - Whether the form is displayed in a modal (affects styling)
 */
const InitialMedicalRecordForm = ({ onComplete, isModal = false, revisionData = null, isRevision = false, staffNote = null }) => {
  const navigate = useNavigate();
  const formContentRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [dbErrors, setDbErrors] = useState([]);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState(null);

  // Catalog data fetched from the backend to populate form options dynamically
  const [catalogs, setCatalogs] = useState({
    medicalConditionCatalog: [],
    hospitalizationCatalog: [],
    operationCatalog: [],
    medicationCatalog: [],
    immunizationCatalog: [],
    allergenCatalog: [],
    oralApplianceCatalog: [],
    dentalProcedureCatalog: [],
    catalogsLoading: true,
    catalogsError: null,
  });

  useEffect(() => {
    fetchAllCatalogs()
      .then((cats) => setCatalogs({ ...cats, catalogsLoading: false, catalogsError: null }))
      .catch((err) => {
        console.warn('[Initial Record Form] Catalog fetch failed:', err.message);
        setCatalogs((prev) => ({ ...prev, catalogsLoading: false, catalogsError: err.message }));
      });
  }, []);

  // Create the update ticket early so mid-form actions (e.g. adding a custom vaccine)
  // that require an active ticket don't fail. For revisions, a ticket already exists.
  useEffect(() => {
    if (!isRevision) {
      ensureUpdateTicket('Both').then((id) => {
        if (id) console.log('[Initial Record Form] Early update ticket ready:', id);
      });
    }
  }, [isRevision]);

  // When revision pre-fill data arrives, merge it into the form state
  useEffect(() => {
    if (!revisionData) return;
    console.log('[Initial Record Form] Applying revision pre-fill data...');
    setFormData((prev) => ({
      ...prev,
      personalInfo:      { ...prev.personalInfo,      ...revisionData.personalInfo },
      medicalHistory:    { ...prev.medicalHistory,    ...revisionData.medicalHistory },
      medicalBackground: { ...prev.medicalBackground, ...revisionData.medicalBackground },
      dentalHistory:     { ...prev.dentalHistory,     ...revisionData.dentalHistory },
      ...(revisionData.obgyne ? { obgyne: { ...prev.obgyne, ...revisionData.obgyne } } : {}),
    }));
  }, [revisionData]);

  console.log('[Initial Medical Record Form] Component rendered, current step:', currentStep);

  const steps = ['Personal Info', 'Medical History', 'Medical Background', 'Dental History', 'OB-GYNE', 'Review'];

  // Initialize form data state
  const [formData, setFormData] = useState({
    personalInfo: {
      surname: '',
      firstName: '',
      middleName: '',
      suffix: '',
      birthday: '',
      age: '',
      gender: '',
      civilStatus: '',
      nationality: '',
      religion: '',
      address: '',
      provinceAddress: '',
      contactNumber: '',
      program: '',
      programId: '',
      studentNumber: '',
      studentCategory: '',
      lastSchoolAttended: '',
      drugTestDone: '',
      emergencyContacts: [
        { name: '', relationship: '', contactNumber: '', address: '' },
        { name: '', relationship: '', contactNumber: '', address: '' }
      ]
    },
    medicalHistory: {
      self: {},
      family: {}
    },
    medicalBackground: {
      // Immunizations — keys are vaccine catalog IDs
      immunizations: {},
      immunizationDates: {},
      immunizationOther: '',
      // Allergies — keys are allergen catalog IDs
      hasAllergies: '',
      allergies: {},
      allergyOther: '',
      // Hospitalizations — keys are hospitalization condition catalog IDs
      hasHospitalization: '',
      hospitalizationConditions: {},
      hospitalizationDates: {},
      hospitalizationNotes: '',
      // Operations — keys are operation procedure catalog IDs
      hasOperation: '',
      operationConditions: {},
      operationDates: {},
      operationNotes: '',
      // Medications — keys are medication catalog IDs
      hasMedications: '',
      selectedMedications: {},
      medicationReason: '',
      medicationNotes: '',
      // Lifestyle
      smoker: 'no',
      smokerSticksPerDay: '',
      smokerYears: '',
      alcoholDrinker: 'no',
      alcoholFrequency: '',
      vaper: 'no',
      vapeType: '',
      vapeFrequency: '',
      yearsVaping: null,
      // Visual Acuity
      eyeglasses: false,
      contactLenses: false,
      gradeOD: '',
      gradeOS: '',
      gradeODEyeglasses: '',
      gradeOSEyeglasses: '',
      gradeODContactLenses: '',
      gradeOSContactLenses: '',
      visualAcuityDate: '',
    },
    dentalHistory: {
      firstTimeDentist: '',
      lastDentalConsultation: '',
      lastDentalCleaning: '',
      hasIntraOralAppliance: '',
      intraOralAppliances: {},
      applianceLocation: '',
      selectedDentalProcedures: {},
      upperTeethPhoto: null,
      lowerTeethPhoto: null
    },
    obgyne: {
      lastMenstrualPeriod: '',
      menstruationDuration: '',
      dysmenorrhea: ''
    },
    certification: {
      verified: false,
      fullName: '',
      signature: '',
      date: ''
    }
  });

  const handlePersonalInfoChange = (data) => {
    console.log('[Initial Medical Record Form] Personal info updated:', data);
    setFormData({ ...formData, personalInfo: data });
  };

  const handleMedicalHistoryChange = (data) => {
    console.log('[Initial Medical Record Form] Medical history updated:', data);
    setFormData({ ...formData, medicalHistory: data });
  };

  const handleMedicalBackgroundChange = (data) => {
    console.log('[Initial Medical Record Form] Medical background updated:', data);
    setFormData({ ...formData, medicalBackground: data });
  };

  const handleDentalHistoryChange = (data) => {
    console.log('[Initial Medical Record Form] Dental history updated:', data);
    setFormData({ ...formData, dentalHistory: data });
  };

  const handleOBGYNEChange = (data) => {
    console.log('[Initial Medical Record Form] OB-GYNE updated:', data);
    setFormData({ ...formData, obgyne: data });
  };

  const handleCertificationChange = (data) => {
    console.log('[Initial Medical Record Form] Certification updated:', data);
    setFormData({ ...formData, certification: data });
  };

  /**
   * Validates a Philippine phone number.
   * Accepts:
   *   - Local mobile/landline starting with 0  → 0XXXXXXXXXX  (11 digits)
   *   - With country code prefix               → +63XXXXXXXXXX (13 chars) or 63XXXXXXXXXX (12 digits)
   */
  const isValidPhilippinePhone = (raw) => {
    const stripped = raw.replace(/[\s\-().]/g, '');
    return /^0\d{10}$/.test(stripped) ||
           /^\+63\d{10}$/.test(stripped) ||
           /^63\d{10}$/.test(stripped);
  };

  // Comprehensive form validation - returns array of { section, sectionIndex, message }
  const validateAllFields = (data) => {
    const errors = [];
    const pi = data.personalInfo || {};

    // ---- Personal Information (Step 0) ----
    if (!pi.surname?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Surname is required' });
    if (!pi.firstName?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'First name is required' });
    if (!pi.birthday) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Birthday is required' });
    if (!pi.gender) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Gender is required' });
    if (!pi.civilStatus) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Civil status is required' });
    if (!pi.nationality?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Nationality is required' });
    if (!pi.contactNumber?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Contact number is required' });
    else if (!isValidPhilippinePhone(pi.contactNumber.trim())) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Contact number must be a valid Philippine number (e.g. 09171234567 or +639171234567)' });
    if (!pi.address?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Present address is required' });
    if (!pi.provinceAddress?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Province address is required' });
    if (!pi.programId) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Program is required — please select one from the search results' });
    if (!pi.studentNumber?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Student number is required' });
    else if (!/^[a-zA-Z0-9\-]+$/.test(pi.studentNumber.trim())) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Student number must contain only letters, numbers, and dashes' });
    if (!pi.studentCategory) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Student category is required' });

    // Emergency contacts
    const c1 = pi.emergencyContacts?.[0];
    const c2 = pi.emergencyContacts?.[1];
    if (!c1?.name?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'First emergency contact name is required' });
    if (!c1?.relationship?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'First emergency contact relationship is required' });
    if (!c1?.contactNumber?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'First emergency contact number is required' });
    else if (!isValidPhilippinePhone(c1.contactNumber.trim())) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'First emergency contact number must be a valid Philippine number (e.g. 09171234567)' });
    if (!c2?.name?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Second emergency contact name is required' });
    if (!c2?.relationship?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Second emergency contact relationship is required' });
    if (!c2?.contactNumber?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Second emergency contact number is required' });
    else if (!isValidPhilippinePhone(c2.contactNumber.trim())) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Second emergency contact number must be a valid Philippine number (e.g. 09171234567)' });

    // ---- Medical Background (Step 2) ----
    const mb = data.medicalBackground || {};
    if (!mb.hasHospitalization) errors.push({ section: 'Medical Background', sectionIndex: 2, message: 'Hospitalization question is required (Yes/No)' });
    if (!mb.hasOperation) errors.push({ section: 'Medical Background', sectionIndex: 2, message: 'Surgery/Operation question is required (Yes/No)' });

    // ---- Dental History (Step 3) ----
    const dh = data.dentalHistory || {};
    if (!dh.firstTimeDentist) errors.push({ section: 'Dental History', sectionIndex: 3, message: 'First time dentist question is required' });
    if (!dh.lastDentalCleaning) errors.push({ section: 'Dental History', sectionIndex: 3, message: 'Last dental cleaning is required' });
    if (!dh.hasIntraOralAppliance) errors.push({ section: 'Dental History', sectionIndex: 3, message: 'Intra-oral appliance question is required (Yes/No)' });
    if (!dh.upperTeethPhoto) errors.push({ section: 'Dental History', sectionIndex: 3, message: 'Upper teeth photo is required' });
    if (!dh.lowerTeethPhoto) errors.push({ section: 'Dental History', sectionIndex: 3, message: 'Lower teeth photo is required' });

    // ---- OB-GYNE (Step 4, female only) ----
    if (pi.gender === 'Female') {
      const ob = data.obgyne || {};
      if (!ob.lastMenstrualPeriod) errors.push({ section: 'OB-GYNE', sectionIndex: 4, message: 'Last menstrual period date is required' });
    }

    // ---- Certification (Review step) ----
    const cert = data.certification || {};
    if (!cert.verified) errors.push({ section: 'Certification', sectionIndex: 5, message: 'You must verify the certification checkbox' });

    return errors;
  };

  /**
   * Converts a backend/network error into a list of { section, sectionIndex, message }
   * objects suitable for the ValidationWarningModal.
   */
  const parseSubmissionError = (error) => {
    const errors = [];

    // Collect all GraphQL error messages (may be multiple)
    const gqlMessages = (
      error.graphQLErrors ??
      error.response?.data?.errors ??
      []
    ).map(e => e?.message).filter(Boolean);

    if (gqlMessages.length > 0) {
      gqlMessages.forEach(msg => {
        const lower = msg.toLowerCase();

        // Enum / invalid value errors — find the bad field and point to its section
        if (lower.includes('invalid input value for enum') || lower.includes('invalid value')) {
          if (lower.includes('sex') || lower.includes('gender')) {
            errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Gender contains an invalid value. Please re-select your gender.' });
          } else if (lower.includes('civil_status') || lower.includes('civilstatus')) {
            errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Civil status contains an invalid value. Please re-select your civil status.' });
          } else if (lower.includes('branch') || lower.includes('identifier')) {
            errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Student/employee number contains an invalid value. Please check and re-enter it.' });
          } else if (lower.includes('year') || lower.includes('program')) {
            errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Program or year level contains an invalid value. Please re-select.' });
          } else if (lower.includes('updatescope') || lower.includes('scope')) {
            errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Submission configuration error. Please refresh the page and try again.' });
          } else {
            errors.push({ section: 'Submission Error', sectionIndex: null, message: `One or more fields contain an invalid value: ${msg}` });
          }

        // Not-null / missing required field constraint
        } else if (lower.includes('null value') || lower.includes('not-null') || lower.includes('violates not-null')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A required field is missing. Please review all sections and ensure nothing is left blank.' });

        // Unique constraint (duplicate record)
        } else if (lower.includes('unique constraint') || lower.includes('duplicate')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'This record already exists. Your medical record may have already been submitted.' });

        // Stale / in-progress ticket — must appear before the date check because
        // "update" contains "date" as a substring and would otherwise be misclassified.
        } else if (lower.includes('already in progress') || lower.includes('cannot cancel update ticket')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A previous submission is still being processed. Please wait a moment and try again.' });

        // Date / type conversion — use word boundary to avoid matching "update", "candidate", etc.
        } else if (lower.includes('invalid input syntax') || /\bdate\b/.test(lower) || /\btimestamp\b/.test(lower)) {
          errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'A date field contains an invalid value. Please re-enter your date of birth or other date fields.' });

        // Auth errors
        } else if (lower.includes('unauthorized') || error.status === 401 || error.response?.status === 401) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your session has expired. Please log out and log back in, then try again.' });

        // Skip raw generic backend messages that give no useful guidance to the user
        } else if (lower === 'database error' || lower.startsWith('database error') || lower.includes('internal server error')) {
          // Suppress — a more specific error from the same batch will already be shown
        // Passthrough — show the server message directly only when it is genuinely useful
        } else {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: msg });
        }
      });
    } else if (error.response?.status === 401) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your session has expired. Please log out and log back in, then try again.' });
    } else if (error.response?.status === 403) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Access denied. You may not have permission to submit this form.' });
    } else if (error.response?.status >= 500) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'The server encountered an unexpected error. Please try again in a moment.' });
    } else if (error.message) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: error.message });
    } else {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'An unexpected error occurred. Please check your inputs and try again.' });
    }

    // If all messages were suppressed (e.g. only a raw "Database error" was returned)
    // but we do have more specific entries, that's fine. If errors is still empty, add a fallback.
    if (errors.length === 0) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your submission could not be completed. Please review your inputs and try again.' });
    }

    return errors;
  };

  /**
   * Maps validation error messages to field-level errors for a specific step
   */
  const extractFieldErrorsForStep = (stepIndex, validationErrors) => {
    const stepErrors = validationErrors.filter(err => err.sectionIndex === stepIndex);
    const errors = {};

    stepErrors.forEach(err => {
      const msg = err.message.toLowerCase();

      // Personal Information (Step 0)
      if (stepIndex === 0) {
        if (msg.includes('surname')) errors.surname = err.message;
        if (msg.includes('first name')) errors.firstName = err.message;
        if (msg.includes('birthday') || msg.includes('date of birth')) errors.birthday = err.message;
        if (msg.includes('gender') && !msg.includes('emergency')) errors.gender = err.message;
        if (msg.includes('civil status')) errors.civilStatus = err.message;
        if (msg.includes('nationality')) errors.nationality = err.message;
        if (msg.includes('contact number') && !msg.includes('emergency')) errors.contactNumber = err.message;
        if (msg.includes('present address')) errors.address = err.message;
        if (msg.includes('province address')) errors.provinceAddress = err.message;
        if (msg.includes('program')) errors.program = err.message;
        if (msg.includes('student number')) errors.studentNumber = err.message;
        if (msg.includes('student category')) errors.studentCategory = err.message;
        if (msg.includes('first emergency contact name')) errors.emergencyContact1Name = err.message;
        if (msg.includes('first emergency contact relationship')) errors.emergencyContact1Relationship = err.message;
        if (msg.includes('first emergency contact number')) errors.emergencyContact1ContactNumber = err.message;
        if (msg.includes('second emergency contact name')) errors.emergencyContact2Name = err.message;
        if (msg.includes('second emergency contact relationship')) errors.emergencyContact2Relationship = err.message;
        if (msg.includes('second emergency contact number')) errors.emergencyContact2ContactNumber = err.message;
      }

      // Medical Background (Step 2)
      if (stepIndex === 2) {
        if (msg.includes('hospitalization question')) errors.hasHospitalization = err.message;
        if (msg.includes('surgery') || msg.includes('operation question')) errors.hasOperation = err.message;
      }

      // Dental History (Step 3)
      if (stepIndex === 3) {
        if (msg.includes('first time dentist')) errors.firstTimeDentist = err.message;
        if (msg.includes('last dental cleaning')) errors.lastDentalCleaning = err.message;
        if (msg.includes('intra-oral appliance')) errors.hasIntraOralAppliance = err.message;
        if (msg.includes('upper teeth photo')) errors.upperTeethPhoto = err.message;
        if (msg.includes('lower teeth photo')) errors.lowerTeethPhoto = err.message;
      }

      // OB-GYNE (Step 4)
      if (stepIndex === 4) {
        if (msg.includes('last menstrual period')) errors.lastMenstrualPeriod = err.message;
      }

      // Certification (Step 5)
      if (stepIndex === 5) {
        if (msg.includes('certification')) errors.verified = err.message;
      }
    });

    return errors;
  };

  // Static form - no validation blocking navigation, only on submit
  const validateStep = (step) => {
    return true;
  };

  // Clear a specific field's error when user starts typing
  const clearFieldError = (fieldName) => {
    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const handleNext = () => {
    console.log('[Initial Medical Record Form] Next button clicked, moving from step', currentStep);

    // Clear field errors when navigating to a different step
    setFieldErrors({});

    if (validateStep(currentStep)) {
      // Skip OB-GYNE step if gender is not Female
      if (currentStep === 3 && formData.personalInfo.gender !== 'Female') {
        console.log('[Initial Medical Record Form] Skipping OB-GYNE step (not female)');
        setCurrentStep(5); // Skip to Review
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    console.log('[Initial Medical Record Form] Back button clicked, moving from step', currentStep);

    // Clear field errors when navigating to a different step
    setFieldErrors({});

    // Skip OB-GYNE step when going back if gender is not Female
    if (currentStep === 5 && formData.personalInfo.gender !== 'Female') {
      console.log('[Initial Medical Record Form] Skipping OB-GYNE step when going back (not female)');
      setCurrentStep(3); // Go back to Dental History
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleEdit = (stepIndex) => {
    console.log('[Initial Medical Record Form] Edit requested for step:', stepIndex);
    setCurrentStep(stepIndex);
  };

  const handleSubmit = async () => {
    console.log('[Initial Medical Record Form] Submit button clicked');
    console.log('[Initial Medical Record Form] Form data:', formData);
    
    // Log the complete data structure for debugging
    logDataStructure(formData, 'Raw Form Data');
    
    // Sanitize the data
    const sanitizedData = sanitizeFormData(formData);
    logDataStructure(sanitizedData, 'Sanitized Form Data');
    
    // Run comprehensive validation
    const errors = validateAllFields(sanitizedData);
    
    if (errors.length > 0) {
      console.warn('[Initial Medical Record Form] Validation errors:', errors);
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }
    
    console.log('[Initial Medical Record Form] All validations passed');
    setIsSubmitting(true);
    
    try {
      console.log('[Initial Medical Record Form] Submitting to backend...');
      
      // Submit to backend via GraphQL service
      const result = await createInitialMedicalRecord(sanitizedData, { isRevision });
      
      console.log('[Initial Medical Record Form] Submission successful!', result);
      setSubmittedRecord(result);
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('[Initial Medical Record Form] Submission error:', error);
      
      const parsedErrors = parseSubmissionError(error);
      setDbErrors(parsedErrors);
      setShowDbErrorModal(true);
    } finally {
      setIsSubmitting(false);
      console.log('[Initial Medical Record Form] Submission process completed');
    }
  };

  const handleSuccessAcknowledge = () => {
    const result = submittedRecord;
    setShowSuccessModal(false);
    setSubmittedRecord(null);

    if (onComplete) {
      onComplete(result);
    } else {
      navigate('/dashboard');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <PersonalInfoForm
            data={formData.personalInfo}
            onChange={handlePersonalInfoChange}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
          />
        );
      case 1:
        return (
          <MedicalHistoryForm
            data={formData.medicalHistory}
            onChange={handleMedicalHistoryChange}
            medicalConditionCatalog={catalogs.medicalConditionCatalog}
            catalogsLoading={catalogs.catalogsLoading}
          />
        );
      case 2:
        return (
          <MedicalBackgroundForm
            data={formData.medicalBackground}
            onChange={handleMedicalBackgroundChange}
            immunizationCatalog={catalogs.immunizationCatalog}
            allergenCatalog={catalogs.allergenCatalog}
            hospitalizationCatalog={catalogs.hospitalizationCatalog}
            operationCatalog={catalogs.operationCatalog}
            medicationCatalog={catalogs.medicationCatalog}
            catalogsLoading={catalogs.catalogsLoading}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
          />
        );
      case 3:
        return (
          <DentalHistoryForm
            data={formData.dentalHistory}
            onChange={handleDentalHistoryChange}
            oralApplianceCatalog={catalogs.oralApplianceCatalog}
            dentalProcedureCatalog={catalogs.dentalProcedureCatalog}
            catalogsLoading={catalogs.catalogsLoading}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
          />
        );
      case 4:
        return (
          <OBGYNEForm
            data={formData.obgyne}
            onChange={handleOBGYNEChange}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
          />
        );
      case 5:
        return (
          <ReviewForm
            formData={formData}
            onEdit={handleEdit}
            certification={formData.certification}
            onCertificationChange={handleCertificationChange}
            catalogs={catalogs}
            fieldErrors={fieldErrors}
            onClearFieldError={clearFieldError}
          />
        );
      default:
        return null;
    }
  };

  const renderNavButtons = () => (
    <>
      <Button
        variant="outline"
        onClick={handleBack}
        disabled={currentStep === 0}
      >
        <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Button>

      <div className="hidden sm:block text-sm text-neutral-500">
        Step {currentStep + 1} of {formData.personalInfo.gender !== 'Female' ? steps.length - 1 : steps.length}
      </div>

      {currentStep < steps.length - 1 ? (
        <Button
          variant="primary"
          onClick={handleNext}
        >
          Next
          <svg className="w-4 h-4 ml-1 sm:ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </>
          ) : (
            <>
              Submit
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </Button>
      )}
    </>
  );

  return (
    <div className={`${
      isModal
        ? 'flex-1 flex flex-col min-h-0'
        : 'min-h-screen bg-stone-100 py-6 px-4'
    }`}>

      {/* Scrollable content area */}
      <div ref={formContentRef} className={`${
        isModal
          ? 'flex-1 overflow-y-auto min-h-0 bg-stone-100 p-4 sm:p-5'
          : ''
      }`}>
        <div className="max-w-5xl mx-auto w-full">
          {/* Header - Only show in standalone mode, modal has its own header */}
          {!isModal && (
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-secondary-900 mb-2">
                Initial Medical Record
              </h1>
              <p className="text-secondary-600">
                Please complete your medical information to access the system
              </p>
            </div>
          )}

          {/* Progress Stepper */}
          <div className="mb-6">
            <ProgressStepper
              currentStep={
                formData.personalInfo.gender !== 'Female' && currentStep >= 5
                  ? currentStep - 1
                  : currentStep
              }
              steps={formData.personalInfo.gender !== 'Female'
                ? steps.filter((_, idx) => idx !== 4)
                : steps
              }
            />
          </div>

          {/* Form Content */}
          <div className="mb-6">
            {renderStepContent()}
          </div>

          {/* Nav buttons - standalone mode only */}
          {!isModal && (
            <div className="bg-white rounded-2xl px-4 py-3 sm:px-6 sm:py-4 shadow-md border border-neutral-200">
              <div className="flex justify-between items-center">
                {renderNavButtons()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav bar - modal mode only, fixed outside scroll area */}
      {isModal && (
        <div className="shrink-0 border-t border-stone-200 bg-stone-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="max-w-5xl mx-auto bg-white rounded-2xl px-4 py-3 sm:px-6 sm:py-4 shadow-md border border-neutral-200">
            <div className="flex justify-between items-center">
              {renderNavButtons()}
            </div>
          </div>
        </div>
      )}

      {/* Validation Warning Modal */}
      <ValidationWarningModal
        isOpen={showValidationModal}
        onClose={() => {
          setShowValidationModal(false);
          setFieldErrors({});
        }}
        errors={validationErrors}
        onGoToSection={(stepIndex) => {
          // Close the modal first
          setShowValidationModal(false);
          // Navigate to the step
          setCurrentStep(stepIndex);
          // Extract field-level errors for this step
          const errors = extractFieldErrorsForStep(stepIndex, validationErrors);
          setFieldErrors(errors);
          // Scroll to appropriate position
          setTimeout(() => {
            // For Review page with certification error, scroll to bottom to show checkbox
            if (stepIndex === 5 && errors.verified) {
              formContentRef.current?.scrollTo({ top: formContentRef.current.scrollHeight, behavior: 'smooth' });
            } else {
              // For all other pages, scroll to top
              formContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }, 100);
        }}
      />

      {/* Database / Submission Error Modal */}
      <ValidationWarningModal
        isOpen={showDbErrorModal}
        onClose={() => setShowDbErrorModal(false)}
        errors={dbErrors}
        onGoToSection={(stepIndex) => { setCurrentStep(stepIndex); setShowDbErrorModal(false); }}
        variant="error"
        title="Submission Failed"
        subtitle="The server rejected your submission. Please fix the issue below and try again."
      />

      {showSuccessModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSuccessAcknowledge} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start gap-3 p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Submission Successful</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Medical record submitted successfully. You can now access the system.
                </p>
              </div>
            </div>
            <div className="p-6 flex justify-end">
              <button
                onClick={handleSuccessAcknowledge}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitialMedicalRecordForm;
