import React, { useState, useEffect } from 'react';
import ProgressStepper from './progress-stepper';
import PersonalInfoStep from './personal-info-step';
import MedicalHistoryStep from './medical-history-step';
import DentalHistoryStep from './dental-history-step';
import ReviewStep from './review-step';
import RecordChoicePage from './record-choice-page';
import { updatePersonalInfo } from './personal-info-service';
import { submitUpdateRecord, getUpdateTicketStatus, getUpdateRevisionStatus, fetchUpdateRevisionPrefill } from './update-record-service';
import { axiosRequest } from '../../../packages-core-adapter';
import ValidationWarningModal from '../../../components/modals/validation-warning-modal';

const RecordUpdateForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordType, setRecordType] = useState(null); // 'medical', 'dental', or 'both'
  const [pendingWarning, setPendingWarning] = useState(null); // { scope } of existing pending ticket

  // Revision tracking
  const [revisionStatus, setRevisionStatus] = useState(null); // { id, status, notes }
  const [showRevisionBanner, setShowRevisionBanner] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(true);
  const [revisionPrefillData, setRevisionPrefillData] = useState(null); // Pre-fetched form data for revision

  // Success modal tracking
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Submission error tracking
  const [dbErrors, setDbErrors] = useState([]);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);

  // Validation error tracking
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Check for pending revision request on mount
  useEffect(() => {
    const checkForRevision = async () => {
      try {
        console.log('[RecordUpdateForm] Checking for pending revision...');
        const ticket = await getUpdateRevisionStatus();
        
        if (ticket && ticket.status === 'Revision') {
          console.log('[RecordUpdateForm] ⚠️ REVISION DETECTED:', ticket.notes);
          setRevisionStatus(ticket);
          setShowRevisionBanner(true);
          
          // Pre-fetch previous data for revision
          try {
            const prefill = await fetchUpdateRevisionPrefill();
            if (prefill && Object.keys(prefill).length > 0) {
              console.log('[RecordUpdateForm] ✅ Pre-fill data fetched:', prefill);
              setRevisionPrefillData(prefill); // Store for later use
            }
          } catch (err) {
            console.warn('[RecordUpdateForm] Could not fetch pre-fill data:', err.message);
          }
        } else {
          console.log('[RecordUpdateForm] No revision pending');
        }
      } catch (error) {
        console.error('[RecordUpdateForm] Error checking revision status:', error.message);
      } finally {
        setRevisionLoading(false);
      }
    };

    checkForRevision();
  }, []);

  // Fetch patient sex on mount so OB-GYN section shows correctly for female patients
  useEffect(() => {
    const fetchUserSex = async () => {
      try {
        const response = await axiosRequest({
          method: 'POST',
          url: '/profile/patient',
          data: { query: '{ getPersonalRecord { sex } }' }
        });
        const sex = response.data?.data?.getPersonalRecord?.sex;
        if (sex) {
          setFormData(prev => ({ ...prev, sex }));
        }
      } catch (error) {
        console.warn('[RecordUpdateForm] Could not fetch user sex:', error.message);
      }
    };
    fetchUserSex();
  }, []);

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

  // Validate required fields before allowing Next
  const validateCurrentStep = () => {
    const stepName = steps[currentStep];
    const errors = [];

    if (stepName === 'Medical History') {
      // Lifestyle habits are always required
      if (!formData.smoker || !formData.alcoholDrinker) {
        errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in all Lifestyle Habits (Smoker, Alcohol Drinker) before proceeding.' });
      }
      // If user said yes to allergies, check sub-fields
      if (formData.hasAllergies === 'yes') {
        const selectedAllergies = formData.selectedAllergies || [];
        if (selectedAllergies.length > 0) {
          for (const allergenId of selectedAllergies) {
            const detail = formData.allergyDetails?.[allergenId];
            if (!detail?.status || !detail?.severity) {
              errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in Status and Severity for all selected allergies.' });
              break;
            }
          }
        }
      }
      // If user said yes to hospitalizations, check sub-fields
      if (formData.hasHospitalizations === 'yes') {
        if (!formData.admissionDate) {
          errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in the Admission Date for your hospitalization.' });
        }
      }
      // If user said yes to surgeries, check sub-fields
      if (formData.hasSurgeries === 'yes') {
        if (!formData.operationDate) {
          errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in the Operation Date for your surgery.' });
        }
      }
      // If user said yes to medications, check at least one medication entry
      if (formData.hasMedications === 'yes') {
        const meds = formData.currentMedications || [];
        if (meds.length === 0) {
          errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please add at least one medication.' });
        } else {
          for (const med of meds) {
            if (!med.medicineId) {
              errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in the medication name/selection for all added medications.' });
              break;
            }
          }
        }
      }
    }

    if (stepName === 'Dental History') {
      const stepIndexForDental = recordType === 'both' ? 2 : 1;
      
      // Dentist visit info is required
      if (formData.seenByDentist === undefined || formData.seenByDentist === null) {
        errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please indicate whether you have visited a dentist.' });
      }
      if (!formData.lastDentalCleaning) {
        errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please select when your last dental cleaning was.' });
      }
      // Validate oral appliance entries if any were added
      const appliances = formData.oralAppliances || [];
      for (const appliance of appliances) {
        if (!appliance.tagId || !appliance.status || !appliance.dateIssued) {
          errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please fill in all required fields (Type, Status, Date Issued) for each oral appliance.' });
          break;
        }
      }
      // Validate dental procedure dates if any were selected
      const procedures = formData.dentalProcedures || [];
      for (const proc of procedures) {
        if (!proc.procedureDate) {
          errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please fill in the Date of Procedure for all selected dental procedures.' });
          break;
        }
      }
      // Dental photos are required (backend DentalPhotoRecordInput requires UUID! for both fields)
      // Photos are valid if they have either:
      // 1. .file (newly uploaded) OR
      // 2. .id (pre-filled from previous revision)
      if (!formData.upperTeethPhoto?.file && !formData.upperTeethPhoto?.id) {
        errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please upload a photo of your upper teeth.' });
      }
      if (!formData.lowerTeethPhoto?.file && !formData.lowerTeethPhoto?.id) {
        errors.push({ section: 'Dental History', sectionIndex: stepIndexForDental, message: 'Please upload a photo of your lower teeth.' });
      }
    }

    // If errors exist, show the modal and don't allow navigation
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
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
    // Check for an existing Pending ticket first and warn the patient before cancelling it
    try {
      const existing = await getUpdateTicketStatus();
      if (existing?.status === 'Pending') {
        setPendingWarning({ scope: existing.scope });
        return; // stop here — wait for patient to confirm or cancel
      }
    } catch (_) {
      // If we can't check, just proceed — ensureNoActiveTicket will handle it
    }
    await doSubmit();
  };

  // Parse submission errors into user-friendly messages
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

        // Handle ticket-related errors
        if (lower.includes('already in progress') || lower.includes('cannot cancel update ticket')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A previous submission is still being processed. Please wait a moment and try again.' });
        } else if (lower.includes('invalid input value for enum') || lower.includes('invalid value')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'One or more fields contain invalid values. Please review your selections and try again.' });
        } else if (lower.includes('null value') || lower.includes('not-null') || lower.includes('violates not-null')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A required field is missing. Please review all sections and ensure nothing is left blank.' });
        } else if (lower.includes('unique constraint') || lower.includes('duplicate')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'This record has already been submitted.' });
        } else if (lower.includes('invalid input syntax') || /\bdate\b/.test(lower) || /\btimestamp\b/.test(lower)) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A date field contains an invalid value. Please check and re-enter date fields.' });
        } else if (lower.includes('unauthorized') || error.status === 401 || error.response?.status === 401) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your session has expired. Please log out and log back in, then try again.' });
        } else if (lower === 'database error' || lower.startsWith('database error') || lower.includes('internal server error')) {
          // Suppress generic messages
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

    if (errors.length === 0) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your submission could not be completed. Please review your inputs and try again.' });
    }

    return errors;
  };

  const doSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('[RecordUpdateForm] ==================== STARTING SUBMISSION ====================');
      console.log('[RecordUpdateForm] Record Type:', recordType);
      console.log('[RecordUpdateForm] Form Data:', formData);

      // Submit all records (this creates ticket FIRST, then personal info, then medical/dental)
      console.log('[RecordUpdateForm] Submitting all records...');
      const results = await submitUpdateRecord(formData, recordType);
      console.log('[RecordUpdateForm] ✅ Records submitted successfully:', results);
      
      // Show success modal!
      const recordTypeLabel = recordType === 'both' ? 'Medical and Dental' : recordType === 'medical' ? 'Medical' : 'Dental';
      setSuccessMessage(recordTypeLabel);
      setShowSuccessModal(true);
      
      console.log('[RecordUpdateForm] ==================== SUBMISSION COMPLETE ====================');
    } catch (error) {
      console.error('[RecordUpdateForm] ❌ Submission failed:', error);
      const parsedErrors = parseSubmissionError(error);
      setDbErrors(parsedErrors);
      setShowDbErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    // Reset form and redirect to choice page (preserve sex for OB-GYN gating)
    setFormData(prev => ({ sex: prev.sex }));
    setCurrentStep(0);
    setRecordType(null);
    setRevisionStatus(null);
    setShowRevisionBanner(false);
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
        return (
          <ReviewStep 
            formData={formData} 
            onEdit={handleEdit} 
            recordType={recordType}
            isRevision={revisionStatus?.status === 'Revision'}
            revisionNotes={revisionStatus?.notes || null}
          />
        );
      default:
        return null;
    }
  };

  const handleChoiceSelect = (choice) => {
    setRecordType(choice);
    setCurrentStep(0);
    setFormData(prev => ({ sex: prev.sex }));
  };

  const handleChangeType = () => {
    setRecordType(null);
    setCurrentStep(0);
    setFormData(prev => ({ sex: prev.sex }));
  };

  return (
    <>
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white text-center mb-2">
              Record Updated Successfully!
            </h2>

            {/* Message */}
            <p className="text-lg text-secondary-600 dark:text-neutral-400 text-center mb-8">
              Your {successMessage} record has been submitted for review.
            </p>

            {/* Info Box */}
            <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl p-6 mb-8">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-success-600 dark:text-success-400 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-success-800 dark:text-success-300">
                    Your update has been received and is now pending review
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-success-600 dark:text-success-400 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-success-800 dark:text-success-300">
                    The medical staff will review your submission
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-success-600 dark:text-success-400 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-success-800 dark:text-success-300">
                    You'll receive a notification if more changes are needed
                  </span>
                </div>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={handleSuccessModalClose}
              className="w-full px-6 py-3 bg-success-500 hover:bg-success-600 text-white font-semibold rounded-lg transition-colors"
            >
              Back to Updates
            </button>
          </div>
        </div>
      )}

      {/* Submission Error Modal */}
      <ValidationWarningModal
        isOpen={showDbErrorModal}
        onClose={() => setShowDbErrorModal(false)}
        errors={dbErrors}
        onGoToSection={(stepIndex) => { setCurrentStep(stepIndex); setShowDbErrorModal(false); }}
        variant="error"
        title="Submission Failed"
        subtitle="The server rejected your submission. Please fix the issue below and try again."
      />

      {/* Validation Error Modal */}
      <ValidationWarningModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        errors={validationErrors}
        onGoToSection={(stepIndex) => { setCurrentStep(stepIndex); setShowValidationModal(false); }}
        variant="error"
        title="Incomplete Form"
        subtitle="Please fix the following issues before proceeding to the next step."
      />

      {/* Revision Request Banner - Show if revision is pending */}
      {showRevisionBanner && revisionStatus?.status === 'Revision' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M7.08 6.47A9.002 9.002 0 0012 2c4.97 0 9 4.03 9 9s-4.03 9-9 9S3 16.97 3 12c0-2.395.896-4.576 2.364-6.192M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-1">
                  Revision Requested
                </h2>
                <p className="text-secondary-600 dark:text-neutral-400">
                  The medical staff has requested you to revise your submitted record.
                </p>
              </div>
            </div>

            {/* Staff Notes Section */}
            {revisionStatus?.notes && (
              <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl p-4 mb-6">
                <div className="text-sm font-semibold text-error-900 dark:text-error-200 mb-2">
                  🔍 Staff Notes:
                </div>
                <p className="text-sm text-error-800 dark:text-error-300 whitespace-pre-wrap">
                  {revisionStatus.notes}
                </p>
              </div>
            )}

            {/* Action Instructions */}
            <div className="bg-primary-50 dark:bg-primary-500/10 rounded-xl p-4 mb-6 border border-primary-200 dark:border-primary-500/30">
              <ol className="text-sm text-secondary-700 dark:text-neutral-300 space-y-2 list-decimal list-inside">
                <li>Review the notes above carefully</li>
                <li>Edit the required sections if needed</li>
                <li>Submit your revised record for re-review</li>
              </ol>
            </div>

            {/* Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRevisionBanner(false)}
                className="px-5 py-2.5 rounded-lg font-medium bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowRevisionBanner(false);
                  // Map scope to recordType: Medical→medical, Dental→dental, Both→both
                  const scopeMap = {
                    'Medical': 'medical',
                    'Dental': 'dental',
                    'Both': 'both'
                  };
                  const recordTypeForRevision = scopeMap[revisionStatus?.scope] || 'medical';
                  
                  // Merge pre-filled revision data into form
                  if (revisionPrefillData && Object.keys(revisionPrefillData).length > 0) {
                    console.log('[RecordUpdateForm] Merging pre-fill data into form');
                    setFormData(prev => {
                      // Ensure toggle states match pre-filled data presence
                      const merged = { ...prev, ...revisionPrefillData };
                      
                      // If we have pre-filled oral appliances, set the toggle to true
                      if (revisionPrefillData.oralAppliances?.length > 0 && merged.hasOralAppliances !== true) {
                        merged.hasOralAppliances = true;
                      }
                      
                      // If we have pre-filled dental procedures, we'll sync with the local state via useEffect
                      
                      return merged;
                    });
                  }
                  
                  setRecordType(recordTypeForRevision);
                  setCurrentStep(0);
                }}
                className="px-5 py-2.5 rounded-lg font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-colors"
              >
                Start Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Warning Modal (existing) */}
      {pendingWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-secondary-800 dark:text-white mb-1">
                  Existing Request Found
                </h3>
                <p className="text-sm text-secondary-600 dark:text-neutral-300">
                  You already have a <strong>{pendingWarning.scope}</strong> update request that is currently pending staff review.
                </p>
                <p className="text-sm text-secondary-600 dark:text-neutral-300 mt-2">
                  If you continue, your existing <strong>{pendingWarning.scope}</strong> request will be <span className="text-error-600 dark:text-error-400 font-semibold">cancelled</span> and replaced with this new submission.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setPendingWarning(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Keep Old Request
              </button>
              <button
                onClick={() => { setPendingWarning(null); doSubmit(); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-error-500 hover:bg-error-600 text-white transition-colors"
              >
                Cancel Old &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {!recordType ? (
        <RecordChoicePage onSelect={handleChoiceSelect} />
      ) : (
        <div className="max-w-5xl mx-auto px-4">
          {/* Header Section */}
          <div className="rounded-2xl p-6 mb-6 bg-primary-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-12 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-heading font-bold text-white" style={{ margin: 0 }}>
                  Update {recordType === 'medical' ? 'Medical Record' : recordType === 'dental' ? 'Dental Record' : 'Medical & Dental Record'}
                </h1>
                <p className="text-white/80 text-sm mt-1" style={{ margin: 0 }}>
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
          <div className="mb-6">
            <ProgressStepper currentStep={currentStep} steps={steps} />
          </div>

          {/* Form Content */}
          <div className="mb-6">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl px-6 py-3 shadow-md border border-neutral-200 dark:border-neutral-700">
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
