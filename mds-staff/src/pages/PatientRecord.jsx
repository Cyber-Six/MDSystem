import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { axiosRequest } from '../packages-core-adapter';

// ── Queries ───────────────────────────────────────────────────────────────────
const GQL_BASIC_INFO = `
  query GetBasicInfo($userId: ID!) {
    getPatientBasicInfo(userId: $userId) {
      id identifier branch sex
      first_name last_name middle_name suffix
      profile_type program year department role
      latest_ticket_id latest_status latest_scope latest_updated_at
    }
  }
`;

const GQL_UPDATE_TICKET = `
  query GetTicket($userId: ID!) {
    getUserUpdateTicket(userId: $userId) { id patientId status scope }
  }
`;

const GQL_VITAL_SIGNS = `
  query GetVitals($patientId: ID!) {
    getPatientVitalSigns(patientId: $patientId, limit: 1) {
      id height_cm weight_kg blood_pressure heart_rate temperature notes created_at
    }
  }
`;

const GQL_MEDICAL_HISTORY = `
  query GetMedHist($userId: ID!) {
    getUserMedicalHistory(userId: $userId, limit: 1) {
      id notes status created_at
      conditions { id conditionId description diagnosedDate relationship }
    }
  }
`;

const GQL_ALLERGY = `
  query GetAllergy($userId: ID!) {
    getUserAllergyProfile(userId: $userId, limit: 1) {
      id notes status created_at
      allergies { id allergenCatalogId status severity notes dateIdentified }
    }
  }
`;

const GQL_IMMUNIZATION = `
  query GetImmunization($userId: ID!) {
    getUserImmunizationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      immunizations { id vaccineTypeId immunizationDate doseNumber }
    }
  }
`;

const GQL_LIFESTYLE = `
  query GetLifestyle($userId: ID!) {
    getUserLifestyle(userId: $userId, limit: 1) {
      id smoker numberOfCigarettesPerDay yearsSmoked
      alcoholConsumer frequencyOfAlcoholConsumption
      vapeUser vapeType vapeFrequency yearsVaping
      notes status created_at
    }
  }
`;

const GQL_OBGYN = `
  query GetObgyn($userId: ID!) {
    getUserObgynHistory(userId: $userId, limit: 1) {
      id lastMenstrualPeriod hasDysmenorrhea notes status created_at
    }
  }
`;

const GQL_EMERGENCY = `
  query GetEmergency($userId: ID!) {
    getUserEmergencyContact(userId: $userId, limit: 1) {
      id status created_at
      firstContact  { id contactName relationship contactNumber address }
      secondContact { id contactName relationship contactNumber address }
    }
  }
`;

const GQL_MEDICATION = `
  query GetMedication($userId: ID!) {
    getUserMedicationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      medications { id medicineId description }
    }
  }
`;

const GQL_DENTAL_HISTORY = `
  query GetDentalHist($userId: ID!) {
    getUserDentalHistory(userId: $userId, limit: 1) {
      id seenByDentist lastDentalCleaning purpose lastVisitDate status created_at
    }
  }
`;

const GQL_VISUAL_ACUITY = `
  query GetVision($userId: ID!) {
    getUserVisualAcuityProfile(userId: $userId, limit: 1) {
      id notes status created_at
      acuity { id acuityId left_eye right_eye notes recorded_at }
    }
  }
`;

const GQL_HOSPITALIZATION = `
  query GetHosp($userId: ID!) {
    getUserHospitalizationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      hospitalizations { id conditionId admissionDate dischargeDate notes }
    }
  }
`;

const GQL_OPERATION = `
  query GetOp($userId: ID!) {
    getUserOperationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      operations { id procedureId operationDate notes }
    }
  }
`;

