import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { axiosRequest } from '../../packages-core-adapter';
import { GQL_FULL_RECORD, GQL_PERSONAL_PROFILE, MOCK_PATIENT_RECORDS, STATUS_BANNER } from './patient-record-data';
import * as consultationService from './consultation-service';
import { ENUM_TO_CODE } from './components/tooth-chart-constants';

const GQL_BASIC_RECORD_FALLBACK = `
  query GetPatientBasicRecordFallback($userId: ID!) {
    getPatientBasicInfo(userId: $userId) {
      id
      identifier
      branch
      sex
      first_name
      last_name
      middle_name
      suffix
      profile_type
      program
      year
      department
      role
      latest_ticket_id
      latest_status
      latest_scope
      latest_updated_at
    }
    getUserUpdateTicket(userId: $userId) {
      id
      patientId
      status
      scope
    }
  }
`;

const PatientPersonalInfoTab = lazy(() => import('./components/personal-info-tab'));
const PatientMedicalRecordTab = lazy(() => import('./components/medical-record-tab'));
const PatientDentalRecordTab = lazy(() => import('./components/dental-record-tab'));
const PatientConsultationTab = lazy(() => import('./components/consultation-tab'));
const PatientConsultationHistoryTab = lazy(() => import('./components/consultation-history-tab'));
const PatientAppointmentsTab = lazy(() => import('./components/appointments-tab'));
const PatientMedicineRequestsTab = lazy(() => import('./components/medicine-requests-tab'));
const PatientDocumentsTab = lazy(() => import('./components/documents-tab'));
const PatientObgyneTab = lazy(() => import('./components/obgyne-tab'));
const PatientDentalGradeHistoryTab = lazy(() => import('./components/dental-grade-history-tab'));
const PatientMedicalRecordHistoryTab = lazy(() => import('./components/medical-record-history-tab'));
const VitalSignsTab = lazy(() => import('./components/vital-signs-tab'));
const DentalGradingTab = lazy(() => import('./components/dental-grading-tab'));

