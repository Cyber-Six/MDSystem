import React, { useState } from 'react';
import ProgressStepper from './ProgressStepper';
import PersonalInfoStep from './PersonalInfoStep';
import MedicalHistoryStep from './MedicalHistoryStep';
import DentalHistoryStep from './DentalHistoryStep';
import ReviewStep from './ReviewStep';

const RecordUpdateForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ['Personal Info', 'Medical History', 'Dental History', 'Review & Submit'];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEdit = (step) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Form Data:', formData);
      
      alert('Record updated successfully!');
      // Reset form or redirect
      setFormData({});
      setCurrentStep(0);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error updating record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonalInfoStep formData={formData} onChange={setFormData} />;
      case 1:
        return <MedicalHistoryStep formData={formData} onChange={setFormData} />;
      case 2:
        return <DentalHistoryStep formData={formData} onChange={setFormData} />;
      case 3:
        return <ReviewStep formData={formData} onEdit={handleEdit} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header Section */}
      <div className="bg-primary-500 dark:bg-neutral-900 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary-400 dark:bg-neutral-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-white dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-white dark:text-white">
              Update Medical & Dental Record
            </h1>
            <p className="text-white/90 dark:text-neutral-400 text-sm">
              Keep your health information up-to-date
            </p>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 mb-6">
        <ProgressStepper currentStep={currentStep} steps={steps} />
      </div>

      {/* Form Content */}
      <div className="mb-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6">
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              currentStep === 0
                ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:text-secondary-800 dark:hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <span className="text-sm text-neutral-500 dark:text-neutral-400 hidden sm:block">
            Step {currentStep + 1} of {steps.length}
          </span>

          <button
            onClick={currentStep === steps.length - 1 ? handleSubmit : handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg 
                     transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Submitting...</span>
              </>
            ) : currentStep === steps.length - 1 ? (
              <span>Submit</span>
            ) : (
              <>
                <span>Next</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordUpdateForm;
