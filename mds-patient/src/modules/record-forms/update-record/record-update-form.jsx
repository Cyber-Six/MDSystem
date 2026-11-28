import { getPersonalInfoLengthErrors } from '@mdsystem/core/validation/personal-info';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ProgressStepper, { getRecordScrollContainer } from './progress-stepper';
import PersonalInfoStep from './personal-info-step';
import MedicalHistoryStep from './medical-history-step';
import DentalHistoryStep from './dental-history-step';
import ReviewStep from './review-step';
import RecordChoicePage from './record-choice-page';
import { submitUpdateRecord, getUpdateTicketStatus, fetchUpdateRevisionPrefill, fetchUpdateRecordPrefill } from './update-record-service';
import { axiosRequest } from '../../../packages-core-adapter';
import { sendGraphQLRequest } from '../../../utils/graphql-client';
import { usePatientNotifications } from '../../notification/notification-context';
import ValidationWarningModal from '../../../components/modals/validation-warning-modal';
import {
  buildUpdateRecordSteps,
  clampStepIndex,
  getBackButtonState,
} from './step-navigation-utils';
import { clearRecordFormDraft, readRecordFormDraft, saveRecordFormDraft } from '../record-form-draft-storage';

const RecordUpdateForm = ({
  forceRecordType = null,
  skipPersonalStep = false,
  skipPersonalSubmit = false,
  hideRecordChoice = false,
  onSubmissionSuccess = null,
  isInactiveMode = false,
}) => {
  const { subscribe } = usePatientNotifications();
  const formRef = useRef(null);
  const initialTicketSyncStarted = useRef(false);
  const patientSessionId = useRef(localStorage.getItem('patient_refreshToken')?.split(':')[0]);
  const isCurrentPatientSession = useCallback(() =>
    localStorage.getItem('patient_refreshToken')?.split(':')[0] === patientSessionId.current, []);
  const draftFlowBase = forceRecordType ? `record-update-${forceRecordType}` : 'record-update';
  const [draftFlow, setDraftFlow] = useState(draftFlowBase);
  const [cachedDraft] = useState(() => readRecordFormDraft(draftFlow));
  const restoredRecordDraft = cachedDraft?.data?.formData && typeof cachedDraft.data.formData === 'object' && !Array.isArray(cachedDraft.data.formData) ? cachedDraft.data.formData : {};
  const [currentStep, setCurrentStep] = useState(() => Number.isInteger(cachedDraft?.data?.currentStep) ? Math.max(0, Math.min(cachedDraft.data.currentStep, 3)) : 0);
  const [patientDefaults, setPatientDefaults] = useState({});
  const [profileLoadStatus, setProfileLoadStatus] = useState('loading');
  const [loadedRecordType, setLoadedRecordType] = useState(null);
  const [sessionChanged, setSessionChanged] = useState(false);
  const [prefillAttempt, setPrefillAttempt] = useState(0);
  const [recordDraft, setRecordDraft] = useState(() => restoredRecordDraft);
  const formData = useMemo(() => ({ ...patientDefaults, ...recordDraft }), [patientDefaults, recordDraft]);
  const [draftRestored, setDraftRestored] = useState(Boolean(Object.keys(restoredRecordDraft).length || cachedDraft?.data?.recordType));
  const [revisionDraftRestored, setRevisionDraftRestored] = useState(false);
  const [needsPhotoReupload, setNeedsPhotoReupload] = useState(Boolean(cachedDraft?.data?.requiresPhotoReupload));
  const [reviewHasUnresolvedChoices, setReviewHasUnresolvedChoices] = useState(false);
  const [updateReviewConfirmed, setUpdateReviewConfirmed] = useState(false);
  const [reviewConfirmationError, setReviewConfirmationError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const stepTransitionRef = useRef(false);
  const [recordType, setRecordType] = useState(() => cachedDraft?.data?.recordType || null); // 'medical', 'dental', or 'both'
  const effectiveRecordType = forceRecordType || recordType;
  const shouldShowRecordChoice = !effectiveRecordType && !hideRecordChoice;
  const scrollToFormTop = () => {
    const scrollTarget = getRecordScrollContainer(formRef.current) || window;
    scrollTarget.scrollTo?.({ top: 0, behavior: 'instant' });
  };

  // Revision tracking
  const [revisionStatus, setRevisionStatus] = useState(null); // { id, status, notes }
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketStatusLoading, setTicketStatusLoading] = useState(true);
  const [ticketStatusError, setTicketStatusError] = useState(false);
  const [revisionPrefillData, setRevisionPrefillData] = useState(null); // Pre-fetched form data for revision
  const [isLoadingRevisionPrefill, setIsLoadingRevisionPrefill] = useState(false);

  // Success modal tracking
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Submission error tracking
  const [dbErrors, setDbErrors] = useState([]);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);

  // Validation error tracking
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  useEffect(() => {
    if (sessionChanged || !isCurrentPatientSession()) return;
    if (!Object.keys(recordDraft).length && !recordType) return;
    const dentalPhotos = {
      upperTeethPhoto: recordDraft.upperTeethPhoto,
      lowerTeethPhoto: recordDraft.lowerTeethPhoto,
    };
    const hasAnyPhoto = Boolean(dentalPhotos.upperTeethPhoto || dentalPhotos.lowerTeethPhoto);
    const photoReminder = needsPhotoReupload || hasAnyPhoto;
    const persistedDraft = { ...recordDraft };
    for (const field of ['upperTeethPhoto', 'lowerTeethPhoto']) {
      if (Object.hasOwn(recordDraft, field)) persistedDraft[field] = null;
    }
    saveRecordFormDraft(draftFlow, {
      formData: persistedDraft,
      currentStep,
      recordType: forceRecordType || recordType,
      requiresPhotoReupload: photoReminder,
    });
  }, [draftFlow, forceRecordType, recordDraft, recordType, currentStep, needsPhotoReupload, sessionChanged, isCurrentPatientSession]);

  useEffect(() => {
    if (recordDraft.upperTeethPhoto && recordDraft.lowerTeethPhoto) setNeedsPhotoReupload(false);
    else if (recordDraft.upperTeethPhoto || recordDraft.lowerTeethPhoto) setNeedsPhotoReupload(true);
  }, [recordDraft.upperTeethPhoto, recordDraft.lowerTeethPhoto]);

  const syncRevisionStatus = useCallback(async () => {
    setTicketStatusLoading(true);
    setTicketStatusError(false);
    try {
      const ticket = await getUpdateTicketStatus({ strict: true });
      if (!isCurrentPatientSession()) return;
      setActiveTicket(ticket);
      setTicketStatusError(false);
      setUpdateReviewConfirmed(false);
      setReviewConfirmationError(false);

      if (ticket && ticket.status === 'Revision') {

        setRevisionStatus(ticket);
        setIsLoadingRevisionPrefill(true);

        const revisionFlow = `${draftFlowBase}-revision`;
        const revisionDraft = readRecordFormDraft(revisionFlow);
        setDraftFlow(revisionFlow);
        if (revisionDraft?.data) {
          const savedRevisionData = revisionDraft.data.formData;
          setRecordDraft(savedRevisionData && typeof savedRevisionData === 'object' && !Array.isArray(savedRevisionData) ? savedRevisionData : {});
          setCurrentStep(Number.isInteger(revisionDraft.data.currentStep) ? Math.max(0, Math.min(revisionDraft.data.currentStep, 3)) : 0);
          setRecordType(revisionDraft.data.recordType || null);
          setDraftRestored(Boolean(revisionDraft.data.formData || revisionDraft.data.recordType));
          setRevisionDraftRestored(true);
          setNeedsPhotoReupload(Boolean(revisionDraft.data.requiresPhotoReupload));
        } else {
          setRecordDraft({});
          setCurrentStep(0);
          setRecordType(null);
          setDraftRestored(false);
          setRevisionDraftRestored(false);
          setNeedsPhotoReupload(false);
        }

        // Pre-fetch previous data for revision
        try {
          const prefill = await fetchUpdateRevisionPrefill(ticket);
          if (!isCurrentPatientSession()) return;
          if (prefill && Object.keys(prefill).length > 0) {

            setRevisionPrefillData(prefill); // Store for later use
          }
        } catch (err) {

        } finally {
          setIsLoadingRevisionPrefill(false);
        }
        return;
      }

      setRevisionStatus(ticket || null);
      setRevisionPrefillData(null);
      clearRecordFormDraft(`${draftFlowBase}-revision`);

    } catch (error) {
      if (isCurrentPatientSession()) setTicketStatusError(true);
    } finally {
      if (isCurrentPatientSession()) setTicketStatusLoading(false);
    }
  }, [draftFlowBase, isCurrentPatientSession]);

  // Check for pending revision request on mount
  useEffect(() => {
    if (initialTicketSyncStarted.current) return;
    initialTicketSyncStarted.current = true;
    syncRevisionStatus();
  }, [syncRevisionStatus]);

  useEffect(() => {
    if (!forceRecordType && ['Pending', 'InProgress', 'RevisionSubmitted'].includes(activeTicket?.status)) {
      setRecordType(null);
    }
  }, [activeTicket?.status, forceRecordType]);

  // Keep revision modal in sync with live update-ticket status changes.
  useEffect(() => {
    const unsubscribe = subscribe('updateTicket:statusChanged', () => {
      syncRevisionStatus();
    });

    return () => unsubscribe();
  }, [subscribe, syncRevisionStatus]);

  // Load the stored personal profile for review and to determine OB-GYN visibility.
  useEffect(() => {
    if (!effectiveRecordType && revisionStatus?.status !== 'Revision') return;
    const fetchUserSex = async () => {
      try {
        const response = await axiosRequest({
          method: 'POST',
          url: '/profile/patient',
          data: { query: '{ getPersonalRecord { sex } getPersonalRecordLog { sex } }' }
        });
        const profile = response.data?.data?.getPersonalRecord || response.data?.data?.getPersonalRecordLog;
        if (!isCurrentPatientSession()) return;
        if (profile) {
          setPatientDefaults(prev => ({ ...prev, sex: profile.sex || prev.sex }));
        }
      } catch (error) {

      }
    };
    fetchUserSex();
  }, [effectiveRecordType, revisionStatus?.status, isCurrentPatientSession]);

  useEffect(() => {
    const patientId = localStorage.getItem('patient_refreshToken')?.split(':')[0];
    const onSessionChange = (event) => {
      if (event.key !== 'patient_refreshToken' && event.key !== null) return;
      if (localStorage.getItem('patient_refreshToken')?.split(':')[0] === patientId) return;
      setSessionChanged(true);
      setPatientDefaults({});
      setRecordDraft({});
      setUpdateReviewConfirmed(false);
      setReviewConfirmationError(false);
      setRevisionPrefillData(null);
      setRevisionStatus(null);
    };
    window.addEventListener('storage', onSessionChange);
    return () => window.removeEventListener('storage', onSessionChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedPrefill;
    const releasePhotoPreviews = (prefill) => {
      for (const field of ['upperTeethPhoto', 'lowerTeethPhoto']) {
        const preview = prefill?.[field]?.preview;
        if (preview) URL.revokeObjectURL(preview);
      }
    };
    if (!effectiveRecordType || sessionChanged) return undefined;
    const recordTypeToLoad = effectiveRecordType;
    setProfileLoadStatus('loading');
    fetchUpdateRecordPrefill(recordTypeToLoad).then(prefill => {
      if (cancelled || !isCurrentPatientSession()) {
        releasePhotoPreviews(prefill);
        return;
      }
      loadedPrefill = prefill;
      setPatientDefaults(previous => ({ ...previous, ...prefill, sex: previous.sex || prefill.sex }));
      setLoadedRecordType(recordTypeToLoad);
      setProfileLoadStatus('ready');
    }).catch(() => {
      if (!cancelled) setProfileLoadStatus('error');
    });
    return () => {
      cancelled = true;
      releasePhotoPreviews(loadedPrefill);
    };
  }, [effectiveRecordType, prefillAttempt, sessionChanged]);

  const updateRecordDraft = (nextFormData) => {
    if (!isCurrentPatientSession()) return;
    setUpdateReviewConfirmed(false);
    setReviewConfirmationError(false);
    setRecordDraft(Object.fromEntries(Object.entries(nextFormData).filter(([field, value]) => value !== patientDefaults[field])));
  };

  const steps = buildUpdateRecordSteps({
    effectiveRecordType,
    skipPersonalStep,
  });
  const safeCurrentStep = clampStepIndex(currentStep, steps.length);
  const waitingForProfile = sessionChanged || profileLoadStatus !== 'ready' || loadedRecordType !== effectiveRecordType;
  const canReturnToChoicePage = !forceRecordType && !hideRecordChoice;
  const backButtonState = getBackButtonState({
    currentStep: safeCurrentStep,
    canReturnToChoicePage,
  });

  // Keep the step pointer valid whenever dynamic step count changes.
  useEffect(() => {
    if (safeCurrentStep !== currentStep) {
      setCurrentStep(safeCurrentStep);
    }
  }, [currentStep, safeCurrentStep]);

  const getPersonalLengthErrors = () => getPersonalInfoLengthErrors({
    department: formData.employeeDepartment,
    position: formData.employeePosition,
    emergencyContacts: [
      { contactNumber: formData.emergencyContact1Number },
      { contactNumber: formData.emergencyContact2Number },
    ],
  }, { includeProfile: false, isEmployee: formData.profileType === 'Employee' }).map(issue => ({ section: 'Personal Info', sectionIndex: 0, ...issue }));

  // Validate required fields before allowing Next
  const validateCurrentStep = () => {
    const stepName = steps[safeCurrentStep];
    const errors = [];

    if (stepName === 'Personal Info') {
      errors.push(...getPersonalLengthErrors());
      if (formData.profileType === 'Employee') {
        if (!formData.employeeDepartment) errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please enter your department before proceeding.' });
        if (!formData.employeeRole) errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please select your employment category before proceeding.' });
        if (formData.employeeRole === 'Other' && !formData.employeeCategoryOther) errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please specify your employment category before proceeding.' });
      } else {
        if (!formData.programId) {
          errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please select a program before proceeding.' });
        }
        if (!formData.schoolYear) {
          errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please select your student category before proceeding.' });
        }
      }
      if (!formData.emergencyContact1Name || !formData.emergencyContact1Relationship || !formData.emergencyContact1Number) {
        errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please complete all required Primary Emergency Contact fields.' });
      }
      if (!formData.emergencyContact2Name || !formData.emergencyContact2Relationship || !formData.emergencyContact2Number) {
        errors.push({ section: 'Personal Info', sectionIndex: 0, message: 'Please complete all required Secondary Emergency Contact fields.' });
      }
    }

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
      // If user said yes to hospitalizations, check at least one condition is checked with an admission date
      if (formData.hasHospitalizations === 'yes') {
        const conditions = formData.hospitalizationConditions || {};
        const dates = formData.hospitalizationDates || {};
        const checkedIds = Object.entries(conditions).filter(([, v]) => v).map(([k]) => k);
        if (checkedIds.length > 0) {
          const missingDate = checkedIds.some(id => !dates[id]?.admissionDate);
          if (missingDate) {
            errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in the Admission Date for all selected hospitalizations.' });
          }
        }
      }
      // If user said yes to surgeries, check at least one procedure is checked with an operation date
      if (formData.hasSurgeries === 'yes') {
        const conditions = formData.operationConditions || {};
        const dates = formData.operationDates || {};
        const checkedIds = Object.entries(conditions).filter(([, v]) => v).map(([k]) => k);
        if (checkedIds.length > 0) {
          const missingDate = checkedIds.some(id => !dates[id]);
          if (missingDate) {
            errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please fill in the Operation Date for all selected surgeries.' });
          }
        }
      }
      // If user said yes to medications, check at least one medication is selected
      if (formData.hasMedications === 'yes') {
        const selected = formData.selectedMedications || {};
        const hasAny = Object.values(selected).some(v => v);
        if (!hasAny) {
          errors.push({ section: 'Medical History', sectionIndex: 1, message: 'Please select at least one medication.' });
        }
      }
    }

    if (stepName === 'Dental History') {
      const stepIndexForDental = (effectiveRecordType === 'both' && !skipPersonalStep)
        ? 2
        : 1;


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
      // Both dental photos are required for the ticket.
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
      scrollToFormTop();
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    if (stepTransitionRef.current || isSubmitting) return;
    if (!validateCurrentStep()) return;
    if (safeCurrentStep < steps.length - 1) {
      const isStandardUpdate = revisionStatus?.status !== 'Revision';
      if (isStandardUpdate) {
        stepTransitionRef.current = true;
        setIsStepTransitioning(true);
        await new Promise(resolve => window.setTimeout(resolve, 700));
      }
      setCurrentStep(safeCurrentStep + 1);
      scrollToFormTop();
      if (isStandardUpdate) {
        stepTransitionRef.current = false;
        setIsStepTransitioning(false);
      }
    }
  };

  const handleBack = () => {
    if (safeCurrentStep > 0) {
      setCurrentStep(safeCurrentStep - 1);
      scrollToFormTop();
    }
  };

  const handleCancelToChoice = () => {
    if (!canReturnToChoicePage) return;
    handleChangeType();
    scrollToFormTop();
  };

  const registerCatalogItem = useCallback((domain, item) => {
    if (!item?.id || String(item.id) === 'undefined') return;
    setUpdateReviewConfirmed(false);
    setReviewConfirmationError(false);
    setRecordDraft((previous) => {
      const domainItems = previous.catalogRegistry?.[domain] || {};
      if (domainItems[String(item.id)]?.name === (item.name || item.allergen || item.allergy)) return previous;
      return {
        ...previous,
        catalogRegistry: {
          ...(previous.catalogRegistry || {}),
          [domain]: { ...domainItems, [String(item.id)]: item },
        },
      };
    });
  }, []);

  const handleEdit = (step) => {
    setCurrentStep(step);
    scrollToFormTop();
  };

  const handleSubmit = async () => {
    if (sessionChanged || !isCurrentPatientSession()) return;
    if (formData.profileType === 'Student' && revisionStatus?.status !== 'Revision' && !updateReviewConfirmed) {
      const reviewStepIndex = steps.indexOf('Review & Submit');
      setReviewConfirmationError(true);
      setValidationErrors([{ section: 'Review & Submit', sectionIndex: reviewStepIndex, message: 'Review the complete record and confirm it before submitting.' }]);
      setShowValidationModal(true);
      scrollToFormTop();
      return;
    }
    if (reviewHasUnresolvedChoices) return;
    if (!skipPersonalSubmit && !skipPersonalStep) {
      const lengthErrors = getPersonalLengthErrors();
      if (lengthErrors.length) {
        setValidationErrors(lengthErrors);
        setShowValidationModal(true);
        return;
      }
    }
    // submitUpdateRecord performs the authoritative ticket check immediately before writes.
    // Avoid a duplicate status request here; backend ticket guards still reject concurrent updates.
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
        if (lower === 'file_not_found') {
          errors.push({ section: 'Dental History', sectionIndex: steps.indexOf('Dental History'), message: 'A dental photo is unavailable. Please upload both teeth photos again and retry.' });
        } else if (lower.includes('already in progress') || lower.includes('cannot cancel update ticket')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A previous submission is still being processed. Please wait a moment and try again.' });
        } else if (lower.includes('invalid input value for enum') || lower.includes('invalid value')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'One or more fields contain invalid values. Please review your selections and try again.' });
        } else if (lower.includes('null value') || lower.includes('not-null') || lower.includes('violates not-null')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A required field is missing. Please review all sections and ensure nothing is left blank.' });
        } else if (lower.includes('unique constraint') || lower.includes('duplicate')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'This record has already been submitted.' });
        } else if (lower.includes('invalid input syntax') || /\bdate\b/.test(lower) || /\btimestamp\b/.test(lower)) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'A date field contains an invalid value. Please check and re-enter date fields.' });
        } else if (lower.includes('revision scope has changed')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'This revision form is out of date. Reload the form and try again.' });
        } else if (lower.includes('required records are missing or incomplete')) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Some required record details are missing. Review the form and complete the required fields before submitting.' });
        } else if (lower.includes('unauthorized') || error.status === 401 || error.response?.status === 401) {
          errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your session has expired. Please log out and log back in, then try again.' });
        } else if (lower === 'database error' || lower.startsWith('database error') || lower.includes('internal server error')) {
          // Suppress generic messages
        } else if (lower.includes('stored records could not be loaded') || lower.includes('database error') || lower.includes('internal server error')) {
          // Keep database details and generic GraphQL internals out of the patient UI.
        } else {
          // Only surface known domain-level errors. Unknown GraphQL messages may include
          // implementation details, so they fall through to the safe message below.
        }
      });
    } else if (error.response?.status === 401) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Your session has expired. Please log out and log back in, then try again.' });
    } else if (error.response?.status === 403) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'Access denied. You may not have permission to submit this form.' });
    } else if (error.response?.status >= 500) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'The server encountered an unexpected error. Please try again in a moment.' });
    } else if (error.message && !error.message.toLowerCase().includes('stored records could not be loaded')) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: error.message });
    } else {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'An unexpected error occurred. Please check your inputs and try again.' });
    }

    if (errors.length === 0) {
      errors.push({ section: 'Submission Error', sectionIndex: null, message: 'We couldn’t save your update. Your information has not been confirmed as submitted. Please try again. If this continues, contact support.' });
    }

    return errors;
  };

  const doSubmit = async () => {
    if (sessionChanged || !isCurrentPatientSession()) return;
    setIsSubmitting(true);
    const resolvedRecordType = effectiveRecordType || 'both';

    try {

      // Submit all records (this creates ticket FIRST, then personal info, then medical/dental)

      const results = await submitUpdateRecord(formData, resolvedRecordType, {
        skipPersonalUpdate: Boolean(skipPersonalSubmit || skipPersonalStep),
        revisionTicketId: revisionStatus?.status === 'Revision' ? revisionStatus.id : null,
      });

      clearRecordFormDraft(draftFlow);
      setActiveTicket({ id: results.ticketId, status: results.finalStatus || 'Pending', scope: { medical: 'Medical', dental: 'Dental', both: 'Both' }[resolvedRecordType] });

      // Show success modal!
      const recordTypeLabel = resolvedRecordType === 'both' ? 'Medical and Dental' : resolvedRecordType === 'medical' ? 'Medical' : 'Dental';
      setSuccessMessage(recordTypeLabel);
      setShowSuccessModal(true);

    } catch (error) {

      const parsedErrors = parseSubmissionError(error);
      setDbErrors(parsedErrors);
      setShowDbErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalClose = () => {
    const submittedRecordType = effectiveRecordType || recordType || null;
    setShowSuccessModal(false);
    clearRecordFormDraft(draftFlow);
    setRecordDraft({});
    setCurrentStep(0);
    setRecordType(null);
    setUpdateReviewConfirmed(false);
    setReviewConfirmationError(false);
    setRevisionStatus(null);

    if (typeof onSubmissionSuccess === 'function') {
      onSubmissionSuccess({ recordType: submittedRecordType });
    }
  };

  const renderStep = () => {
    if (sessionChanged) {
      return <p role="alert">Your sign-in changed. Reload this page before continuing.</p>;
    }
    if (waitingForProfile) {
      return profileLoadStatus === 'error' ? (
        <div role="alert">
          <p>Your stored records could not be loaded.</p>
          <button type="button" onClick={() => setPrefillAttempt(attempt => attempt + 1)} className="btn-secondary mt-3">Try again</button>
        </div>
      ) : <p role="status">Loading your saved records?</p>;
    }
    const stepName = steps[safeCurrentStep];
    switch (stepName) {
      case 'Personal Info':
        return <PersonalInfoStep formData={formData} onChange={updateRecordDraft} />;
      case 'Medical History':
        return <MedicalHistoryStep formData={formData} onChange={updateRecordDraft} onCatalogItemSelected={registerCatalogItem} />;
      case 'Dental History':
        return <DentalHistoryStep formData={formData} onChange={updateRecordDraft} onCatalogItemSelected={registerCatalogItem} />;
      case 'Review & Submit':
        return (
          <ReviewStep 
            formData={formData} 
            onEdit={handleEdit} 
            steps={steps}
            recordType={effectiveRecordType}
            onValidationStateChange={setReviewHasUnresolvedChoices}
            isRevision={revisionStatus?.status === 'Revision'}
            revisionNotes={revisionStatus?.notes || null}
            isReviewConfirmed={updateReviewConfirmed}
            reviewConfirmationError={reviewConfirmationError}
            onReviewConfirmedChange={(confirmed) => {
              setUpdateReviewConfirmed(confirmed);
              if (confirmed) setReviewConfirmationError(false);
            }}
          />
        );
      default:
        return null;
    }
  };

  const handleChoiceSelect = async (choice) => {
    if (hideRecordChoice) return;
    if (forceRecordType && choice !== forceRecordType) return; // only allow the forced type
    if (ticketStatusLoading || ticketStatusError || ['InProgress', 'Pending', 'Revision', 'RevisionSubmitted'].includes(activeTicket?.status)) return;
    try {
      const existing = await getUpdateTicketStatus({ strict: true });
      if (['Pending', 'Revision', 'InProgress', 'RevisionSubmitted'].includes(existing?.status)) {
        setActiveTicket(existing);
        return;
      }
    } catch {
      setTicketStatusError(true);
      return;
    }
    clearRecordFormDraft(draftFlow);
    setDraftRestored(false);
    setNeedsPhotoReupload(false);
    setRecordType(choice);
    setCurrentStep(0);
    setRecordDraft({});
    setUpdateReviewConfirmed(false);
    setReviewConfirmationError(false);
  };

  const handleChangeType = () => {
    if (forceRecordType || hideRecordChoice) return;
    clearRecordFormDraft(draftFlow);
    setDraftRestored(false);
    setNeedsPhotoReupload(false);
    setRecordType(null);
    setCurrentStep(0);
    setRecordDraft({});
    setUpdateReviewConfirmed(false);
    setReviewConfirmationError(false);
  };

  const handleStartRevision = () => {
    if (revisionStatus?.status !== 'Revision' || isLoadingRevisionPrefill) return;
    const scopeMap = { Medical: 'medical', Dental: 'dental', Both: 'both' };
    const recordTypeForRevision = scopeMap[revisionStatus.scope] || 'medical';

    if (!revisionDraftRestored && revisionPrefillData && Object.keys(revisionPrefillData).length > 0) {
      setRecordDraft(previous => {
        const merged = { ...previous, ...revisionPrefillData };
        if (revisionPrefillData.oralAppliances?.length > 0 && merged.hasOralAppliances !== true) {
          merged.hasOralAppliances = true;
        }
        return merged;
      });
    }

    if (!forceRecordType) setRecordType(recordTypeForRevision);
    if (!revisionDraftRestored) setCurrentStep(0);
    scrollToFormTop();
  };

  return (
    <div ref={formRef} className="record-form-ui">
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
              className="w-full px-6 py-3 bg-success-500 hover:bg-success-600 text-secondary-900 font-semibold rounded-lg transition-colors"
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

      {shouldShowRecordChoice ? (
        <RecordChoicePage
          onSelect={handleChoiceSelect}
          disabledChoiceIds={forceRecordType === 'both' ? ['medical', 'dental'] : []}
          activeTicket={activeTicket}
          statusLoading={ticketStatusLoading}
          statusError={ticketStatusError}
          onRetryStatus={syncRevisionStatus}
          onStartRevision={handleStartRevision}
          revisionLoading={isLoadingRevisionPrefill}
        />
      ) : (
        <div className="max-w-5xl mx-auto px-4">
          {isInactiveMode && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
              <p className="text-sm font-semibold text-yellow-800">Inactive Account Recovery Mode</p>
              <p className="text-xs text-yellow-700 mt-1">
                Complete your school information, emergency contacts, and medical and dental updates for staff re-checking and approval.
              </p>
            </div>
          )}
          {/* Header Section */}
          <div className="record-form-header sticky top-0 z-30 rounded-2xl mb-5 pb-2">
            <div className="px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-2">
              <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-lg sm:text-xl font-bold" style={{ margin: 0 }}>
                  Update {effectiveRecordType === 'medical' ? 'Medical Record' : effectiveRecordType === 'dental' ? 'Dental Record' : 'Medical & Dental Record'}
                </h1>
                <p className="text-sm" style={{ margin: 0 }}>
                  Keep your health information up-to-date
                </p>
              </div>
              {effectiveRecordType && !forceRecordType && !hideRecordChoice && (
                <button
                  type="button"
                  onClick={handleChangeType}
                  className="min-h-11 text-sm font-semibold border border-primary-700/20 bg-primary-50 dark:border-primary-400/30 dark:bg-primary-900 px-3 py-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            <ProgressStepper currentStep={safeCurrentStep} steps={steps} scrollContainerRef={formRef} compact />
            {revisionStatus?.status === 'Revision' && revisionStatus?.notes && (
              <div className="mx-4 sm:mx-6 mb-2 px-3 py-2 border border-primary-200 bg-primary-50 dark:border-primary-700 dark:bg-neutral-800 rounded-xl flex items-start gap-3">
                <svg className="w-4 h-4 text-secondary-800 dark:text-primary-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-secondary-900 dark:text-primary-200 uppercase tracking-wide">Staff Note</p>
                  <p className="text-sm text-secondary-800 dark:text-neutral-200 mt-1 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{revisionStatus.notes}</p>
                </div>
              </div>
            )}
          </div>

          {draftRestored && (
            <p role="status" className="-mt-3 mb-4 text-sm text-secondary-600 dark:text-neutral-300">
              <strong className="text-primary-700 dark:text-primary-300">Saved draft restored.</strong> Your entries were recovered from this browser tab.
              {needsPhotoReupload && <span className="block mt-1">Please upload dental photos again if you had added them before refreshing.</span>}
            </p>
          )}

          {/* Form Content */}
          <div className="mb-6">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="record-form-footer sticky bottom-0 z-10 bg-white dark:bg-neutral-900 rounded-2xl px-4 sm:px-6 py-3 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="flex justify-between items-center">
              <button
                onClick={backButtonState.action === 'cancel-to-choice' ? handleCancelToChoice : handleBack}
                disabled={backButtonState.disabled}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  backButtonState.disabled
                    ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:text-secondary-800 dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backButtonState.label}
              </button>

              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Step {steps.length > 0 ? safeCurrentStep + 1 : 0} of {steps.length}
              </span>

              <button
                onClick={safeCurrentStep === steps.length - 1 ? handleSubmit : handleNext}
                disabled={waitingForProfile || isSubmitting || isStepTransitioning || (safeCurrentStep === steps.length - 1 && reviewHasUnresolvedChoices)}
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
                ) : isStepTransitioning ? (
                  <span>Continuing...</span>
                ) : safeCurrentStep === steps.length - 1 ? (
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
    </div>
  );
};

export default RecordUpdateForm;
