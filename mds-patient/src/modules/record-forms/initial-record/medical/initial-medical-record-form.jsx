import React, { useState, useEffect } from 'react';
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
import { createInitialMedicalRecord, fetchAllCatalogs } from '@core/services/emr-service';
import { sanitizeFormData, logDataStructure } from '@core/utils/data-transformer';

/**
 * Initial Medical Record Form Component
 * Can be used as a standalone page or within a modal
 * 
 * @param {Object} props
 * @param {Function} props.onComplete - Optional callback when form is successfully submitted
 * @param {boolean} props.isModal - Whether the form is displayed in a modal (affects styling)
 */
const InitialMedicalRecordForm = ({ onComplete, isModal = false, revisionData = null, isRevision = false }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [dbErrors, setDbErrors] = useState([]);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);

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
      birthday: '',
      age: '',
      gender: '',
      civilStatus: '',
      nationality: '',
      religion: '',
      address: '',
      contactNumber: '',
      program: '',
      programOther: '',
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
      immunizationOther: '',
      // Allergies — keys are allergen catalog IDs
      hasAllergies: '',
      allergies: {},
      allergyOther: '',
      // Hospitalizations — keys are hospitalization condition catalog IDs
      hasHospitalization: '',
      hospitalizationConditions: {},
      hospitalizationDate: '',
      hospitalizationNotes: '',
      // Operations — keys are operation procedure catalog IDs
      hasOperation: '',
      operationConditions: {},
      operationDate: '',
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
      // Visual Acuity
      eyeglasses: false,
      contactLenses: false,
      gradeOD: '',
      gradeOS: '',
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
    if (!pi.address?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Address is required' });
    if (!pi.program) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Program is required' });
    if (pi.program === 'Other' && !pi.programOther?.trim()) errors.push({ section: 'Personal Information', sectionIndex: 0, message: 'Please specify your program' });
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

        // Date / type conversion
        } else if (lower.includes('invalid input syntax') || lower.includes('date') || lower.includes('timestamp')) {
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

  // Static form - no validation blocking navigation, only on submit
  const validateStep = (step) => {
    return true;
  };

  const handleNext = () => {
    console.log('[Initial Medical Record Form] Next button clicked, moving from step', currentStep);
    
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
      const result = await createInitialMedicalRecord(sanitizedData);
      
      console.log('[Initial Medical Record Form] Submission successful!', result);
      
      alert('Medical record submitted successfully! You can now access the system.');
      
      // If onComplete callback is provided (modal mode), call it
      if (onComplete) {
        onComplete(result);
      } else {
        // Navigate to dashboard (standalone page mode)
        navigate('/dashboard');
      }
      
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <PersonalInfoForm 
            data={formData.personalInfo} 
            onChange={handlePersonalInfoChange} 
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
          />
        );
      case 4:
        return (
          <OBGYNEForm 
            data={formData.obgyne} 
            onChange={handleOBGYNEChange} 
          />
        );
      case 5:
        return (
          <ReviewForm 
            formData={formData} 
            onEdit={handleEdit}
            certification={formData.certification}
            onCertificationChange={handleCertificationChange}
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

      <div className="text-xs sm:text-sm text-secondary-600">
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
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-secondary-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        : 'min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 py-8 px-4'
    }`}>

      {/* Scrollable content area */}
      <div className={`${
        isModal
          ? 'flex-1 overflow-y-auto min-h-0 bg-stone-100 p-4 sm:p-5'
          : 'max-w-5xl mx-auto'
      }`}>
        <div className={isModal ? '' : 'w-full'}>
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

          {/* Form Content */}
          <div className={`bg-white rounded-2xl p-4 sm:p-6 md:p-8 ${
            isModal
              ? 'border border-gray-200 shadow-sm'
              : 'shadow-xl mb-8'
          }`}>
            {renderStepContent()}
          </div>

          {/* Nav buttons - standalone mode only */}
          {!isModal && (
            <div className="flex justify-between items-center bg-white rounded-xl shadow-xl px-4 py-3 sm:px-6 sm:py-4 mt-4">
              {renderNavButtons()}
            </div>
          )}
        </div>
      </div>

      {/* Nav bar - modal mode only, fixed outside scroll area */}
      {isModal && (
        <div
          className="shrink-0 flex justify-between items-center bg-white border-t border-stone-200 px-4 py-3 sm:px-6 sm:py-4"
          style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}
        >
          {renderNavButtons()}
        </div>
      )}

      {/* Validation Warning Modal */}
      <ValidationWarningModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        errors={validationErrors}
        onGoToSection={(stepIndex) => setCurrentStep(stepIndex)}
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
    </div>
  );
};

export default InitialMedicalRecordForm;
