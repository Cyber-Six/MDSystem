import React, { useState } from 'react';
import ProgressStepper from './progress-stepper';
import PersonalInfoStep from './personal-info-step';
import MedicalHistoryStep from './medical-history-step';
import DentalHistoryStep from './dental-history-step';
import ReviewStep from './review-step';
import RecordChoicePage from './record-choice-page';
import { updatePersonalInfo } from './personal-info-service';
import { submitUpdateRecord } from './update-record-service';

const RecordUpdateForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordType, setRecordType] = useState(null); // 'medical', 'dental', or 'both'

  // Dynamically build steps based on recordType
  const getSteps = () => {
    if (!recordType) return ['Personal Info'];
    
    const baseSteps = ['Personal Info'];
    
    if (recordType === 'medical' || recordType === 'both') {
      baseSteps.push('Medical History');
    }
    
    if (recordType === 'dental' || recordType === 'both') {
      baseSteps.push('Dental History');
    }
    
    baseSteps.push('Review & Submit');
    return baseSteps;
  };

  const steps = getSteps();

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
      console.log('[RecordUpdateForm] ==================== STARTING SUBMISSION ====================');
      console.log('[RecordUpdateForm] Record Type:', recordType);
      console.log('[RecordUpdateForm] Form Data:', formData);

      // Submit all records (this creates ticket FIRST, then personal info, then medical/dental)
      console.log('[RecordUpdateForm] Submitting all records...');
      const results = await submitUpdateRecord(formData, recordType);
      console.log('[RecordUpdateForm] ✅ Records submitted successfully:', results);
      
      // Success!
      alert(`✅ ${recordType === 'both' ? 'Medical and Dental' : recordType === 'medical' ? 'Medical' : 'Dental'} record updated successfully!\n\nYour update has been submitted for review.`);
      
      // Reset form and redirect to choice page
      setFormData({});
      setCurrentStep(0);
      setRecordType(null);
      
      console.log('[RecordUpdateForm] ==================== SUBMISSION COMPLETE ====================');
    } catch (error) {
      console.error('[RecordUpdateForm] ❌ Submission failed:', error);
      
      let errorMessage = 'Failed to update record. Please try again.';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(`❌ ${errorMessage}\n\nPlease check your inputs and try again. If the problem persists, contact support.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    const stepName = steps[currentStep];
    
    switch (stepName) {
      case 'Personal Info':
        return <PersonalInfoStep formData={formData} onChange={setFormData} />;
      case 'Medical History':
        return <MedicalHistoryStep formData={formData} onChange={setFormData} />;
      case 'Dental History':
        return <DentalHistoryStep formData={formData} onChange={setFormData} />;
      case 'Review & Submit':
        return <ReviewStep formData={formData} onEdit={handleEdit} recordType={recordType} />;
      default:
        return null;
    }
  };

  const handleChoiceSelect = (choice) => {
    setRecordType(choice);
    setCurrentStep(0);
    setFormData({});
  };

  const handleChangeType = () => {
    setRecordType(null);
    setCurrentStep(0);
    setFormData({});
  };

  return (
    <>
      {!recordType ? (
        <RecordChoicePage onSelect={handleChoiceSelect} />
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Header Section */}
          <div className="bg-primary-500 dark:bg-neutral-900 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-12 rounded-xl bg-primary-400 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-white dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-heading font-bold text-white dark:text-white">
                  Update {recordType === 'medical' ? 'Medical Record' : recordType === 'dental' ? 'Dental Record' : 'Medical & Dental Record'}
                </h1>
                <p className="text-white/90 dark:text-neutral-400 text-sm">
                  Keep your health information up-to-date
                </p>
              </div>
              {recordType && (
                <button
                  onClick={handleChangeType}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Change Type
                </button>
              )}
            </div>
          </div>

          {/* Progress Stepper */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 mb-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
            <ProgressStepper currentStep={currentStep} steps={steps} />
          </div>

          {/* Form Content */}
          <div className="mb-6">
            {/* Add shadow to all step cards */}
            <div className="shadow-lg border border-neutral-200 dark:border-neutral-700 rounded-2xl">
              {renderStep()}
            </div>
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
      )}
    </>
  );
};

export default RecordUpdateForm;
