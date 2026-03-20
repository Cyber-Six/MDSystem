import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { axiosRequest } from '../../packages-core-adapter';
import { GQL_FULL_RECORD, MOCK_PATIENT_RECORDS, STATUS_BANNER } from './patient-record-data';
import * as consultationService from './consultation-service';

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

function toDisplayPatient(patientId, data, mockPatient) {
  if (mockPatient) return mockPatient;

  const basicInfo = data?.getPatientBasicInfo;
  const updateTicket = data?.getUserUpdateTicket || null;
  const vitalSigns = data?.getUserVitalSigns?.[0] || null;
  const medicalHistory = data?.getUserMedicalHistory?.[0] || null;
  const allergyData = data?.getUserAllergyProfile?.[0] || null;
  const immunizationData = data?.getUserImmunizationProfile?.[0] || null;
  const lifestyleData = data?.getUserLifestyle?.[0] || null;
  const obgynData = data?.getUserObgynHistory?.[0] || null;
  const emergencyData = data?.getUserEmergencyContact?.[0] || null;
  const medicationData = data?.getUserMedicationProfile?.[0] || null;
  const dentalHistory = data?.getUserDentalHistory?.[0] || null;
  const visionData = data?.getUserVisualAcuityProfile?.[0] || null;
  const hospData = data?.getUserHospitalizationProfile?.[0] || null;
  const opData = data?.getUserOperationProfile?.[0] || null;

  return {
    id: patientId || '',
    name: basicInfo ? `${basicInfo.first_name || ''} ${basicInfo.last_name || ''}`.trim() : '',
    email: '',
    program: basicInfo?.program || basicInfo?.department || '',
    year: basicInfo?.year || basicInfo?.role || '',
    department: basicInfo?.department || '',
    semester: '',
    status: updateTicket?.status || basicInfo?.latest_status || '',
    type: basicInfo?.profile_type || 'Student',
    avatar: null,
    personal: {
      firstName: basicInfo?.first_name || '',
      middleName: basicInfo?.middle_name || '',
      lastName: basicInfo?.last_name || '',
      suffix: basicInfo?.suffix || '',
      birthDate: '',
      age: '',
      sex: basicInfo?.sex || '',
      civilStatus: '',
      nationality: '',
      religion: '',
      address: '',
      contactNumber: '',
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
        address: '',
      },
      second: {
        name: emergencyData?.secondContact?.contactName || '',
        relationship: emergencyData?.secondContact?.relationship || '',
        contact: emergencyData?.secondContact?.contactNumber || '',
        address: '',
      },
    },
    medicalHistory: {
      self: (medicalHistory?.conditions || []).filter((c) => !c.relationship || c.relationship === 'self').map((c) => c.description || `Condition #${c.conditionId}`),
      selfDetails: medicalHistory?.notes || '',
      family: (medicalHistory?.conditions || []).filter((c) => c.relationship && c.relationship !== 'self').map((c) => `${c.description || `Condition #${c.conditionId}`} (${c.relationship})`),
      familyDetails: '',
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
        drug: (allergyData?.allergies || []).filter((a) => a.allergenCatalogId).map((a) => `#${a.allergenCatalogId}`).join(', ') || '',
        food: '',
        other: '',
      },
      conditions: [],
      medications: (medicationData?.medications || []).map((m) => m.description || `Medicine #${m.medicineId}`),
      immunizations: (immunizationData?.immunizations || []).map((i) => `#${i.vaccineTypeId} (Dose ${i.doseNumber})`),
      hospitalizations: (hospData?.hospitalizations || []).map((h) => ({
        reason: `Condition #${h.conditionId}`,
        year: h.admissionDate ? new Date(h.admissionDate).getFullYear() : '',
        hospital: '',
        duration: h.dischargeDate ? `until ${new Date(h.dischargeDate).toLocaleDateString('en-PH')}` : 'ongoing',
      })),
      operations: (opData?.operations || []).map((o) => `Procedure #${o.procedureId}`).join(', '),
      lifestyle: {
        smoker: lifestyleData?.smoker ? `Yes (${lifestyleData.numberOfCigarettesPerDay || '?'} sticks/day, ${lifestyleData.yearsSmoked || '?'} yrs)` : 'No',
        alcoholDrinker: lifestyleData?.alcoholConsumer ? `Yes (${lifestyleData.frequencyOfAlcoholConsumption || 'occasional'})` : 'No',
        tattoo: lifestyleData?.notes || '',
        piercing: '',
      },
      vision: {
        hasEyeglasses: !!visionData?.acuity,
        hasContactLenses: false,
        gradeOD: visionData?.acuity?.right_eye || '',
        gradeOS: visionData?.acuity?.left_eye || '',
        lastExam: visionData?.acuity?.recorded_at ? new Date(visionData.acuity.recorded_at).toLocaleDateString('en-PH') : '',
      },
    },
    dental: {
      firstTimeDentist: dentalHistory?.seenByDentist === false ? 'Yes (first time)' : dentalHistory?.seenByDentist ? 'No' : '',
      lastConsultation: dentalHistory?.lastVisitDate ? new Date(dentalHistory.lastVisitDate).toLocaleDateString('en-PH') : '',
      lastCleaning: dentalHistory?.lastDentalCleaning || '',
      toothExtraction: dentalHistory?.purpose || '',
      dentalFilling: '',
      oralFindings: [],
      treatments: [],
      hasAppliance: '',
      applianceType: null,
      toothChart: { missing: [], filled: [], decayed: [], notes: '' },
    },
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [recordData, setRecordData] = useState(null);
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
        const { data } = await axiosRequest.post('/emr/medical', {
          query: GQL_FULL_RECORD,
          variables: { userId: patientId },
        });

        if (cancelled) return;

        const payload = data?.data;
        if (!payload?.getPatientBasicInfo) {
          throw new Error(data?.errors?.[0]?.message || 'Patient not found');
        }

        setRecordData(payload);
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

  const patient = useMemo(() => toDisplayPatient(patientId, recordData, mockPatient), [patientId, recordData, mockPatient]);

  // Fetch consultations from backend on page load
  useEffect(() => {
    if (!patientId || isMockPatient) {
      setConsultations(patient?.history?.consultations || []);
      return;
    }

    let cancelled = false;

    const fetchConsultations = async () => {
      try {
        const consultationsWithDetails = await consultationService.getConsultationWithDetails(patientId);

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
        doctor: entry?.doctor || 'Clinic Staff',
        treatment: entry?.treatment || '',
        notes: entry?.notes || '',
      };

      setConsultations((prev) => [newEntry, ...prev]);
      setActiveTab('history');
      return;
    }

    // Save to backend using the consultation service
    try {
      if (!entry?.backendPayload) {
        console.error('No backend payload provided');
        return;
      }

      const { consultationInput, consultationOutcomeInput } = entry.backendPayload;

      // Use the service to create and submit consultation
      await consultationService.createAndSubmitConsultation(
        consultationInput,
        consultationOutcomeInput,
        'Completed'
      );

      // Fetch updated consultations from backend using the service
      const consultationsWithDetails = await consultationService.getConsultationWithDetails(patientId);

      setConsultations(consultationsWithDetails);
      setActiveTab('history');
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
    { id: 'dental', label: 'Dental Record' },
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
      case 'dental':
        return <PatientDentalRecordTab patient={patient} />;
      case 'consultation':
        return (
          <PatientConsultationTab
            patient={patient}
            consultations={consultations}
            onSaveConsultation={handleSaveConsultation}
          />
        );
      case 'history':
        return <PatientConsultationHistoryTab patient={patient} consultations={consultations} onRefreshConsultations={() => window.location.reload()} />;
      case 'appointments':
        return <PatientAppointmentsTab patient={patient} />;
      case 'medicines':
        return <PatientMedicineRequestsTab patient={patient} />;
      case 'documents':
        return <PatientDocumentsTab />;
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
                {patient.id} · {patient.program || patient.department || 'N/A'} · {patient.year || 'N/A'}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">{patient.status || 'N/A'}</span>
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
        <div className="px-2 py-2 border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
