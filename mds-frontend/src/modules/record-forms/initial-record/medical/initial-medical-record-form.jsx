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

const InitialMedicalRecordForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setFormData({ ...formData, personalInfo: data });
  };

  const handleMedicalHistoryChange = (data) => {
    setFormData({ ...formData, medicalHistory: data });
  };

  const handleMedicalBackgroundChange = (data) => {
    setFormData({ ...formData, medicalBackground: data });
  };

  const handleDentalHistoryChange = (data) => {
    setFormData({ ...formData, dentalHistory: data });
  };

  const handleOBGYNEChange = (data) => {
    setFormData({ ...formData, obgyne: data });
  };

  const handleCertificationChange = (data) => {
    setFormData({ ...formData, certification: data });
  };

  // Static form - no validation, just free navigation
  const validateStep = (step) => {
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      // Skip OB-GYNE step if gender is not Female
      if (currentStep === 3 && formData.personalInfo.gender !== 'Female') {
        setCurrentStep(5); // Skip to Review
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    // Skip OB-GYNE step when going back if gender is not Female
    if (currentStep === 5 && formData.personalInfo.gender !== 'Female') {
      setCurrentStep(3); // Go back to Dental History
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleEdit = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Static form - just log data and redirect
      console.log('Form Data (Static):', formData);
      
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Form submitted! (Static - no backend connection)');
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong.');
    } finally {
      setIsSubmitting(false);
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-secondary-900 mb-2">
            Initial Medical Record
          </h1>
          <p className="text-secondary-600">
            Please complete your medical information to access the system
          </p>
        </div>

        {/* Progress Stepper */}
        <ProgressStepper 
          currentStep={currentStep} 
          steps={formData.personalInfo.gender !== 'Female' && currentStep > 2 
            ? steps.filter((_, idx) => idx !== 4) 
            : steps
          } 
        />

        {/* Form Content */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center bg-white rounded-2xl shadow-xl p-6">
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
