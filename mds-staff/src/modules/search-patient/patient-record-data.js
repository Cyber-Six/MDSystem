export const GQL_FULL_RECORD = `
  query GetFullPatientRecord($userId: ID!) {
    getPatientBasicInfo(userId: $userId) {
      id identifier branch sex
      first_name last_name middle_name suffix
      profile_type program year department role
      latest_ticket_id latest_status latest_scope latest_updated_at
    }
    getUserUpdateTicket(userId: $userId) { id patientId status scope }
    getUserVitalSigns(userId: $userId, limit: 1) {
      id height_cm weight_kg blood_pressure heart_rate temperature notes created_at
    }
    getUserMedicalHistory(userId: $userId, limit: 1) {
      id notes created_at
      conditions { id conditionId description diagnosedDate relationship }
    }
    getUserAllergyProfile(userId: $userId, limit: 1) {
      id notes created_at
      allergies { id allergenCatalogId status severity notes dateIdentified }
    }
    getUserImmunizationProfile(userId: $userId, limit: 1) {
      id notes created_at
      immunizations { id vaccineTypeId immunizationDate doseNumber }
    }
    getUserLifestyle(userId: $userId, limit: 1) {
      id smoker numberOfCigarettesPerDay yearsSmoked
      alcoholConsumer frequencyOfAlcoholConsumption notes created_at
    }
    getUserObgynHistory(userId: $userId, limit: 1) {
      id lastMenstrualPeriod hasDysmenorrhea notes created_at
    }
    getUserEmergencyContact(userId: $userId, limit: 1) {
      id created_at
      firstContact  { id contactName relationship contactNumber address }
      secondContact { id contactName relationship contactNumber address }
    }
    getUserMedicationProfile(userId: $userId, limit: 1) {
      id notes created_at
      medications { id medicineId description }
    }
    getUserDentalHistory(userId: $userId, limit: 1) {
      id seenByDentist lastDentalCleaning purpose lastVisitDate archived_at
    }
    getUserDentalRecord(userId: $userId, limit: 1) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
    }
    getUserOralApplianceProfile(userId: $userId, limit: 1) {
      id notes created_at
      appliances { id tagId status dateIssued arch }
    }
    getUserDentalProcedureProfile(userId: $userId, limit: 1) {
      id notes created_at
      procedures { id procedureTypeId procedureDate }
    }
    getUserVisualAcuityProfile(userId: $userId, limit: 1) {
      id notes created_at
      acuity { id acuityId left_eye right_eye notes recorded_at }
    }
    getUserHospitalizationProfile(userId: $userId, limit: 1) {
      id notes created_at
      hospitalizations { id conditionId admissionDate dischargeDate notes }
    }
    getUserOperationProfile(userId: $userId, limit: 1) {
      id notes created_at
      operations { id procedureId operationDate notes }
    }
    allergenCatalogs: getAllergenCatalogs { id allergen type }
    conditionCatalogs: getDomainCatalogs(domain: MedicalCondition) { id name }
    immunizationCatalogs: getDomainCatalogs(domain: Immunization) { id name }
    operationCatalogs: getDomainCatalogs(domain: Operation) { id name }
    hospitalizationCatalogs: getDomainCatalogs(domain: Hospitalization) { id name }
    dentalProcedureCatalogs: getDomainCatalogs(domain: DentalProcedure) { id name }
    medicationCatalogs: getDomainCatalogs(domain: Medication) { id name }
    oralApplianceCatalogs: getOralApplianceCatalogs { id name }
    getUserDentalPhotoRecord(userId: $userId, limit: 1) {
      id upperTeeth lowerTeeth isValid created_at
    }
  }
`;


export const GQL_PERSONAL_PROFILE = `
  query GetUserPersonalProfile($userId: ID!) {
    getUserPersonalRecord(userId: $userId) {
      first_name middle_name last_name suffix
      date_of_birth sex civil_status nationality religion
      contactNumber present_address province_address email
    }
  }
`;

