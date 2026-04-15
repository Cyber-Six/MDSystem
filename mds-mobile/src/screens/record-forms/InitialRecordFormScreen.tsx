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
  const { refreshRecordStatus } = useRecordStatus();
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
  useEffect(() => {
    if (!isRevision && !isUpdate) return;
    fetchRevisionPrefill()
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
  }, [isRevision, isUpdate]);

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

  const handleNext = () => {
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

    // Personal Info — always validated
    if (!pi.surname?.trim()) errors.push('Surname is required');
    if (!pi.firstName?.trim()) errors.push('First name is required');
    if (!pi.birthday) errors.push('Birthday is required');
    if (!pi.gender) errors.push('Gender is required');
    if (!pi.civilStatus) errors.push('Civil status is required');
    if (!pi.nationality?.trim()) errors.push('Nationality is required');
    if (!pi.contactNumber?.trim()) errors.push('Contact number is required');
    else if (!isValidPhilippinePhone(pi.contactNumber.trim())) errors.push('Contact number must be a valid PH number (e.g. 09171234567)');
    if (!pi.address?.trim()) errors.push('Present address is required');
    if (!pi.program) errors.push('Program is required');
    if (pi.program === 'Other' && !pi.programOther?.trim()) errors.push('Please specify your program');
    if (!pi.studentNumber?.trim()) errors.push('Student number is required');
    if (!pi.studentCategory) errors.push('Student category is required');

    // Emergency contacts
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
    }

    // Dental History — only when relevant
    if (showDental) {
      const dh = formData.dentalHistory;
      if (!dh.firstTimeDentist) errors.push('First time dentist question is required');
      if (!dh.lastDentalCleaning) errors.push('Last dental cleaning is required');
      if (!dh.hasIntraOralAppliance) errors.push('Intra-oral appliance question is required');
      // Photos are mandatory for initial record, optional for updates
      if (!isUpdate) {
        if (!dh.upperTeethPhoto) errors.push('Upper teeth photo is required');
        if (!dh.lowerTeethPhoto) errors.push('Lower teeth photo is required');
      }
    }

    // OB-GYNE — only for females with medical steps
    if (isFemale && showMedical && !formData.obgyne?.lastMenstrualPeriod) errors.push('Last menstrual period is required');

    // Certification
    if (!formData.certification?.verified) errors.push('You must certify the information');

    return errors;
  };

  // ─── Submission ─────────────────────────────────────────────────────────────
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

    Alert.alert(
      'Submit Record',
      'Are you sure you want to submit your medical record? Please make sure all information is correct.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              if (isUpdate) {
                await submitUpdateRecord(formData, recordType);
              } else {
                await createInitialMedicalRecord(formData, { isRevision });
              }
              await refreshRecordStatus();
              Alert.alert(
                'Success!',
                'Your medical record has been submitted successfully.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              const msg = error?.message || 'An unexpected error occurred. Please try again.';
              Alert.alert('Submission Failed', msg);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
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
        return <PersonalInfoStep formData={formData} onUpdate={updatePersonalInfo} isDark={isDark} errors={{}} />;
      case 1:
        return <MedicalHistoryStep formData={formData} onUpdate={(_section: string, data: any) => updateMedicalHistory(data)} isDark={isDark} catalogs={catalogs} />;
      case 2:
        return <MedicalBackgroundStep formData={formData} onUpdateBg={updateMedicalBackground} isDark={isDark} catalogs={catalogs} />;
      case 3:
        return <DentalHistoryStep formData={formData} onUpdate={updateDentalHistory} isDark={isDark} catalogs={catalogs} />;
      case 4:
        return <ObGyneStep formData={formData} onUpdate={updateObgyne} isDark={isDark} />;
      case 5:
        return <ReviewStep formData={formData} catalogs={catalogs} onEdit={handleEdit} isDark={isDark} />;
      default:
        return null;
    }
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Text style={{ color: colors.primary[500], fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
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