// ── Single compound query — all sections in one HTTP request ────────────────
const GQL_FULL_RECORD = `
  query GetFullPatientRecord($userId: ID!) {
    getPatientBasicInfo(userId: $userId) {
      id identifier branch sex
      first_name last_name middle_name suffix
      profile_type program year department role
      latest_ticket_id latest_status latest_scope latest_updated_at
    }
    getUserUpdateTicket(userId: $userId) { id patientId status scope }
    getUserMedicalHistory(userId: $userId, limit: 1) {
      id notes status created_at
      conditions { id conditionId description diagnosedDate relationship }
    }
    getUserAllergyProfile(userId: $userId, limit: 1) {
      id notes status created_at
      allergies { id allergenCatalogId status severity notes dateIdentified }
    }
    getUserImmunizationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      immunizations { id vaccineTypeId immunizationDate doseNumber }
    }
    getUserLifestyle(userId: $userId, limit: 1) {
      id smoker numberOfCigarettesPerDay yearsSmoked
      alcoholConsumer frequencyOfAlcoholConsumption
      vapeUser vapeType vapeFrequency yearsVaping
      notes status created_at
    }
    getUserObgynHistory(userId: $userId, limit: 1) {
      id lastMenstrualPeriod hasDysmenorrhea notes status created_at
    }
    getUserEmergencyContact(userId: $userId, limit: 1) {
      id status created_at
      firstContact  { id contactName relationship contactNumber address }
      secondContact { id contactName relationship contactNumber address }
    }
    getUserMedicationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      medications { id medicineId description }
    }
    getUserDentalHistory(userId: $userId, limit: 1) {
      id seenByDentist lastDentalCleaning purpose lastVisitDate status created_at
    }
    getUserVisualAcuityProfile(userId: $userId, limit: 1) {
      id notes status created_at
      acuity { id acuityId left_eye right_eye notes recorded_at }
    }
    getUserHospitalizationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      hospitalizations { id conditionId admissionDate dischargeDate notes }
    }
    getUserOperationProfile(userId: $userId, limit: 1) {
      id notes status created_at
      operations { id procedureId operationDate notes }
    }
  }
`;