export const STATUS_BANNER = {
  InProgress: { cls: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300', label: 'Record update in progress' },
  Pending: { cls: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300', label: 'Awaiting staff approval' },
  Revision: { cls: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300', label: 'Revision requested' },
  RevisionSubmitted: { cls: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300', label: 'Revision submitted - awaiting review' },
  Approved: { cls: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300', label: 'Record is up to date' },
};

export const MOCK_PATIENT_RECORDS = {
  'mock-2310346': {
    id: '2310346',
    name: 'King Rey Samarita',
    email: '2310346@tip.edu.ph',
    program: 'BSIT',
    year: '3rd Year',
    department: '',
    semester: '2nd Semester AY 2025-2026',
    status: 'Approved',
    type: 'Student',
    avatar: null,
    personal: {
      firstName: 'King Rey',
      middleName: 'Ramos',
      lastName: 'Samarita',
      suffix: '',
      birthDate: 'Jun 03, 2004',
      age: '21',
      sex: 'Male',
      civilStatus: 'Single',
      nationality: 'Filipino',
      religion: 'Roman Catholic',
      address: 'Blk 12 Lot 8, Quezon City, Metro Manila',
      presentAddress: 'Blk 12 Lot 8, Quezon City, Metro Manila',
      provinceAddress: '',
      contactNumber: '09171234567',
      studentNumber: '2310346',
      studentCategory: 'Regular',
      lastSchoolAttended: 'TIP SHS',
      drugTestDone: 'Yes',
      employeeNumber: '',
      position: '',
      employmentCategory: '',
      employmentStatus: '',
      branch: 'Manila',
    },
    emergencyContacts: {
      first: { name: 'Maria Samarita', relationship: 'Mother', contact: '09181234567', address: 'Quezon City' },
      second: { name: 'Jose Samarita', relationship: 'Father', contact: '09192345678', address: 'Quezon City' },
    },
    medicalHistory: {
      self: ['Asthma'],
      selfDetails: 'Uses inhaler during sudden weather changes.',
      family: [
        { name: 'Hypertension', relationship: 'Father' },
        { name: 'Diabetes', relationship: 'Grandmother' },
      ],
      familyDetails: 'No known hereditary cancer history.',
    },
    medical: {
      vitalSigns: { height: '170', weight: '67', bmi: '23.2', bp: '118/78', heartRate: '76', temperature: '36.7', lastChecked: 'Mar 10, 2026' },
      bloodType: 'O+',
      allergies: { drug: 'Ibuprofen', food: 'Shrimp', other: 'Dust' },
      allergiesList: [
        { name: 'Ibuprofen', type: 'Drug', severity: 'Moderate', status: 'Active' },
        { name: 'Shrimp', type: 'Food', severity: 'Mild', status: 'Active' },
        { name: 'Dust Mites', type: 'Environmental', severity: 'Mild', status: 'Active' },
      ],
      conditions: ['Asthma'],
      medications: [
        { name: 'Cetirizine 10mg', description: 'as needed' },
        { name: 'Salbutamol inhaler', description: '' },
      ],
      immunizations: [
        { name: 'COVID-19 Booster', date: 'Jan 10, 2024', doseNumber: '3' },
        { name: 'Hepatitis B', date: 'Mar 05, 2023', doseNumber: '3' },
        { name: 'Tetanus', date: 'Aug 20, 2024', doseNumber: '1' },
      ],
      hospitalizations: [
        { condition: 'Dengue Fever', admittedDate: 'Jul 12, 2022', dischargedDate: 'Jul 17, 2022' },
      ],
      operations: [
        { procedure: 'Appendectomy', date: 'Mar 14, 2018' },
      ],
      lifestyle: { smoker: 'No', cigarettesPerDay: '', yearsSmoked: '', alcoholConsumer: 'Yes', alcoholFrequency: '2' },
      vision: { hasEyeglasses: true, hasContactLenses: false, gradeOD: '-1.25', gradeOS: '-1.00', lastExam: 'Jan 15, 2026' },
    },
    dental: {
      firstTimeDentist: 'No',
      lastConsultation: 'Feb 20, 2026',
      lastCleaning: 'Within 6 months',
      toothExtraction: 'no',
      dentalFilling: 'yes',
      oralFindings: ['Mild gingivitis', 'Impacted wisdom tooth (upper right)'],
      treatments: [
        { treatment: 'Oral prophylaxis', dentist: 'Dr. Ramos', date: 'Feb 20, 2026' },
        { treatment: 'Temporary filling', dentist: 'Dr. Santos', date: 'Oct 11, 2025' },
      ],
      hasAppliance: 'No',
      applianceType: null,
      toothChart: { missing: ['18'], filled: ['26'], decayed: ['48'], notes: 'Observe lower right molars for caries progression.' },
    },
    obgyne: { lastMenstrualPeriod: '', menstruationDuration: '', dysmenorrhea: '' },
    history: {
      consultations: [
        {
          id: 'CONS-2026-0309', type: 'Medical', date: 'Mar 09, 2026', time: '10:00 AM', diagnosis: 'Upper Respiratory Tract Infection',
          doctor: 'Dr. Dela Cruz', vitalSigns: { bp: '118/78', temp: '37.4', heartRate: '84' }, treatment: 'Hydration + antihistamine', notes: 'Return if fever persists > 48 hours.',
        },
      ],
      appointments: [{ id: 'APT-2026-0441', type: 'Dental Consultation', doctor: 'Dr. Santos', status: 'Confirmed', date: 'Mar 18, 2026', time: '01:00 PM', purpose: 'Wisdom tooth assessment', notes: '' }],
      pastAppointments: [{ type: 'Medical Follow-up', date: 'Feb 14, 2026', status: 'Completed' }],
      medicineRequests: [{ id: 'MR-1009', medicine: 'Paracetamol 500mg', quantity: 10, reason: 'Headache', prescribedBy: 'Dr. Dela Cruz', date: 'Feb 14, 2026', status: 'Dispensed', dispensedDate: 'Feb 14, 2026' }],
      updateRequests: [],
    },
  },
  'mock-2310345': {
    id: '2310345',
    name: 'Random Guy',
    email: 'random.guy.mds@tip.edu.ph',
    program: 'Human Resources',
    year: 'Staff',
    department: 'Admin Office',
    semester: '',
    status: 'Pending',
    type: 'Employee',
    avatar: null,
    personal: {
      firstName: 'Random', middleName: 'M.', lastName: 'Guy', suffix: '', birthDate: 'Sep 15, 1995', age: '30', sex: 'Male', civilStatus: 'Single',
      nationality: 'Filipino', religion: 'Christian', address: 'Pasig City, Metro Manila', presentAddress: 'Pasig City, Metro Manila', provinceAddress: '', contactNumber: '09981234567', studentNumber: '', studentCategory: '',
      lastSchoolAttended: '', drugTestDone: 'Yes', employeeNumber: '2310345', position: 'HR Assistant', employmentCategory: 'Teaching and Non-Teaching', employmentStatus: 'Regular', branch: 'QuezonCity',
    },
    emergencyContacts: {
      first: { name: 'Anna Guy', relationship: 'Sister', contact: '09170001111', address: 'Pasig City' },
      second: { name: 'Luis Guy', relationship: 'Brother', contact: '09172223333', address: 'Cainta, Rizal' },
    },
    medicalHistory: { self: ['Hypertension'], selfDetails: 'Controlled with medication and diet.', family: [{ name: 'Hypertension', relationship: 'Mother' }], familyDetails: '' },
    medical: {
      vitalSigns: { height: '172', weight: '81', bmi: '27.4', bp: '130/85', heartRate: '80', temperature: '36.6', lastChecked: 'Mar 08, 2026' },
      bloodType: 'A+',
      allergies: { drug: 'None', food: 'None', other: 'None' },
      allergiesList: [],
      conditions: ['Hypertension'],
      medications: [{ name: 'Amlodipine 5mg', description: 'once daily' }],
      immunizations: [
        { name: 'Influenza', date: 'Oct 15, 2025', doseNumber: '1' },
        { name: 'COVID-19 Booster', date: 'Feb 10, 2025', doseNumber: '3' },
      ],
      hospitalizations: [],
      operations: [],
      lifestyle: { smoker: 'No', cigarettesPerDay: '', yearsSmoked: '', alcoholConsumer: 'Yes', alcoholFrequency: '3' },
      vision: { hasEyeglasses: true, hasContactLenses: false, gradeOD: '-0.75', gradeOS: '-0.50', lastExam: 'Dec 10, 2025' },
    },
    dental: {
      firstTimeDentist: 'No', lastConsultation: 'Jan 12, 2026', lastCleaning: 'Within 1 year', toothExtraction: 'no', dentalFilling: 'no',
      oralFindings: ['Mild plaque build-up'], treatments: [{ treatment: 'Oral prophylaxis', dentist: 'Dr. Cruz', date: 'Jan 12, 2026' }], hasAppliance: 'No', applianceType: null,
      toothChart: { missing: [], filled: [], decayed: [], notes: 'Maintain regular cleaning every 6 months.' },
    },
    obgyne: { lastMenstrualPeriod: '', menstruationDuration: '', dysmenorrhea: '' },
    history: {
      consultations: [
        {
          id: 'CONS-2026-0222', type: 'Medical', date: 'Feb 22, 2026', time: '08:30 AM', diagnosis: 'Blood pressure monitoring',
          doctor: 'Dr. Valdez', vitalSigns: { bp: '130/85', temp: '36.6', heartRate: '80' }, treatment: 'Continue maintenance meds', notes: 'Follow-up after 1 month.',
        },
      ],
      appointments: [{ id: 'APT-2026-0511', type: 'Medical Follow-up', doctor: 'Dr. Valdez', status: 'Pending', date: 'Mar 25, 2026', time: '09:30 AM', purpose: 'BP reassessment', notes: 'Bring previous lab result.' }],
      pastAppointments: [{ type: 'Dental Check-up', date: 'Jan 12, 2026', status: 'Completed' }],
      medicineRequests: [{ id: 'MR-1102', medicine: 'Amlodipine 5mg', quantity: 30, reason: 'Monthly maintenance', prescribedBy: 'Dr. Valdez', date: 'Feb 22, 2026', status: 'Dispensed', dispensedDate: 'Feb 22, 2026' }],
      updateRequests: [],
    },
  },
};