function LoadingBlock({ label }) {
  return (
    <div className="p-6 text-center">
      <svg className="animate-spin mx-auto w-6 h-6 text-primary-500 mb-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-xs text-secondary-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}

function toDisplayPatient(patientId, data, mockPatient, profileData, vitalsData) {
  if (mockPatient) return mockPatient;

  const basicInfo = data?.getPatientBasicInfo;
  const updateTicket = data?.getUserUpdateTicket || null;
  const vitalSigns = vitalsData?.[0] || null;
  const medicalHistory = data?.getUserMedicalHistory?.[0] || null;
  const allergyData = data?.getUserAllergyProfile?.[0] || null;
  const immunizationData = data?.getUserImmunizationProfile?.[0] || null;
  const lifestyleData = data?.getUserLifestyle?.[0] || null;
  const obgynData = data?.getUserObgynHistory?.[0] || null;
  const emergencyData = data?.getUserEmergencyContact?.[0] || null;
  const medicationData = data?.getUserMedicationProfile?.[0] || null;
  const dentalHistory = (data?.getUserDentalHistory || []).find(r => r.status === 'Approved') || null;
  const applianceData = (data?.getUserOralApplianceProfile || []).find(r => r.status === 'Approved') || null;
  const procedureData = (data?.getUserDentalProcedureProfile || []).find(r => r.status === 'Approved') || null;
  const dentalPhotoData = (data?.getUserDentalPhotoRecord || []).find(r => r.status === 'Approved') || null;

  // Find the latest approved-visit submission timestamp so we can detect a stale
  // dental grade (one the staff created for a previous visit but never updated for
  // the newly-approved submission).
  const _latestApprovedVisitTs = [
    dentalHistory?.created_at,
    applianceData?.created_at,
    procedureData?.created_at,
    dentalPhotoData?.created_at,
  ].filter(Boolean).reduce((max, ts) => (new Date(ts) > new Date(max) ? ts : max), null);

  // Use the same offset logic as the Dental Record History sub-tab: skip standalone
  // grades (created from the Dental Grading tab) so the Dental Record tab always
  // displays the most recent visit-linked dental record, not a standalone grade.
  const _allDentalRecords = data?.getUserDentalRecord || [];
  const _dentalVisitMaxCount = Math.max(
    (data?.getUserDentalHistory || []).filter(r => r.status === 'Approved').length,
    (data?.getUserDentalProcedureProfile || []).filter(r => r.status === 'Approved').length,
    (data?.getUserOralApplianceProfile || []).filter(r => r.status === 'Approved').length,
    (data?.getUserDentalPhotoRecord || []).filter(r => r.status === 'Approved').length,
  );
  const _dentalOffset = Math.max(0, _allDentalRecords.length - _dentalVisitMaxCount);
  const _candidateDentalRecord = _allDentalRecords[_dentalOffset] || _allDentalRecords[0] || null;
  // If the candidate dental grade was created BEFORE the most recent approved visit
  // submission, the staff hasn't graded this new record yet — don't show stale data.
  const dentalRecord = (_candidateDentalRecord && _latestApprovedVisitTs &&
    new Date(_candidateDentalRecord.created_at) < new Date(_latestApprovedVisitTs))
    ? null
    : _candidateDentalRecord;
  const visionData = data?.getUserVisualAcuityProfile?.[0] || null;
  const hospData = data?.getUserHospitalizationProfile?.[0] || null;
  const opData = data?.getUserOperationProfile?.[0] || null;

  const profile = profileData?.getUserPersonalRecord || null;

  // Build catalog lookup maps (id → name/allergen)
  const allergenMap = {};
  (data?.allergenCatalogs || []).forEach((c) => { allergenMap[c.id] = c; });

  const conditionMap = {};
  (data?.conditionCatalogs || []).forEach((c) => { conditionMap[c.id] = c.name; });

  const immunizationMap = {};
  (data?.immunizationCatalogs || []).forEach((c) => { immunizationMap[c.id] = c.name; });

  const operationMap = {};
  (data?.operationCatalogs || []).forEach((c) => { operationMap[c.id] = c.name; });

  const hospitalizationMap = {};
  (data?.hospitalizationCatalogs || []).forEach((c) => { hospitalizationMap[c.id] = c.name; });

  const dentalProcedureMap = {};
  (data?.dentalProcedureCatalogs || []).forEach((c) => { dentalProcedureMap[c.id] = c.name; });

  const medicationMap = {};
  (data?.medicationCatalogs || []).forEach((c) => { medicationMap[c.id] = c.name; });

  const applianceTagMap = {};
  (data?.oralApplianceCatalogs || []).forEach((c) => { applianceTagMap[c.id] = c.name; });

  const oralFindingCatalogs = data?.oralFindingCatalogs || [];

  // Resolve allergies by type
  const allergyList = allergyData?.allergies || [];
  const drugAllergies  = allergyList.filter((a) => allergenMap[a.allergenCatalogId]?.type === 'Drug').map((a) => allergenMap[a.allergenCatalogId]?.allergen || `#${a.allergenCatalogId}`);
  const foodAllergies  = allergyList.filter((a) => allergenMap[a.allergenCatalogId]?.type === 'Food').map((a) => allergenMap[a.allergenCatalogId]?.allergen || `#${a.allergenCatalogId}`);
  const otherAllergies = allergyList.filter((a) => {
    const t = allergenMap[a.allergenCatalogId]?.type;
    return t && t !== 'Drug' && t !== 'Food';
  }).map((a) => allergenMap[a.allergenCatalogId]?.allergen || `#${a.allergenCatalogId}`);

  // Format date_of_birth → readable date + age
  let birthDate = '';
  let age = '';
  if (profile?.date_of_birth) {
    const dob = new Date(profile.date_of_birth);
    birthDate = dob.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
    const today = new Date();
    age = String(today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0));
  }

  return {
    id: patientId || '',
    name: basicInfo ? `${basicInfo.first_name || ''} ${basicInfo.last_name || ''}`.trim() : '',
    email: profile?.email || '',
    program: basicInfo?.program || basicInfo?.department || '',
    year: basicInfo?.year || basicInfo?.role || '',
    department: basicInfo?.department || '',
    semester: '',
    status: updateTicket?.status || basicInfo?.latest_status || '',
    credentialStatus: basicInfo?.credentials_status || '',
    type: basicInfo?.profile_type || 'Student',
    avatar: null,
    personal: {
      firstName: basicInfo?.first_name || '',
      middleName: basicInfo?.middle_name || '',
      lastName: basicInfo?.last_name || '',
      suffix: basicInfo?.suffix || '',
      birthDate,
      age,
      sex: profile?.sex || basicInfo?.sex || '',
      civilStatus: profile?.civil_status || '',
      nationality: profile?.nationality || '',
      religion: profile?.religion || '',
      presentAddress: profile?.present_address || '',
      provinceAddress: profile?.province_address || '',
      contactNumber: profile?.contactNumber || '',
      studentNumber: basicInfo?.identifier || '',
      studentCategory: '',
      lastSchoolAttended: '',
      drugTestDone: '',
      employeeNumber: basicInfo?.identifier || '',
      position: basicInfo?.role || '',
      employmentCategory: '',
      employmentStatus: '',
      branch: basicInfo?.branch || '',
    },
    emergencyContacts: {
      first: {
        name: emergencyData?.firstContact?.contactName || '',
        relationship: emergencyData?.firstContact?.relationship || '',
        contact: emergencyData?.firstContact?.contactNumber || '',
        address: emergencyData?.firstContact?.address || '',
      },
      second: {
        name: emergencyData?.secondContact?.contactName || '',
        relationship: emergencyData?.secondContact?.relationship || '',
        contact: emergencyData?.secondContact?.contactNumber || '',
        address: emergencyData?.secondContact?.address || '',
      },
    },
    medicalHistory: {
      self: (medicalHistory?.conditions || [])
        .filter((c) => !c.relationship || c.relationship === 'self')
        .map((c) => c.description || conditionMap[c.conditionId] || `Condition #${c.conditionId}`),
      notes: medicalHistory?.notes || '',
      family: (medicalHistory?.conditions || [])
        .filter((c) => c.relationship && c.relationship !== 'self')
        .map((c) => ({
          name: c.description || conditionMap[c.conditionId] || `Condition #${c.conditionId}`,
          relationship: c.relationship,
        })),
    },
    medical: {
      vitalSigns: {
        height: vitalSigns?.height_cm || '',
        weight: vitalSigns?.weight_kg || '',
        bmi: vitalSigns?.height_cm && vitalSigns?.weight_kg ? (vitalSigns.weight_kg / ((vitalSigns.height_cm / 100) ** 2)).toFixed(1) : '',
        bp: vitalSigns?.blood_pressure || '',
        heartRate: vitalSigns?.heart_rate || '',
        temperature: vitalSigns?.temperature || '',
        lastChecked: vitalSigns?.created_at ? new Date(vitalSigns.created_at).toLocaleDateString('en-PH') : '',
      },
      bloodType: '',
      allergies: {
        drug:  drugAllergies.join(', ')  || '',
        food:  foodAllergies.join(', ')  || '',
        other: otherAllergies.join(', ') || '',
      },
      allergiesList: allergyList.map((a) => ({
        name: allergenMap[a.allergenCatalogId]?.allergen || `Allergen #${a.allergenCatalogId}`,
        type: allergenMap[a.allergenCatalogId]?.type || '',
        severity: a.severity || '',
        status: a.status || '',
      })),
      conditions: [],
      medications: (medicationData?.medications || []).map((m) => ({
        name: medicationMap[m.medicineId] || `Medicine #${m.medicineId}`,
        description: m.description || '',
      })),
      immunizations: (immunizationData?.immunizations || []).map((i) => ({
        name: immunizationMap[i.vaccineTypeId] || `Vaccine #${i.vaccineTypeId}`,
        date: i.immunizationDate ? new Date(i.immunizationDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
        doseNumber: i.doseNumber || '',
      })),
      hospitalizations: (hospData?.hospitalizations || []).map((h) => ({
        condition: hospitalizationMap[h.conditionId] || `Condition #${h.conditionId}`,
        admittedDate: h.admissionDate ? new Date(h.admissionDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
        dischargedDate: h.dischargeDate ? new Date(h.dischargeDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Ongoing',
      })),
      operations: (opData?.operations || []).map((o) => ({
        procedure: operationMap[o.procedureId] || `Procedure #${o.procedureId}`,
        date: o.operationDate ? new Date(o.operationDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
      })),
      lifestyle: {
        smoker: lifestyleData?.smoker ? 'Yes' : lifestyleData?.smoker === false ? 'No' : '',
        cigarettesPerDay: lifestyleData?.numberOfCigarettesPerDay ?? '',
        yearsSmoked: lifestyleData?.yearsSmoked ?? '',
        alcoholConsumer: lifestyleData?.alcoholConsumer ? 'Yes' : lifestyleData?.alcoholConsumer === false ? 'No' : '',
        alcoholFrequency: lifestyleData?.frequencyOfAlcoholConsumption ?? '',
        vaper: lifestyleData?.vapeUser ? 'Yes' : lifestyleData?.vapeUser === false ? 'No' : '',
        vapeType: lifestyleData?.vapeType ?? '',
        vapeFrequency: lifestyleData?.vapeFrequency ?? '',
        notes: lifestyleData?.notes || '',
      },
      vision: {
        gradeOD: visionData?.acuity?.right_eye || '',
        gradeOS: visionData?.acuity?.left_eye || '',
        lastExam: visionData?.acuity?.recorded_at ? new Date(visionData.acuity.recorded_at).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
      },
    },
    dental: (() => {
      const procedureRecords = procedureData?.procedures || [];
      const allAppliances = applianceData?.appliances || [];
      const toothStates = {};
      (dentalRecord?.ToothPlacements || []).forEach((tp) => { toothStates[tp.toothIndex] = ENUM_TO_CODE[tp.legend] ?? tp.legend; });
      return {
        seenByDentist: dentalHistory?.seenByDentist ? 'No' : dentalHistory?.seenByDentist === false ? 'Yes' : '',
        firstTimeDentist: dentalHistory?.seenByDentist === false ? 'Yes (first time)' : dentalHistory?.seenByDentist ? 'No' : '',
        lastConsultation: dentalHistory?.lastVisitDate ? new Date(dentalHistory.lastVisitDate).toLocaleDateString('en-PH') : '',
        lastCleaning: dentalHistory?.lastDentalCleaning || '',
        procedures: procedureRecords.map((p) => ({
          name: dentalProcedureMap[p.procedureTypeId] || `Procedure #${p.procedureTypeId}`,
          date: p.procedureDate ? new Date(p.procedureDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
        })),
        appliances: allAppliances.map((a) => ({
          name: applianceTagMap[a.tagId] || `Appliance #${a.tagId}`,
          status: a.status || '',
          dateIssued: a.dateIssued ? new Date(a.dateIssued).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
          arch: a.arch || '',
        })),
        photoUpper: dentalPhotoData?.upperTeeth || null,
        photoLower: dentalPhotoData?.lowerTeeth || null,
        toothExtraction: procedureRecords.filter((p) => dentalProcedureMap[p.procedureTypeId] === 'Tooth Extraction').length > 0 ? String(procedureRecords.filter((p) => dentalProcedureMap[p.procedureTypeId] === 'Tooth Extraction').length) : '',
        dentalFilling: procedureRecords.filter((p) => dentalProcedureMap[p.procedureTypeId] === 'Dental Filling').length > 0 ? String(procedureRecords.filter((p) => dentalProcedureMap[p.procedureTypeId] === 'Dental Filling').length) : '',
        hasAppliance: allAppliances.filter((a) => a.status !== 'Removed' && a.status !== 'removed').length > 0 ? `Yes (${allAppliances.find((a) => a.status !== 'Removed' && a.status !== 'removed')?.arch || 'N/A'})` : '',
        applianceType: allAppliances.find((a) => a.status !== 'Removed' && a.status !== 'removed')?.arch || null,
        oralFindings: [],
        treatments: [],
        toothChart: { missing: [], filled: [], decayed: [], notes: dentalRecord?.notes || '', states: toothStates },
        oralFindingCatalogs,
        latestOralFindings: (dentalRecord?.oralFindings || []).map((f) => ({ oralFindingId: f.oralFindingId, status: f.status })),
        dentalRecordId: dentalRecord?.id || null,
      };
    })(),
    obgyne: {
      lastMenstrualPeriod: obgynData?.lastMenstrualPeriod ? new Date(obgynData.lastMenstrualPeriod).toLocaleDateString('en-PH') : '',
      menstruationDuration: '',
      dysmenorrhea: obgynData?.hasDysmenorrhea ? 'Yes' : obgynData?.hasDysmenorrhea === false ? 'No' : '',
    },
    history: {
      consultations: [],
      appointments: [],
      pastAppointments: [],
      medicineRequests: [],
      updateRequests: [],
    },
  };
}

export default function PatientRecordView({ patientId, initialTab: initialTabProp, embedded = false, onBack }) {
  const [searchParams] = useSearchParams();
  const initialTab = initialTabProp || searchParams.get('tab') || 'personal';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dentalSubTab, setDentalSubTab] = useState('dental-grade-history');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [vitalsData, setVitalsData] = useState(null);
  const [consultations, setConsultations] = useState([]);

  const isMockPatient = String(patientId || '').startsWith('mock-');
  const mockPatient = isMockPatient ? MOCK_PATIENT_RECORDS[String(patientId)] : null;

  useEffect(() => {
    setActiveTab(initialTab || 'personal');
  }, [initialTab]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);

    if (isMockPatient) {
      if (!mockPatient) setLoadError('Mock patient not found.');
      setRecordData(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadRecord = async () => {
      try {
        // Fetch EMR data, personal profile, VitalSigns, and dental data in parallel
        const [emrResult, profileResult, vitalsResult, staffDentalResult] = await Promise.allSettled([
          axiosRequest.post('/emr/medical', {
            query: GQL_FULL_RECORD,
            variables: { userId: patientId },
          }),
          axiosRequest.post('/profile/medical', {
            query: GQL_PERSONAL_PROFILE,
            variables: { userId: patientId },
          }),
          axiosRequest.post('/staff/emr', {
            query: `query GetVitals($patientId: ID!) {
              getPatientVitalSigns(patientId: $patientId, limit: 1) {
                id height_cm weight_kg blood_pressure heart_rate temperature notes created_at
              }
            }`,
            variables: { patientId },
          }),
          axiosRequest.post('/staff/emr', {
            query: `query GetStaffDentalData($patientId: ID!) {
              getPatientDentalRecord(patientId: $patientId, limit: 50) {
                id notes created_at
                ToothPlacements { id toothIndex legend }
                oralFindings { oralFindingId status }
              }
              getOralFindingCatalogs { id name }
            }`,
            variables: { patientId },
          }),
        ]);

        if (cancelled) return;

        // Extract EMR payload — also handle partial 4xx responses with embedded GraphQL data
        const emrResponse = emrResult.status === 'fulfilled'
          ? emrResult.value.data
          : emrResult.reason?.response?.data;

        const payload = emrResponse?.data;
        if (!payload?.getPatientBasicInfo) {
          throw new Error(emrResponse?.errors?.[0]?.message || 'Patient not found');
        }

        // Merge dental record and oral finding catalogs from /staff/emr into the payload
        if (staffDentalResult.status === 'fulfilled') {
          const staffDentalData = staffDentalResult.value.data?.data;
          if (staffDentalData?.getPatientDentalRecord) {
            payload.getUserDentalRecord = staffDentalData.getPatientDentalRecord;
          }
          if (staffDentalData?.getOralFindingCatalogs) {
            payload.oralFindingCatalogs = staffDentalData.getOralFindingCatalogs;
          }
        }

        setRecordData(payload);

        // Personal profile is optional — set if available
        if (profileResult.status === 'fulfilled') {
          setProfileData(profileResult.value.data?.data || null);
        } else {
          const profilePartial = profileResult.reason?.response?.data?.data;
          setProfileData(profilePartial || null);
        }

        // VitalSigns is optional — set if available (fetched from /staff/emr)
        if (vitalsResult.status === 'fulfilled') {
          setVitalsData(vitalsResult.value.data?.data?.getPatientVitalSigns || null);
        } else {
          console.warn('[PatientRecordView] VitalSigns fetch failed:', vitalsResult.reason?.message);
          setVitalsData(null);
        }
      } catch (err) {
        if (cancelled) return;

        // Fallback: some users have incomplete medical sections that make the
        // full compound query fail; still load basic profile info for viewing.
        try {
          const { data: fallbackResp } = await axiosRequest.post('/emr/medical', {
            query: GQL_BASIC_RECORD_FALLBACK,
            variables: { userId: patientId },
          });

          if (cancelled) return;

          const fallbackPayload = fallbackResp?.data;
          if (!fallbackPayload?.getPatientBasicInfo) {
            throw new Error(fallbackResp?.errors?.[0]?.message || 'Patient not found');
          }

          setRecordData(fallbackPayload);
          setLoadError(null);
        } catch (fallbackErr) {
          const fallbackPartial = fallbackErr?.response?.data?.data;
          if (fallbackPartial?.getPatientBasicInfo) {
            setRecordData(fallbackPartial);
            return;
          }
          if (!cancelled) {
            setLoadError(fallbackErr?.message || err?.message || 'Failed to load patient.');
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadRecord();

    return () => {
      cancelled = true;
    };
  }, [patientId, isMockPatient, mockPatient]);

  const patient = useMemo(() => toDisplayPatient(patientId, recordData, mockPatient, profileData, vitalsData), [patientId, recordData, mockPatient, profileData, vitalsData]);

  // Fetch consultations from backend on page load
  useEffect(() => {
    if (!patientId || isMockPatient) {
      setConsultations(patient?.history?.consultations || []);
      return;
    }

    let cancelled = false;

    const fetchConsultations = async () => {
      try {
        const consultationsWithDetails = await consultationService.getCachedConsultationsWithDetails(patientId);

        if (!cancelled) {
          setConsultations(consultationsWithDetails);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching consultations:', err);
          setConsultations([]);
        }
      }
    };

    fetchConsultations();

    return () => {
      cancelled = true;
    };
  }, [patientId, isMockPatient, patient]);

  const handleRefreshConsultations = async () => {
    try {
      if (isMockPatient) {
        // For mock patients, no need to refresh from backend
        return;
      }

      // Clear cache to ensure fresh data, then fetch updated consultations
      consultationService.clearConsultationCache(patientId);
      const consultationsWithDetails = await consultationService.getCachedConsultationsWithDetails(patientId);
      setConsultations(consultationsWithDetails);
    } catch (err) {
      console.error('Error refreshing consultations:', err);
      // Don't show alert for refresh errors, just log them
    }
  };

  const handleSaveConsultation = async (entry) => {
    if (isMockPatient) {
      // For mock patients, just add to local state
      const now = new Date();
      const newEntry = {
        id: `CONS-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`,
        type: entry?.type || 'Medical',
        date: now.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
        time: now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        diagnosis: entry?.diagnosis || 'General consultation',
        diagnoses: Array.isArray(entry?.diagnoses) ? entry.diagnoses : [],
        doctor: 'Clinic Staff', // Default doctor value
        treatment: entry?.treatment || '',
        notes: entry?.notes || '',
      };

      setConsultations((prev) => [newEntry, ...prev]);
      // Stay on consultation tab instead of redirecting to history
      return;
    }

    // Save to backend using the consultation service
    try {
      if (!entry?.backendPayload) {
        console.error('No backend payload provided');
        return;
      }

      const { consultationInput, consultationOutcomeInput, vitalSignsData, patientId: vsPatientId } = entry.backendPayload;

      // If vital signs data was provided and all required fields are valid, create them first
      let vitalSignsId = null;
      if (vitalSignsData) {
        try {
          const vs = await consultationService.createVitalSignsForConsultation(vsPatientId || patientId, vitalSignsData);
          vitalSignsId = vs?.id || null;
        } catch (vsErr) {
          console.error('Failed to create vital signs during consultation (non-blocking):', vsErr);
          // Non-blocking: consultation proceeds even if vital signs creation fails
        }
      }

      const finalOutcomeInput = vitalSignsId
        ? { ...consultationOutcomeInput, vitalSignsId }
        : consultationOutcomeInput;

      // Use the service to create and submit consultation
      await consultationService.createAndSubmitConsultation(
        consultationInput,
        finalOutcomeInput,
        'Completed'
      );

      // Fetch updated consultations from backend using the service
      consultationService.clearConsultationCache(patientId); // Clear cache for fresh data
      const consultationsWithDetails = await consultationService.getCachedConsultationsWithDetails(patientId);

      setConsultations(consultationsWithDetails);
      // Stay on consultation tab instead of redirecting to history
    } catch (err) {
      console.error('Error saving consultation:', err);
      alert('Failed to save consultation. Please try again.');
    }
  };

  if (isLoading) return <LoadingBlock label="Loading patient record..." />;

  if (!isMockPatient && (loadError || !recordData?.getPatientBasicInfo)) {
    return (
      <div className="space-y-3">
        {!embedded && (
          <Link to="/search" className="inline-flex items-center gap-1 text-sm text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Search
          </Link>
        )}
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-error-700 dark:text-error-400">{loadError || 'Patient not found.'}</p>
          <p className="text-xs text-error-500 dark:text-error-500 mt-1">ID: {patientId}</p>
        </div>
      </div>
    );
  }

  const ticketStatus = (recordData?.getUserUpdateTicket?.status || patient.status || null);
  const bannerCfg = ticketStatus ? STATUS_BANNER[ticketStatus] : null;

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'medical', label: 'Medical Record' },
    { id: 'medical-history', label: 'Medical Record History' },
    { id: 'vital-signs', label: 'Vital Signs' },
    { id: 'dental', label: 'Dental Record' },
    { id: 'dental-grade-history', label: 'Dental Record History' },
    { id: 'consultation', label: 'Consultation' },
    ...(patient?.personal?.sex === 'Female' ? [{ id: 'obgyne', label: 'OB-GYN' }] : []),
    { id: 'history', label: 'Consultation History' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'medicines', label: 'Medicine Requests' },
    { id: 'documents', label: 'Documents' },
  ];

  const initials = (patient.name || '--')
    .split(' ')
    .map((p) => p[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderTab = () => {
    switch (activeTab) {
      case 'personal':
        return <PatientPersonalInfoTab patient={patient} />;
      case 'medical':
        return <PatientMedicalRecordTab patient={patient} />;
      case 'medical-history':
        return <PatientMedicalRecordHistoryTab patient={patient} />;
      case 'vital-signs':
        return <VitalSignsTab patient={patient} />;
      case 'dental':
        return <PatientDentalRecordTab patient={patient} />;
      case 'dental-grade-history':
        return (
          <div>
            <div className="flex gap-1.5 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-2">
              {[
                { id: 'dental-grade-history', label: 'Dental Record History' },
                { id: 'dental-grading', label: 'Dental Grading' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setDentalSubTab(sub.id)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    dentalSubTab === sub.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700/50 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            <Suspense fallback={<LoadingBlock label="Loading..." />}>
              {dentalSubTab === 'dental-grade-history'
                ? <PatientDentalGradeHistoryTab patient={patient} />
                : <DentalGradingTab patient={patient} />}
            </Suspense>
          </div>
        );
      case 'consultation':
        return (
          <PatientConsultationTab
            patient={patient}
            consultations={consultations}
            onSaveConsultation={handleSaveConsultation}
          />
        );
      case 'history':
        return <PatientConsultationHistoryTab patient={patient} consultations={consultations} onRefreshConsultations={handleRefreshConsultations} />;
      case 'appointments':
        return <PatientAppointmentsTab patient={patient} />;
      case 'medicines':
        return <PatientMedicineRequestsTab patient={patient} />;
      case 'documents':
        return <PatientDocumentsTab patient={patient} />;
      case 'obgyne':
        return <PatientObgyneTab patient={patient} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {!embedded && (
        <Link to="/search" className="inline-flex items-center gap-1 text-sm text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Search
        </Link>
      )}

      {embedded && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-700/50 text-secondary-700 dark:text-neutral-300 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Change selected patient
        </button>
      )}

      {bannerCfg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${bannerCfg.cls}`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{bannerCfg.label}</span>
        </div>
      )}

      <section className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-secondary-900 dark:text-white truncate">{patient.name || 'Unknown Patient'}</h2>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate">
                {patient.personal?.studentNumber || patient.personal?.employeeNumber || patient.id} · {patient.program || patient.department || 'N/A'} · {patient.year || 'N/A'}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {['InProgress', 'Pending', 'Revision', 'RevisionSubmitted'].includes(patient.status) && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">{patient.status}</span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300">{patient.type}</span>
                {isMockPatient && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Mock Mode</span>
                )}
              </div>
            </div>
          </div>

          {!embedded && (
            <div className="hidden sm:flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600">Print</button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md">Edit Record</button>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="px-2 py-2.5 border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700/50 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3">
          <Suspense fallback={<LoadingBlock label="Loading tab content..." />}>
            {renderTab()}
          </Suspense>
        </div>
      </section>
    </div>
  );
}