// ── Status ticket banner ───────────────────────────────────────────────────────
const STATUS_BANNER = {
  InProgress:        { cls: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',   label: 'Record update in progress' },
  Pending:           { cls: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300', label: 'Awaiting staff approval' },
  Revision:          { cls: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300', label: 'Revision requested' },
  RevisionSubmitted: { cls: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300', label: 'Revision submitted — awaiting review' },
  Approved:          { cls: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',  label: 'Record is up to date' },
};

/**
 * Patient Record View Page
 * Displays comprehensive patient information in tabs, loaded from /emr/medical GraphQL.
 */
const PatientRecord = ({ patientId: propPatientId, initialTab: propInitialTab, embedded = false }) => {
  const { patientId: routePatientId } = useParams();
  const [searchParams] = useSearchParams();
  const patientId = propPatientId || routePatientId;
  const VALID_TABS = ['personal', 'medical', 'dental', 'obgyne', 'history', 'appointments', 'medicines', 'documents'];
  const resolvedTab = propInitialTab || searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    VALID_TABS.includes(resolvedTab) ? resolvedTab : 'personal'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [basicInfo,       setBasicInfo]       = useState(null);
  const [updateTicket,    setUpdateTicket]     = useState(null);
  const [vitalSigns,      setVitalSigns]       = useState(null);
  const [medicalHistory,  setMedicalHistory]   = useState(null);
  const [allergyData,     setAllergyData]      = useState(null);
  const [immunizationData, setImmunizationData] = useState(null);
  const [lifestyleData,   setLifestyleData]    = useState(null);
  const [obgynData,       setObgynData]        = useState(null);
  const [emergencyData,   setEmergencyData]    = useState(null);
  const [medicationData,  setMedicationData]   = useState(null);
  const [dentalHistory,   setDentalHistory]    = useState(null);
  const [visionData,      setVisionData]       = useState(null);
  const [hospData,        setHospData]         = useState(null);
  const [opData,          setOpData]           = useState(null);

  // ── Load entire record in a single request ────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    // Fetch EMR data and VitalSigns in parallel (VitalSigns moved to /staff/emr)
    const emrPromise = axiosRequest.post('/emr/medical', { query: GQL_FULL_RECORD, variables: { userId: patientId } });
    const vitalsPromise = axiosRequest.post('/staff/emr', { query: GQL_VITAL_SIGNS, variables: { patientId } })
      .catch(err => { console.warn('[PatientRecord] VitalSigns fetch failed:', err.message); return null; });

    Promise.all([emrPromise, vitalsPromise])
      .then(([emrRes, vitalsRes]) => {
        if (cancelled) return;
        const d = emrRes.data.data;
        if (!d?.getPatientBasicInfo) {
          throw new Error(emrRes.data.errors?.[0]?.message || 'Patient not found');
        }
        setBasicInfo(d.getPatientBasicInfo);
        setUpdateTicket(d.getUserUpdateTicket || null);
        setVitalSigns(vitalsRes?.data?.data?.getPatientVitalSigns?.[0] || null);
        setMedicalHistory(d.getUserMedicalHistory?.[0] || null);
        setAllergyData(d.getUserAllergyProfile?.[0] || null);
        setImmunizationData(d.getUserImmunizationProfile?.[0] || null);
        setLifestyleData(d.getUserLifestyle?.[0] || null);
        setObgynData(d.getUserObgynHistory?.[0] || null);
        setEmergencyData(d.getUserEmergencyContact?.[0] || null);
        setMedicationData(d.getUserMedicationProfile?.[0] || null);
        setDentalHistory(d.getUserDentalHistory?.[0] || null);
        setVisionData(d.getUserVisualAcuityProfile?.[0] || null);
        setHospData(d.getUserHospitalizationProfile?.[0] || null);
        setOpData(d.getUserOperationProfile?.[0] || null);
      })
      .catch(err => { if (!cancelled) setLoadError(err.message || 'Failed to load patient.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [patientId]);

  // ── Derive the display-shape that the existing render code expects ─────────
  const patient = {
    id: patientId || '',
    name: basicInfo ? `${basicInfo.first_name || ''} ${basicInfo.last_name || ''}`.trim() : '',
    email: '',
    program: basicInfo?.program || basicInfo?.department || '',
    year:    basicInfo?.year    || basicInfo?.role       || '',
    department: basicInfo?.department || '',
    semester: '',
    status:  updateTicket?.status || basicInfo?.latest_status || '',
    type:    basicInfo?.profile_type || 'Student',
    avatar:  null,
    personal: {
      firstName:         basicInfo?.first_name   || '',
      middleName:        basicInfo?.middle_name  || '',
      lastName:          basicInfo?.last_name    || '',
      suffix:            basicInfo?.suffix       || '',
      birthDate:         '',
      age:               '',
      sex:               basicInfo?.sex          || '',
      civilStatus:       '',
      nationality:       '',
      religion:          '',
      address:           '',
      contactNumber:     '',
      studentNumber:     basicInfo?.identifier   || '',
      studentCategory:   '',
      lastSchoolAttended:'',
      drugTestDone:      '',
    },
    emergencyContacts: {
      first:  {
        name:         emergencyData?.firstContact?.contactName   || '',
        relationship: emergencyData?.firstContact?.relationship  || '',
        contact:      emergencyData?.firstContact?.contactNumber || '',
        address:      emergencyData?.firstContact?.address       || '',
      },
      second: {
        name:         emergencyData?.secondContact?.contactName   || '',
        relationship: emergencyData?.secondContact?.relationship  || '',
        contact:      emergencyData?.secondContact?.contactNumber || '',
        address:      emergencyData?.secondContact?.address       || '',
      },
    },
    medicalHistory: {
      self:         (medicalHistory?.conditions || []).filter(c => !c.relationship || c.relationship === 'self').map(c => c.description || `Condition #${c.conditionId}`),
      selfDetails:  medicalHistory?.notes || '',
      family:       (medicalHistory?.conditions || []).filter(c => c.relationship && c.relationship !== 'self').map(c => `${c.description || `Condition #${c.conditionId}`} (${c.relationship})`),
      familyDetails:'',
    },
    medical: {
      vitalSigns: {
        height:      vitalSigns?.height_cm    || '',
        weight:      vitalSigns?.weight_kg    || '',
        bmi:         vitalSigns?.height_cm && vitalSigns?.weight_kg
                       ? (vitalSigns.weight_kg / ((vitalSigns.height_cm / 100) ** 2)).toFixed(1)
                       : '',
        bp:          vitalSigns?.blood_pressure || '',
        heartRate:   vitalSigns?.heart_rate     || '',
        temperature: vitalSigns?.temperature    || '',
        lastChecked: vitalSigns?.created_at ? new Date(vitalSigns.created_at).toLocaleDateString('en-PH') : '',
      },
      bloodType: '',
      allergies: {
        drug:  (allergyData?.allergies || []).filter(a => a.allergenCatalogId).map(a => `#${a.allergenCatalogId}`).join(', ') || '',
        food:  '',
        other: '',
      },
      conditions:      [],
      medications:     (medicationData?.medications || []).map(m => m.description || `Medicine #${m.medicineId}`),
      immunizations:   (immunizationData?.immunizations || []).map(i => `#${i.vaccineTypeId} (Dose ${i.doseNumber})`),
      hospitalizations:(hospData?.hospitalizations || []).map(h => ({
        reason:   `Condition #${h.conditionId}`,
        year:     h.admissionDate ? new Date(h.admissionDate).getFullYear() : '',
        hospital: '',
        duration: h.dischargeDate ? `until ${new Date(h.dischargeDate).toLocaleDateString('en-PH')}` : 'ongoing',
      })),
      operations: (opData?.operations || []).map(o => `Procedure #${o.procedureId}`).join(', '),
      lifestyle: {
        smoker:        lifestyleData?.smoker ? `Yes (${lifestyleData.numberOfCigarettesPerDay || '?'} sticks/day, ${lifestyleData.yearsSmoked || '?'} yrs)` : 'No',
        alcoholDrinker:lifestyleData?.alcoholConsumer ? `Yes (${lifestyleData.frequencyOfAlcoholConsumption || 'occasional'})` : 'No',
        vaper:         lifestyleData?.vapeUser ? `Yes (${lifestyleData.vapeType || 'Not specified'}, ${lifestyleData.vapeFrequency || 'Not specified'})` : 'No',
        tattoo:        lifestyleData?.notes || '',
        piercing:      '',
      },
      vision: {
        hasEyeglasses:   !!(visionData?.acuity),
        hasContactLenses:false,
        gradeOD:         visionData?.acuity?.right_eye || '',
        gradeOS:         visionData?.acuity?.left_eye  || '',
        lastExam:        visionData?.acuity?.recorded_at
                           ? new Date(visionData.acuity.recorded_at).toLocaleDateString('en-PH') : '',
      },
    },
    dental: {
      firstTimeDentist: dentalHistory?.seenByDentist === false ? 'Yes (first time)' : dentalHistory?.seenByDentist ? 'No' : '',
      lastConsultation: dentalHistory?.lastVisitDate ? new Date(dentalHistory.lastVisitDate).toLocaleDateString('en-PH') : '',
      lastCleaning:     dentalHistory?.lastDentalCleaning || '',
      toothExtraction:  dentalHistory?.purpose || '',
      dentalFilling:    '',
      oralFindings:     [],
      treatments:       [],
      hasAppliance:     '',
      applianceType:    null,
      toothChart:       { missing: [], filled: [], decayed: [], notes: '' },
    },
    obgyne: {
      lastMenstrualPeriod:  obgynData?.lastMenstrualPeriod ? new Date(obgynData.lastMenstrualPeriod).toLocaleDateString('en-PH') : '',
      menstruationDuration: '',
      dysmenorrhea:         obgynData?.hasDysmenorrhea ? 'Yes' : obgynData?.hasDysmenorrhea === false ? 'No' : '',
    },
    history: {
      consultations:    [],
      appointments:     [],
      pastAppointments: [],
      medicineRequests: [],
      updateRequests:   [],
    },
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <svg className="animate-spin w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading patient record…</p>
      </div>
    );
  }

  // ── Error screen ───────────────────────────────────────────────────────────
  if (loadError || !basicInfo) {
    return (
      <div className="space-y-4">
        {!embedded && (
          <Link to="/search" className="inline-flex items-center gap-1 text-sm text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Search
          </Link>
        )}
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-6 text-center">
          <p className="text-sm font-medium text-error-700 dark:text-error-400">{loadError || 'Patient not found.'}</p>
          <p className="text-xs text-error-500 dark:text-error-500 mt-1">ID: {patientId}</p>
        </div>
      </div>
    );
  }

  // ── Ticket status banner ───────────────────────────────────────────────────
  const ticketStatus = updateTicket?.status;
  const bannerCfg    = ticketStatus ? STATUS_BANNER[ticketStatus] : null;


  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'medical', label: 'Medical Record' },
    { id: 'dental', label: 'Dental Record' },
    // OB-GYN tab only shown for female patients
    ...(basicInfo?.sex === 'Female' ? [{ id: 'obgyne', label: 'OB-GYN' }] : []),
    { id: 'history', label: 'Consultation History' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'medicines', label: 'Medicine Requests' },
    { id: 'documents', label: 'Documents' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return (
          <div className="space-y-6">
            {/* Basic Information Card */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Basic Information</h4>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'First Name', value: patient.personal.firstName },
                  { label: 'Middle Name', value: patient.personal.middleName },
                  { label: 'Last Name', value: patient.personal.lastName },
                  { label: 'Suffix', value: patient.personal.suffix || 'N/A' },
                  { label: 'Birth Date', value: patient.personal.birthDate },
                  { label: 'Age', value: `${patient.personal.age} years old` },
                  { label: 'Sex', value: patient.personal.sex },
                  { label: 'Civil Status', value: patient.personal.civilStatus },
                  { label: 'Nationality', value: patient.personal.nationality },
                  { label: 'Religion', value: patient.personal.religion },
                  { label: 'Contact Number', value: patient.personal.contactNumber },
                  { label: 'Email', value: patient.email },
                ].map((item, idx) => (
                  <div key={idx}>
                    <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">{item.label}</p>
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Address Card */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Address</h4>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Present Address</p>
                  <p className="text-sm text-secondary-700 dark:text-neutral-300">{patient.personal.address || 'N/A'}</p>
                </div>
              </div>
            </div>
            
            {/* Academic Information Card */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Academic Information</h4>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Student Number', value: patient.personal.studentNumber },
                  { label: 'Program', value: patient.program },
                  { label: 'Year Level', value: patient.year },
                  { label: 'Student Category', value: patient.personal.studentCategory },
                  { label: 'Last School Attended', value: patient.personal.lastSchoolAttended },
                  { label: 'Drug Test Done', value: patient.personal.drugTestDone },
                ].map((item, idx) => (
                  <div key={idx}>
                    <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">{item.label}</p>
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Emergency Contacts Card */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Emergency Contacts</h4>
              </div>
              <div className="p-6 grid md:grid-cols-2 gap-4">
                {Object.entries(patient.emergencyContacts).map(([key, contact], idx) => (
                  <div key={key} className="p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm font-bold text-secondary-900 dark:text-white mb-3">{contact.name}</p>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-0.5">Relationship</span>
                        <p className="text-secondary-800 dark:text-white font-medium">{contact.relationship}</p>
                      </div>
                      <div>
                        <span className="text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-0.5">Contact Number</span>
                        <p className="text-secondary-800 dark:text-white font-medium">{contact.contact}</p>
                      </div>
                      <div>
                        <span className="text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-0.5">Address</span>
                        <p className="text-secondary-800 dark:text-white font-medium">{contact.address}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'medical':
        return (
          <div className="space-y-4">
            {/* Vital Signs */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3 flex items-center justify-between">
                Vital Signs
                <span className="ml-auto text-xs text-secondary-500 dark:text-neutral-400">Last checked: {patient.medical.vitalSigns.lastChecked}</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {Object.entries({
                  'Height': `${patient.medical.vitalSigns.height} cm`,
                  'Weight': `${patient.medical.vitalSigns.weight} kg`,
                  'BMI': patient.medical.vitalSigns.bmi,
                  'BP': patient.medical.vitalSigns.bp,
                  'Heart Rate': `${patient.medical.vitalSigns.heartRate} bpm`,
                  'Temperature': `${patient.medical.vitalSigns.temperature}°C`,
                }).map(([label, value]) => (
                  <div key={label} className="p-3 bg-white dark:bg-neutral-800 rounded-md text-center border border-neutral-200 dark:border-neutral-600">
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{label}</p>
                    <p className="text-lg font-semibold text-secondary-800 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Blood Type */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-2">Blood Type</h4>
              <span className="inline-flex items-center justify-center px-4 py-2 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 text-lg font-bold rounded-md">
                {patient.medical.bloodType}
              </span>
            </div>

            {/* Medical History */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Medical History</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1">Self Conditions:</p>
                  <div className="flex flex-wrap gap-2">
                    {patient.medicalHistory.self.map((condition, idx) => (
                      <span key={idx} className="px-2 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs font-medium rounded">
                        {condition}
                      </span>
                    ))}
                  </div>
                  {patient.medicalHistory.selfDetails && (
                    <p className="text-xs text-secondary-600 dark:text-neutral-300 mt-2">{patient.medicalHistory.selfDetails}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1">Family History:</p>
                  <div className="flex flex-wrap gap-2">
                    {patient.medicalHistory.family.map((condition, idx) => (
                      <span key={idx} className="px-2 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 text-xs font-medium rounded">
                        {condition}
                      </span>
                    ))}
                  </div>
                  {patient.medicalHistory.familyDetails && (
                    <p className="text-xs text-secondary-600 dark:text-neutral-300 mt-2">{patient.medicalHistory.familyDetails}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Allergies */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Allergies
              </h4>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1">Drug Allergies:</p>
                  <p className="text-sm text-error-700 dark:text-error-400 font-medium">{patient.medical.allergies.drug || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1">Food Allergies:</p>
                  <p className="text-sm text-error-700 dark:text-error-400 font-medium">{patient.medical.allergies.food || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1">Other Allergies:</p>
                  <p className="text-sm text-error-700 dark:text-error-400 font-medium">{patient.medical.allergies.other || 'None'}</p>
                </div>
              </div>
            </div>

            {/* Current Medications */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-2">Current Medications</h4>
              <ul className="list-disc list-inside text-sm text-secondary-600 dark:text-neutral-300 space-y-1">
                {patient.medical.medications.map((med, idx) => (
                  <li key={idx}>{med}</li>
                ))}
              </ul>
            </div>

            {/* Immunizations */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-2">Immunizations</h4>
              <div className="flex flex-wrap gap-2">
                {patient.medical.immunizations.map((vaccine, idx) => (
                  <span key={idx} className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs font-medium rounded">
                    ✓ {vaccine}
                  </span>
                ))}
              </div>
            </div>

            {/* Hospitalizations */}
            {patient.medical.hospitalizations.length > 0 && (
              <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Hospitalizations</h4>
                <div className="space-y-2">
                  {patient.medical.hospitalizations.map((hosp, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-600">
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{hosp.reason}</p>
                      <p className="text-xs text-secondary-500 dark:text-neutral-400">{hosp.year} • {hosp.hospital} • {hosp.duration}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lifestyle */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Lifestyle Information</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries({
                  'Smoker': patient.medical.lifestyle.smoker,
                  'Alcohol Drinker': patient.medical.lifestyle.alcoholDrinker,
                  'Vaper': patient.medical.lifestyle.vaper,
                  'Tattoo': patient.medical.lifestyle.tattoo,
                  'Piercing': patient.medical.lifestyle.piercing,
                }).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vision */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Vision Information</h4>
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Eyeglasses</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.medical.vision.hasEyeglasses ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Contact Lenses</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.medical.vision.hasContactLenses ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Grade OD (Right)</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.medical.vision.gradeOD}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Grade OS (Left)</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.medical.vision.gradeOS}</p>
                </div>
              </div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-2">Last exam: {patient.medical.vision.lastExam}</p>
            </div>
          </div>
        );

      case 'dental':
        return (
          <div className="space-y-4">
            {/* Dental Visit Info */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Dental Visit History</h4>
              <div className="grid md:grid-cols-3 gap-3">
                {Object.entries({
                  'First Time Dentist': patient.dental.firstTimeDentist || 'N/A',
                  'Last Consultation': patient.dental.lastConsultation || 'N/A',
                  'Last Cleaning': patient.dental.lastCleaning || 'N/A',
                }).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tooth Extraction & Dental Filling History */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Dental Procedure History</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Tooth Extraction (past 2 years)</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white capitalize">{patient.dental.toothExtraction || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">Dental Filling (past 2 years)</p>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white capitalize">{patient.dental.dentalFilling || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Oral Findings */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Current Oral Findings</h4>
              <div className="flex flex-wrap gap-2">
                {patient.dental.oralFindings.map((finding, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 text-xs font-medium rounded">
                    {finding}
                  </span>
                ))}
              </div>
            </div>

            {/* Treatments History */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Treatment History</h4>
              <div className="space-y-2">
                {patient.dental.treatments.map((treatment, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-600">
                    <div>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{treatment.treatment}</p>
                      <p className="text-xs text-secondary-500 dark:text-neutral-400">{treatment.dentist}</p>
                    </div>
                    <span className="text-xs text-secondary-500 dark:text-neutral-400">{treatment.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tooth Chart */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Tooth Chart Status</h4>
              <div className="space-y-2">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">Missing Teeth:</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.dental.toothChart.missing.join(', ') || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">Filled Teeth:</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.dental.toothChart.filled.join(', ') || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">Decayed Teeth:</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.dental.toothChart.decayed.join(', ') || 'None'}</p>
                  </div>
                </div>
                {patient.dental.toothChart.notes && (
                  <div className="mt-3 p-3 bg-accent-50 dark:bg-accent-900/20 rounded border border-accent-200 dark:border-accent-800">
                    <p className="text-xs text-accent-800 dark:text-accent-300">{patient.dental.toothChart.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder for Detailed Tooth Chart */}
            <div className="p-6 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-center">
              <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">Detailed Dental Chart (Coming Soon)</p>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-secondary-800 dark:text-white">Consultation History</h4>
            <div className="space-y-3">
              {patient.history.consultations.map((consult, idx) => (
                <div key={idx} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        consult.type === 'Medical' 
                          ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                          : 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                      }`}>
                        {consult.type}
                      </span>
                      <span className="text-xs text-secondary-500 dark:text-neutral-400">{consult.id}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-secondary-600 dark:text-neutral-300">{consult.date}</p>
                      <p className="text-xs text-secondary-500 dark:text-neutral-400">{consult.time}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-secondary-800 dark:text-white mb-1">{consult.diagnosis}</p>
                  <p className="text-xs text-secondary-600 dark:text-neutral-300 mb-2">{consult.doctor}</p>
                  {consult.vitalSigns && (
                    <div className="flex gap-3 mb-2 text-xs">
                      <span className="text-secondary-500 dark:text-neutral-400">BP: {consult.vitalSigns.bp}</span>
                      <span className="text-secondary-500 dark:text-neutral-400">Temp: {consult.vitalSigns.temp}°C</span>
                      <span className="text-secondary-500 dark:text-neutral-400">HR: {consult.vitalSigns.heartRate} bpm</span>
                    </div>
                  )}
                  <div className="bg-white dark:bg-neutral-800 rounded p-2 mt-2">
                    <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300 mb-1">Treatment:</p>
                    <p className="text-xs text-secondary-600 dark:text-neutral-400">{consult.treatment}</p>
                  </div>
                  <div className="bg-white dark:bg-neutral-800 rounded p-2 mt-2">
                    <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300 mb-1">Notes:</p>
                    <p className="text-xs text-secondary-600 dark:text-neutral-400">{consult.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'appointments':
        return (
          <div className="space-y-4">
            {/* Upcoming Appointments */}
            <div>
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upcoming Appointments
              </h4>
              <div className="space-y-2">
                {patient.history.appointments.map((appt, idx) => (
                  <div key={idx} className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-secondary-800 dark:text-white">{appt.type}</p>
                        <p className="text-xs text-secondary-600 dark:text-neutral-300">{appt.doctor}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs font-medium rounded">
                        {appt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-secondary-600 dark:text-neutral-300">
                      <span>📅 {appt.date}</span>
                      <span>🕐 {appt.time}</span>
                      <span className="text-xs text-secondary-500 dark:text-neutral-400">{appt.id}</span>
                    </div>
                    <p className="text-xs text-secondary-600 dark:text-neutral-300 mt-2"><strong>Purpose:</strong> {appt.purpose}</p>
                    {appt.notes && (
                      <p className="text-xs text-accent-700 dark:text-accent-400 mt-1"><strong>Note:</strong> {appt.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Past Appointments */}
            <div>
              <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Past Appointments</h4>
              <div className="space-y-2">
                {patient.history.pastAppointments.map((appt, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-md border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{appt.type}</p>
                      <p className="text-xs text-secondary-500 dark:text-neutral-400">{appt.date}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs font-medium rounded">
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'medicines':
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Medicine Request History
            </h4>
            <div className="space-y-3">
              {patient.history.medicineRequests.map((request, idx) => (
                <div key={idx} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-secondary-800 dark:text-white">{request.medicine}</p>
                      <p className="text-xs text-secondary-600 dark:text-neutral-300">Quantity: {request.quantity}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      request.status === 'Dispensed'
                        ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                        : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-secondary-600 dark:text-neutral-300">
                    <p><strong>Request ID:</strong> {request.id}</p>
                    <p><strong>Reason:</strong> {request.reason}</p>
                    <p><strong>Prescribed by:</strong> {request.prescribedBy}</p>
                    <p><strong>Request Date:</strong> {request.date}</p>
                    {request.dispensedDate && (
                      <p><strong>Dispensed Date:</strong> {request.dispensedDate}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'obgyne':
        return (
          <div className="space-y-4">
            <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-pink-800 dark:text-pink-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                OB-GYN History <span className="text-xs font-normal text-pink-600 dark:text-pink-400">(Female Patients Only)</span>
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Last Menstrual Period</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{patient.obgyne.lastMenstrualPeriod || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Menstruation Duration</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{patient.obgyne.menstruationDuration || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Dysmenorrhea</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white capitalize">{patient.obgyne.dysmenorrhea || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'documents':
        return (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Documents feature coming soon</p>
            <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Medical certificates, lab results, dental photos (upper/lower teeth), and uploaded documents will appear here</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Back Button */}
      {!embedded && (
        <Link
          to="/search"
          className="inline-flex items-center gap-1 text-sm text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Search
        </Link>
      )}

      {/* Record Status Banner */}
      {bannerCfg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${bannerCfg.cls}`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{bannerCfg.label}</span>
          {updateTicket?.scope && (
            <span className="ml-1 opacity-70">· {updateTicket.scope} scope</span>
          )}
        </div>
      )}
      <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar with better styling */}
            <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-neutral-800">
              {patient.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-1">{patient.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-600 dark:text-neutral-300 mb-2">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  {patient.id}
                </span>
                <span className="text-neutral-400">•</span>
                <span>{patient.program}</span>
                <span className="text-neutral-400">•</span>
                <span>{patient.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs font-semibold rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {patient.status}
                </span>
                <span className="inline-flex items-center px-3 py-1 bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 text-xs font-medium rounded-full border border-neutral-200 dark:border-neutral-600">
                  {patient.type}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Record
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex gap-1 p-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all rounded-lg ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default PatientRecord;
