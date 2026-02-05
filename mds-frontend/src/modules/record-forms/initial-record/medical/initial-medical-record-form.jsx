import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressStepper from './progress-stepper';
import PersonalInfoForm from './personal-info';
import MedicalHistoryForm from './medical-history';
import MedicalBackgroundForm from './medical-background';
import DentalHistoryForm from './dental-history';
import OBGYNEForm from './obygyne';
import ReviewForm from './review-form';
import { Button } from './form-elements';
import { createInitialMedicalRecord } from '../../../../services/emr-service';
import { validateFormData, sanitizeFormData, logDataStructure } from '../../../../utils/data-transformer';

/**
 * Initial Medical Record Form Component
 * Can be used as a standalone page or within a modal
 * 
 * @param {Object} props
 * @param {Function} props.onComplete - Optional callback when form is successfully submitted
 * @param {boolean} props.isModal - Whether the form is displayed in a modal (affects styling)
 */
const InitialMedicalRecordForm = ({ onComplete, isModal = false }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      immunizations: {},
      drugAllergy: '',
      foodAllergy: '',
      otherAllergy: '',
      hospitalizations: '',
      operations: '',
      maintenanceMedications: '',
      tattooLocation: '',
      piercingLocation: '',
      smoker: 'no',
      smokerSticksPerDay: '',
      smokerYears: '',
      alcoholDrinker: 'no',
      alcoholFrequency: '',
      eyeglasses: false,
      contactLenses: false,
      gradeOD: '',
      gradeOS: '',
      visualAcuityDate: '',
      height: '',
      weight: ''
    },
    dentalHistory: {
      firstTimeDentist: '',
      lastDentalConsultation: '',
      lastDentalCleaning: '',
      hasIntraOralAppliance: '',
      intraOralAppliances: {},
      applianceLocation: '',
      toothExtraction: '',
      dentalFilling: '',
      upperTeethPhoto: null,
      lowerTeethPhoto: null
    },
    obgyne: {
      menarcheYearAge: '',
      menstruationDuration: '',
      dysmenorrhea: 'no'
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

  // Static form - no validation, just free navigation
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
    
    setIsSubmitting(true);
    
    try {
      console.log('[Initial Medical Record Form] Validating form data...');
      
      // Log the complete data structure for debugging
      logDataStructure(formData, 'Raw Form Data');
      
      // Sanitize the data
      const sanitizedData = sanitizeFormData(formData);
      logDataStructure(sanitizedData, 'Sanitized Form Data');
      
      // Validate the data
      const validation = validateFormData(sanitizedData);
      
      if (!validation.isValid) {
        console.error('[Initial Medical Record Form] Validation failed:', validation.errors);
        alert('Please fill in all required fields:\n\n' + validation.errors.join('\n'));
        return;
      }
      
      if (validation.warnings.length > 0) {
        console.warn('[Initial Medical Record Form] Validation warnings:', validation.warnings);
      }
      
      // Additional required field checks
      const errors = [];
      
      if (!sanitizedData.personalInfo.surname) errors.push('Surname is required');
      if (!sanitizedData.personalInfo.firstName) errors.push('First name is required');
      if (!sanitizedData.personalInfo.birthday) errors.push('Birthday is required');
      if (!sanitizedData.personalInfo.gender) errors.push('Gender is required');
      if (!sanitizedData.personalInfo.contactNumber) errors.push('Contact number is required');
      
      if (!sanitizedData.personalInfo.emergencyContacts[0]?.name) {
        errors.push('First emergency contact name is required');
      }
      if (!sanitizedData.personalInfo.emergencyContacts[0]?.relationship) {
        errors.push('First emergency contact relationship is required');
      }
      if (!sanitizedData.personalInfo.emergencyContacts[0]?.contactNumber) {
        errors.push('First emergency contact number is required');
      }
      
      if (!sanitizedData.personalInfo.emergencyContacts[1]?.name) {
        errors.push('Second emergency contact name is required');
      }
      if (!sanitizedData.personalInfo.emergencyContacts[1]?.relationship) {
        errors.push('Second emergency contact relationship is required');
      }
      if (!sanitizedData.personalInfo.emergencyContacts[1]?.contactNumber) {
        errors.push('Second emergency contact number is required');
      }
      
      if (!sanitizedData.certification.verified) {
        errors.push('You must verify the certification to submit');
      }
      
      if (errors.length > 0) {
        console.error('[Initial Medical Record Form] Field validation errors:', errors);
        alert('Please fill in all required fields:\n\n' + errors.join('\n'));
        return;
      }
      
      console.log('[Initial Medical Record Form] All validations passed');
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
      console.error('[Initial Medical Record Form] Error stack:', error.stack);
      console.error('[Initial Medical Record Form] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      let errorMessage = 'Failed to submit medical record. ';
      
      if (error.response?.status === 401) {
        errorMessage += '\n\nAuthentication error. Please log in again.';
        // You might want to redirect to login here
      } else if (error.response?.status === 403) {
        errorMessage += '\n\nAccess denied. You may not have permission to submit this form.';
      } else if (error.response?.status === 400) {
        errorMessage += '\n\nInvalid data. Please check all fields and try again.';
      } else if (error.response?.status >= 500) {
        errorMessage += '\n\nServer error. Please try again later.';
      } else if (error.response?.data?.errors) {
        errorMessage += '\n\nServer errors:\n' + 
          error.response.data.errors.map(e => `- ${e.message}`).join('\n');
      } else if (error.message) {
        errorMessage += '\n\nError: ' + error.message;
      } else {
        errorMessage += '\n\nPlease check the console for more details and try again.';
      }
      
      alert(errorMessage);
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
          />
        );
      case 2:
        return (
          <MedicalBackgroundForm 
            data={formData.medicalBackground} 
            onChange={handleMedicalBackgroundChange} 
          />
        );
      case 3:
        return (
          <DentalHistoryForm 
            data={formData.dentalHistory} 
            onChange={handleDentalHistoryChange} 
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

  return (
    <div className={`${isModal ? 'bg-gradient-to-br from-primary-50 via-white to-accent-50 p-6' : 'min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 py-8 px-4'}`}>
      <div className={`${isModal ? 'w-full' : 'max-w-5xl mx-auto'}`}>
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
          currentStep={currentStep} 
          steps={formData.personalInfo.gender !== 'Female' && currentStep > 2 
            ? steps.filter((_, idx) => idx !== 4) 
            : steps
          } 
        />

        {/* Form Content */}
        <div className={`bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6 ${isModal ? 'shadow-none border border-gray-200' : ''}`}>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className={`flex justify-between items-center bg-white rounded-2xl shadow-xl p-6 ${isModal ? 'shadow-none border border-gray-200 sticky bottom-0' : ''}`}>
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>

          <div className="text-sm text-secondary-600">
            Step {currentStep + 1} of {formData.personalInfo.gender !== 'Female' ? steps.length - 1 : steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={handleNext}
            >
              Next
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      </div>
    </div>
  );
};

export default InitialMedicalRecordForm;
