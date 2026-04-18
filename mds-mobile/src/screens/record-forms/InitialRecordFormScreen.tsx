/**
 * InitialRecordFormScreen — Main orchestrator for the multi-step initial medical record form.
 * Manages step navigation, catalog loading, validation, and 3-phase submission.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, colors } from '../../context/ThemeContext';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { ProgressStepper } from '../../components/ui/ProgressStepper';
import PersonalInfoStep from './steps/PersonalInfoStep';
import MedicalHistoryStep from './steps/MedicalHistoryStep';
import MedicalBackgroundStep from './steps/MedicalBackgroundStep';
import DentalHistoryStep from './steps/DentalHistoryStep';
import ObGyneStep from './steps/ObGyneStep';
import ReviewStep from './steps/ReviewStep';
import {
  createEmptyFormData, fetchAllCatalogs, createInitialMedicalRecord,
  submitUpdateRecord, fetchRevisionPrefill, checkInitialRecordStatus,
  getUpdateTicketStatus,
  type FormData, type AllCatalogs,
} from '../../services/emr-service';

const ALL_STEPS = ['Personal Info', 'Medical History', 'Medical Background', 'Dental History', 'OB-GYNE', 'Review'];

const isValidPhilippinePhone = (raw: string): boolean => {
  const stripped = raw.replace(/[\s\-().]/g, '');
  return /^0\d{10}$/.test(stripped) || /^\+63\d{10}$/.test(stripped) || /^63\d{10}$/.test(stripped);
};

const InitialRecordFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const { refreshRecordStatus, recordStatus, isRecordLoading } = useRecordStatus();
  const scrollRef = useRef<ScrollView>(null);

  const isRevision = route.params?.isRevision ?? false;
  const isUpdate = route.params?.isUpdate ?? false;
  const recordType: 'medical' | 'dental' | 'both' = route.params?.recordType ?? 'both';

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(createEmptyFormData());
  const [catalogs, setCatalogs] = useState<AllCatalogs & { catalogsLoading: boolean }>({
    medicalConditionCatalog: [], hospitalizationCatalog: [], operationCatalog: [],
    medicationCatalog: [], immunizationCatalog: [], allergenCatalog: [],
    oralApplianceCatalog: [], visualAcuityCatalog: [], dentalProcedureCatalog: [],
    catalogsLoading: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load catalogs on mount
  useEffect(() => {
    fetchAllCatalogs()
      .then(cats => setCatalogs({ ...cats, catalogsLoading: false }))
      .catch(err => {
        console.warn('[RecordForm] Catalog fetch failed:', err.message);
        setCatalogs(prev => ({ ...prev, catalogsLoading: false }));
      });
  }, []);

  // Load revision/update data if applicable
  // Only prefill for revisions (staff requested corrections) — not for regular updates.
  // Regular updates start with a fresh form, matching mds-patient behavior.
  useEffect(() => {
    if (!isRevision) return;

    if (isRecordLoading) return;

    fetchRevisionPrefill(recordType)
      .then(data => {
        if (data) {
          setFormData(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, ...data.personalInfo },
            medicalHistory: { ...prev.medicalHistory, ...data.medicalHistory },
            medicalBackground: { ...prev.medicalBackground, ...data.medicalBackground },
            dentalHistory: { ...prev.dentalHistory, ...data.dentalHistory },
            ...(data.obgyne ? { obgyne: { ...prev.obgyne, ...data.obgyne } } : {}),
          }));
        }
      })
      .catch(err => console.warn('[RecordForm] Prefill failed:', err.message));
  }, [isRevision, isRecordLoading]);

  const isFemale = formData.personalInfo.gender === 'Female';

  // Build steps based on mode (initial vs update) and recordType
  const getSteps = () => {
    if (!isUpdate) {
      // Initial record: all steps
      return isFemale ? ALL_STEPS : ALL_STEPS.filter((_, i) => i !== 4);
    }
    // Update mode: dynamic steps based on recordType
    const updateSteps = ['Personal Info'];
    if (recordType === 'medical' || recordType === 'both') {
      updateSteps.push('Medical History', 'Medical Background');
      if (isFemale) updateSteps.push('OB-GYNE');
    }
    if (recordType === 'dental' || recordType === 'both') {
      updateSteps.push('Dental History');
    }
    updateSteps.push('Review');
    return updateSteps;
  };

  const steps = getSteps();

  // Map step names to actual step indices (in ALL_STEPS)
  const STEP_INDEX_MAP: Record<string, number> = {
    'Personal Info': 0, 'Medical History': 1, 'Medical Background': 2,
    'Dental History': 3, 'OB-GYNE': 4, 'Review': 5,
  };
  const getActualStepIndex = (displayStep: number) => STEP_INDEX_MAP[steps[displayStep]] ?? 0;
  const actualStep = getActualStepIndex(currentStep);

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  // ─── Per-step validation (aligned with mds-patient record-update-form) ──────
  const validateCurrentStep = (): string[] => {
    const stepName = steps[currentStep];
    const errors: string[] = [];

    if (stepName === 'Personal Info') {
      const pi = formData.personalInfo;
      if (!isUpdate) {
        // Initial record validates all personal fields
        if (!pi.surname?.trim()) errors.push('Surname is required');
        if (!pi.firstName?.trim()) errors.push('First name is required');
        if (!pi.birthday) errors.push('Birthday is required');
        if (!pi.gender) errors.push('Gender is required');
        if (!pi.civilStatus) errors.push('Civil status is required');
        if (!pi.nationality?.trim()) errors.push('Nationality is required');
        if (!pi.contactNumber?.trim()) errors.push('Contact number is required');
        else if (!isValidPhilippinePhone(pi.contactNumber.trim())) errors.push('Contact number must be a valid PH number (e.g. 09171234567)');
        if (!pi.address?.trim()) errors.push('Present address is required');
        if (!pi.studentNumber?.trim()) errors.push('Student number is required');
      }
      if (!pi.program) errors.push('Please select a program before proceeding');
      if (!pi.studentCategory) errors.push('Please select your student category before proceeding');

      const c1 = pi.emergencyContacts?.[0];
      const c2 = pi.emergencyContacts?.[1];
      if (!c1?.name?.trim()) errors.push('1st emergency contact name is required');
      if (!c1?.relationship?.trim()) errors.push('1st emergency contact relationship is required');
      if (!c1?.contactNumber?.trim()) errors.push('1st emergency contact number is required');
      else if (!isValidPhilippinePhone(c1.contactNumber.trim())) errors.push('1st emergency contact number must be a valid PH number');
      if (!c2?.name?.trim()) errors.push('2nd emergency contact name is required');
      if (!c2?.relationship?.trim()) errors.push('2nd emergency contact relationship is required');
      if (!c2?.contactNumber?.trim()) errors.push('2nd emergency contact number is required');
      else if (!isValidPhilippinePhone(c2.contactNumber.trim())) errors.push('2nd emergency contact number must be a valid PH number');
    }

    if (stepName === 'Medical Background') {
      const mb = formData.medicalBackground;
      // Lifestyle habits are always required (aligned with mds-patient)
      if (!mb.smoker) errors.push('Please indicate if you smoke (Lifestyle Habits)');
      if (!mb.alcoholDrinker) errors.push('Please indicate if you drink alcohol (Lifestyle Habits)');

      // Allergy details validation
      if (mb.hasAllergies === 'Yes') {
        const selectedAllergies = Object.entries(mb.allergies)
          .filter(([, val]) => (typeof val === 'object' ? (val as any)?.checked : !!val));
        for (const [, val] of selectedAllergies) {
          const detail = typeof val === 'object' ? val as any : {};
          if (!detail.status || !detail.severity) {
            errors.push('Please fill in Status and Severity for all selected allergies');
            break;
          }
        }
      }

      // Hospitalization dates
      if (mb.hasHospitalization === 'Yes') {
        const checkedIds = Object.entries(mb.hospitalizationConditions)
          .filter(([, v]) => v).map(([k]) => k);
        if (checkedIds.some(id => !mb.hospitalizationDates?.[id]?.admissionDate)) {
          errors.push('Please fill in the Admission Date for all selected hospitalizations');
        }
      }

      // Operation dates
      if (mb.hasOperation === 'Yes') {
        const checkedIds = Object.entries(mb.operationConditions)
          .filter(([, v]) => v).map(([k]) => k);
        if (checkedIds.some(id => !mb.operationDates?.[id])) {
          errors.push('Please fill in the Operation Date for all selected surgeries');
        }
      }

      // Medications
      if (mb.hasMedications === 'Yes') {
        if (!Object.values(mb.selectedMedications).some(v => v)) {
          errors.push('Please select at least one medication');
        }
      }

      if (!mb.hasHospitalization) errors.push('Hospitalization question is required');
      if (!mb.hasOperation) errors.push('Surgery/Operation question is required');
    }

    if (stepName === 'OB-GYNE') {
      if (!formData.obgyne?.lastMenstrualPeriod) {
        errors.push('Last menstrual period date is required');
      }
    }

    if (stepName === 'Dental History') {
      const dh = formData.dentalHistory;
      if (!dh.firstTimeDentist) errors.push('Please indicate whether you have visited a dentist');
      if (!dh.lastDentalCleaning) errors.push('Please select when your last dental cleaning was');

      // Oral appliance fields
      if (dh.hasIntraOralAppliance === 'yes') {
        const checkedAppliances = Object.entries(dh.intraOralAppliances)
          .filter(([, val]) => (typeof val === 'object' ? (val as any)?.checked : !!val));
        for (const [, val] of checkedAppliances) {
          const appData = typeof val === 'object' ? val as any : {};
          if (!appData.status || !appData.dateIssued) {
            errors.push('Please fill in Status and Date Issued for all selected oral appliances');
            break;
          }
        }
      }

      // Dental procedure dates
      const checkedProcs = Object.entries(dh.selectedDentalProcedures).filter(([, v]) => v);
      for (const [id] of checkedProcs) {
        if (!dh.procedureDates?.[id]) {
          errors.push('Please fill in the Date for all selected dental procedures');
          break;
        }
      }

      // Dental photos — required for initial record; also required for dental/both updates
      // (aligned with mds-patient: backend DentalPhotoRecordInput requires UUID! for both)
      if (!isUpdate) {
        if (!dh.upperTeethPhoto) errors.push('Upper teeth photo is required');
        if (!dh.lowerTeethPhoto) errors.push('Lower teeth photo is required');
      } else {
        // For updates, photos are valid if they have .uri (new upload) or .id (from revision)
        if (!dh.upperTeethPhoto?.uri && !dh.upperTeethPhoto?.id) {
          errors.push('Please upload a photo of your upper teeth');
        }
        if (!dh.lowerTeethPhoto?.uri && !dh.lowerTeethPhoto?.id) {
          errors.push('Please upload a photo of your lower teeth');
        }
      }
    }

    return errors;
  };

  const handleNext = () => {
    // Validate current step before proceeding (aligned with mds-patient)
    const stepErrors = validateCurrentStep();
    if (stepErrors.length > 0) {
      Alert.alert('Incomplete Form', stepErrors.join('\n\n'), [{ text: 'OK' }]);
      scrollToTop();
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      scrollToTop();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollToTop();
    }
  };

  const handleEdit = (actualStepIndex: number) => {
    // Find display step index for the given actual step
    const stepName = ALL_STEPS[actualStepIndex];
    const displayIdx = steps.indexOf(stepName);
    if (displayIdx >= 0) {
      setCurrentStep(displayIdx);
      scrollToTop();
    }
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validateAllFields = (): string[] => {
    const errors: string[] = [];
    const pi = formData.personalInfo;

    // Personal Info — only validate personal fields for initial records (not updates)
    if (!isUpdate) {
      if (!pi.surname?.trim()) errors.push('Surname is required');
      if (!pi.firstName?.trim()) errors.push('First name is required');
      if (!pi.birthday) errors.push('Birthday is required');
      if (!pi.gender) errors.push('Gender is required');
      if (!pi.civilStatus) errors.push('Civil status is required');
      if (!pi.nationality?.trim()) errors.push('Nationality is required');
      if (!pi.contactNumber?.trim()) errors.push('Contact number is required');
      else if (!isValidPhilippinePhone(pi.contactNumber.trim())) errors.push('Contact number must be a valid PH number (e.g. 09171234567)');
      if (!pi.address?.trim()) errors.push('Present address is required');
      if (!pi.studentNumber?.trim()) errors.push('Student number is required');
    }
    // Program + student category are always required (initial + update)
    if (!pi.program) errors.push('Program is required');
    if (!isUpdate && pi.program === 'Other' && !pi.programOther?.trim()) errors.push('Please specify your program');
    if (!pi.studentCategory) errors.push('Student category is required');

    // Emergency contacts — always required
    const c1 = pi.emergencyContacts?.[0];
    const c2 = pi.emergencyContacts?.[1];
    if (!c1?.name?.trim()) errors.push('1st emergency contact name is required');
    if (!c1?.contactNumber?.trim()) errors.push('1st emergency contact number is required');
    else if (!isValidPhilippinePhone(c1.contactNumber.trim())) errors.push('1st emergency contact number must be a valid PH number');
    if (!c2?.name?.trim()) errors.push('2nd emergency contact name is required');
    if (!c2?.contactNumber?.trim()) errors.push('2nd emergency contact number is required');
    else if (!isValidPhilippinePhone(c2.contactNumber.trim())) errors.push('2nd emergency contact number must be a valid PH number');

    const showMedical = !isUpdate || recordType === 'medical' || recordType === 'both';
    const showDental = !isUpdate || recordType === 'dental' || recordType === 'both';

    // Medical Background — only when relevant
    if (showMedical) {
      const mb = formData.medicalBackground;
      if (!mb.hasHospitalization) errors.push('Hospitalization question is required');
      if (!mb.hasOperation) errors.push('Surgery/Operation question is required');
      // Lifestyle (aligned with mds-patient)
      if (!mb.smoker) errors.push('Please indicate if you smoke');
      if (!mb.alcoholDrinker) errors.push('Please indicate if you drink alcohol');
    }

    // Dental History — only when relevant
    if (showDental) {
      const dh = formData.dentalHistory;
      if (!dh.firstTimeDentist) errors.push('First time dentist question is required');
      if (!dh.lastDentalCleaning) errors.push('Last dental cleaning is required');
      if (!dh.hasIntraOralAppliance) errors.push('Intra-oral appliance question is required');
      // Photos — required for initial; id or uri accepted for updates
      if (!isUpdate) {
        if (!dh.upperTeethPhoto) errors.push('Upper teeth photo is required');
        if (!dh.lowerTeethPhoto) errors.push('Lower teeth photo is required');
      } else {
        if (!dh.upperTeethPhoto?.uri && !dh.upperTeethPhoto?.id) errors.push('Upper teeth photo is required');
        if (!dh.lowerTeethPhoto?.uri && !dh.lowerTeethPhoto?.id) errors.push('Lower teeth photo is required');
      }
    }

    // OB-GYNE — only for females with medical steps
    if (isFemale && showMedical && !formData.obgyne?.lastMenstrualPeriod) errors.push('Last menstrual period is required');

    // Certification
    if (!formData.certification?.verified) errors.push('You must certify the information');

    return errors;
  };

  // ─── Error parsing (aligned with mds-patient parseSubmissionError) ──────────
  const parseSubmissionError = (error: any): string => {
    const gqlMessages = (
      error.graphQLErrors ?? error.response?.data?.errors ?? []
    ).map((e: any) => e?.message).filter(Boolean);

    if (gqlMessages.length > 0) {
      const errorMsgs: string[] = [];
      for (const msg of gqlMessages) {
        const lower = msg.toLowerCase();
        if (lower.includes('already in progress') || lower.includes('cannot cancel update ticket')) {
          errorMsgs.push('A previous submission is still being processed. Please wait a moment and try again.');
        } else if (lower.includes('invalid input value') || lower.includes('invalid value')) {
          errorMsgs.push('One or more fields contain invalid values. Please review your selections and try again.');
        } else if (lower.includes('null value') || lower.includes('not-null') || lower.includes('violates not-null')) {
          errorMsgs.push('A required field is missing. Please review all sections and ensure nothing is left blank.');
        } else if (lower.includes('unique constraint') || lower.includes('duplicate')) {
          errorMsgs.push('This record has already been submitted.');
        } else if (lower.includes('invalid input syntax') || /\bdate\b/.test(lower) || /\btimestamp\b/.test(lower)) {
          errorMsgs.push('A date field contains an invalid value. Please check and re-enter date fields.');
        } else if (lower.includes('unauthorized') || error.response?.status === 401) {
          errorMsgs.push('Your session has expired. Please log out and log back in, then try again.');
        } else if (lower === 'database error' || lower.startsWith('database error') || lower.includes('internal server error')) {
          // Suppress generic messages
        } else {
          errorMsgs.push(msg);
        }
      }
      if (errorMsgs.length > 0) return errorMsgs.join('\n\n');
    }

    if (error.response?.status === 401) return 'Your session has expired. Please log out and log back in, then try again.';
    if (error.response?.status === 403) return 'Access denied. You may not have permission to submit this form.';
    if (error.response?.status >= 500) return 'The server encountered an unexpected error. Please try again in a moment.';
    if (error.message) return error.message;
    return 'An unexpected error occurred. Please check your inputs and try again.';
  };

  // ─── Submission ─────────────────────────────────────────────────────────────
  const doSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (isUpdate) {
        await submitUpdateRecord(formData, recordType);
      } else {
        await createInitialMedicalRecord(formData, { isRevision });
      }
      await refreshRecordStatus();
      const recordTypeLabel = isUpdate
        ? (recordType === 'both' ? 'Medical and Dental' : recordType === 'medical' ? 'Medical' : 'Dental')
        : 'Medical';
      Alert.alert(
        'Record Updated Successfully!',
        `Your ${recordTypeLabel} record has been submitted for review.\n\n` +
        '• Your update has been received and is now pending review\n' +
        '• The medical staff will review your submission\n' +
        '• You\'ll receive a notification if more changes are needed',
        [{ text: 'Back to Updates', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const msg = parseSubmissionError(error);
      Alert.alert('Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const errors = validateAllFields();
    if (errors.length > 0) {
      Alert.alert(
        'Validation Issues',
        errors.join('\n\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    // For updates: check for existing pending ticket and warn (aligned with mds-patient)
    if (isUpdate && !isRevision) {
      try {
        const existingTicket = await getUpdateTicketStatus();
        if (existingTicket?.status === 'Pending') {
          Alert.alert(
            'Existing Request Found',
            `You already have a ${existingTicket.scope || 'record'} update request that is currently pending staff review.\n\n` +
            `If you continue, your existing ${existingTicket.scope || ''} request will be cancelled and replaced with this new submission.`,
            [
              { text: 'Keep Old Request', style: 'cancel' },
              {
                text: 'Cancel Old & Continue',
                style: 'destructive',
                onPress: () => {
                  Alert.alert(
                    'Submit Record',
                    'Are you sure you want to submit your record? Please make sure all information is correct.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Submit', onPress: doSubmit },
                    ]
                  );
                },
              },
            ]
          );
          return;
        }
      } catch {
        // If ticket check fails, proceed normally
      }
    }

    Alert.alert(
      'Submit Record',
      'Are you sure you want to submit your medical record? Please make sure all information is correct.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: doSubmit },
      ]
    );
  };

  // ─── Update handlers ───────────────────────────────────────────────────────
  const updatePersonalInfo = useCallback((data: Partial<FormData['personalInfo']>) => {
    setFormData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, ...data } }));
  }, []);

  const updateMedicalHistory = useCallback((data: Partial<FormData['medicalHistory']>) => {
    setFormData(prev => ({ ...prev, medicalHistory: { ...prev.medicalHistory, ...data } }));
  }, []);

  const updateMedicalBackground = useCallback((data: Partial<FormData['medicalBackground']>) => {
    setFormData(prev => ({ ...prev, medicalBackground: { ...prev.medicalBackground, ...data } }));
  }, []);

  const updateDentalHistory = useCallback((data: Partial<FormData['dentalHistory']>) => {
    setFormData(prev => ({ ...prev, dentalHistory: { ...prev.dentalHistory, ...data } }));
  }, []);

  const updateObgyne = useCallback((data: Partial<NonNullable<FormData['obgyne']>>) => {
    setFormData(prev => ({ ...prev, obgyne: { ...prev.obgyne!, ...data } }));
  }, []);

  const updateCertification = useCallback((verified: boolean) => {
    setFormData(prev => ({
      ...prev,
      certification: {
        verified,
        fullName: `${prev.personalInfo.surname}, ${prev.personalInfo.firstName} ${prev.personalInfo.middleName}`.trim(),
        date: new Date().toISOString().split('T')[0],
      },
    }));
  }, []);

  // ─── Render step ────────────────────────────────────────────────────────────
  const renderStepContent = () => {
    if (catalogs.catalogsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Loading form data...</Text>
        </View>
      );
    }

    switch (actualStep) {
      case 0:
        return <PersonalInfoStep formData={formData} onUpdate={updatePersonalInfo} isDark={isDark} errors={{}} isUpdate={isUpdate} />;
      case 1:
        return <MedicalHistoryStep formData={formData} onUpdate={(_section: string, data: any) => updateMedicalHistory(data)} isDark={isDark} catalogs={catalogs} />;
      case 2:
        return <MedicalBackgroundStep formData={formData} onUpdateBg={updateMedicalBackground} isDark={isDark} catalogs={catalogs} />;
      case 3:
        return <DentalHistoryStep formData={formData} onUpdate={updateDentalHistory} isDark={isDark} catalogs={catalogs} />;
      case 4:
        return <ObGyneStep formData={formData} onUpdate={updateObgyne} isDark={isDark} />;
      case 5:
        return <ReviewStep formData={formData} catalogs={catalogs} onEdit={handleEdit} isDark={isDark} onCertificationChange={v => updateCertification(v)} />;
      default:
        return null;
    }
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <View style={styles.headerBackBtn} />
        <Text style={[styles.headerTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
          {isUpdate
            ? `Update ${recordType === 'medical' ? 'Medical' : recordType === 'dental' ? 'Dental' : 'Medical & Dental'} Record`
            : isRevision ? 'Revise Medical Record' : 'Initial Medical Record'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress Stepper */}
      <View style={[styles.stepperContainer, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]}>
        <ProgressStepper steps={steps} currentStep={currentStep} isDark={isDark} />
      </View>

      {/* Step Content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scrollRef} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Nav Bar */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnOutline, currentStep === 0 && styles.navBtnDisabled]}
          onPress={handleBack}
          disabled={currentStep === 0}
        >
          <Text style={[styles.navBtnText, { color: currentStep === 0 ? colors.neutral[400] : colors.primary[500] }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.stepIndicator, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          {currentStep + 1} / {steps.length}
        </Text>

        {isLastStep ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary, isSubmitting && styles.navBtnDisabled]}
            onPress={() => {
              updateCertification(true);
              // Small delay to let state update, then submit
              setTimeout(handleSubmit, 100);
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={[styles.navBtnText, { color: '#FFF' }]}>Submit</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={handleNext}>
            <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBackBtn: { width: 60 },
  headerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', flex: 1 },
  stepperContainer: { paddingHorizontal: 12, paddingVertical: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, fontSize: 14 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  navBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  navBtnOutline: { borderWidth: 1, borderColor: colors.primary[500] },
  navBtnPrimary: { backgroundColor: colors.primary[500] },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  stepIndicator: { fontSize: 13 },
});

export default InitialRecordFormScreen;
