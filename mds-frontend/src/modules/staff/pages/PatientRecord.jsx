import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Patient Record View Page
 * Displays comprehensive patient information in tabs
 */
const PatientRecord = () => {
  const { patientId } = useParams();
  const [activeTab, setActiveTab] = useState('personal');

  // Mock patient data - Comprehensive test student
  const patient = {
    id: patientId || '2020202',
    name: 'Juan Santos Dela Cruz',
    email: 'juan.delacruz@tip.edu.ph',
    program: 'BS Computer Science (CCS)',
    year: 'Junior',
    status: 'Active',
    type: 'Student',
    avatar: null,
    
    // Personal Info - Complete profile
    personal: {
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      suffix: '',
      birthDate: '2003-05-15',
      age: 22,
      sex: 'Male',
      civilStatus: 'Single',
      nationality: 'Filipino',
      religion: 'Roman Catholic',
      address: '123 Mabini St., Brgy. San Antonio, Quezon City, Metro Manila 1105',
      contactNumber: '09123456789',
      studentNumber: '2020202',
      studentCategory: 'Old Student',
      lastSchoolAttended: 'Manila Science High School',
      drugTestDone: 'Yes',
    },
    
    // Emergency Contacts
    emergencyContacts: {
      first: { 
        name: 'Maria Santos Dela Cruz', 
        relationship: 'Mother', 
        contact: '09187654321',
        address: '123 Mabini St., Brgy. San Antonio, Quezon City'
      },
      second: { 
        name: 'Jose Dela Cruz', 
        relationship: 'Father', 
        contact: '09198765432',
        address: '123 Mabini St., Brgy. San Antonio, Quezon City'
      },
    },
    
    // Medical History - Self conditions
    medicalHistory: {
      self: ['COVID-19 (Recovered)', 'Bronchial Asthma (Mild)'],
      selfDetails: 'Had COVID-19 in 2024, fully recovered. Asthma diagnosed at age 12.',
      family: ['Hypertension', 'Diabetes'],
      familyDetails: 'Father has hypertension. Mother has Type 2 diabetes.',
    },
    
    // Medical Record - Complete medical background
    medical: {
      // Vital Signs
      vitalSigns: { 
        height: 175, 
        weight: 70, 
        bmi: 22.9,
        bp: '120/80', 
        heartRate: 72, 
        temperature: 36.5,
        lastChecked: '2026-01-15'
      },
      
      // Blood Type
      bloodType: 'O+',
      
      // Allergies
      allergies: {
        drug: 'Penicillin',
        food: 'Shellfish, Peanuts',
        other: 'Dust mites'
      },
      
      // Medical Conditions
      conditions: ['Bronchial Asthma (Mild)'],
      
      // Current Medications
      medications: ['Salbutamol Inhaler (as needed)'],
      
      // Immunizations
      immunizations: [
        'COVID-19 (Pfizer - 2 doses + 1 booster)',
        'Hepatitis B',
        'MMR',
        'Tetanus',
        'Influenza (2025)'
      ],
      
      // Hospitalizations
      hospitalizations: [
        { year: '2024', reason: 'COVID-19', hospital: 'TIP Medical Center', duration: '5 days' }
      ],
      
      // Operations
      operations: 'None',
      
      // Lifestyle
      lifestyle: {
        smoker: 'No',
        alcoholDrinker: 'Occasionally (Social events only)',
        tattoo: 'None',
        piercing: 'None',
      },
      
      // Vision
      vision: {
        hasEyeglasses: true,
        hasContactLenses: false,
        gradeOD: '-1.50',
        gradeOS: '-1.75',
        lastExam: '2025-06-10'
      },
    },
    
    // Dental Record - Complete dental history
    dental: {
      firstTimeDentist: '2010',
      lastConsultation: '2025-11-20',
      lastCleaning: '2025-08-15',
      
      // Oral Findings
      oralFindings: [
        'Calculus Present (Minimal)',
        'Gingivitis (Mild)',
        'Dental Caries (Tooth #14)',
        'Missing Tooth (#18 - Wisdom tooth extracted)'
      ],
      
      // Treatments Received
      treatments: [
        { date: '2025-11-20', treatment: 'Routine Checkup', dentist: 'Dr. Garcia' },
        { date: '2025-08-15', treatment: 'Dental Cleaning & Fluoride Application', dentist: 'Dr. Garcia' },
        { date: '2025-03-10', treatment: 'Tooth Extraction (#18)', dentist: 'Dr. Santos' },
        { date: '2024-11-05', treatment: 'Dental Filling (#14)', dentist: 'Dr. Garcia' },
      ],
      
      // Appliances
      hasAppliance: 'No',
      applianceType: null,
      
      // Tooth Chart Status
      toothChart: {
        missing: ['#18'],
        filled: ['#14'],
        decayed: [],
        notes: 'Good oral hygiene. Regular dental visits recommended.'
      }
    },
    
    // Consultation History
    history: {
      consultations: [
        { 
          id: 'CONS-2026-015',
          date: '2026-01-15', 
          time: '10:30 AM',
          type: 'Medical', 
          doctor: 'Dr. Elena Smith', 
          diagnosis: 'Upper Respiratory Infection', 
          treatment: 'Prescribed Amoxicillin 500mg (3x daily for 7 days)',
          notes: 'Patient presented with cough and fever. Advised rest and hydration.',
          status: 'Completed',
          vitalSigns: { bp: '120/80', temp: 37.8, heartRate: 78 }
        },
        { 
          id: 'CONS-2025-142',
          date: '2025-11-20', 
          time: '2:00 PM',
          type: 'Dental', 
          doctor: 'Dr. Maria Garcia', 
          diagnosis: 'Routine Dental Checkup', 
          treatment: 'Oral prophylaxis recommended',
          notes: 'Good oral hygiene maintained. No cavities found.',
          status: 'Completed'
        },
        { 
          id: 'CONS-2025-098',
          date: '2025-08-15', 
          time: '9:00 AM',
          type: 'Dental', 
          doctor: 'Dr. Maria Garcia', 
          diagnosis: 'Dental Cleaning', 
          treatment: 'Scaling, polishing, and fluoride application',
          notes: 'Mild calculus buildup removed. Patient advised to brush twice daily.',
          status: 'Completed'
        },
        { 
          id: 'CONS-2025-045',
          date: '2025-03-10', 
          time: '11:00 AM',
          type: 'Dental', 
          doctor: 'Dr. Carlos Santos', 
          diagnosis: 'Impacted Wisdom Tooth', 
          treatment: 'Tooth extraction (#18)',
          notes: 'Surgical extraction performed. Post-op care instructions given.',
          status: 'Completed'
        },
      ],
      
      // Upcoming Appointments
      appointments: [
        { 
          id: 'APPT-2026-045',
          date: '2026-02-10', 
          time: '10:00 AM',
          type: 'Medical Clearance', 
          doctor: 'Dr. Elena Smith',
          purpose: 'Required for OJT clearance',
          status: 'Scheduled',
          notes: 'Bring previous medical records'
        },
        { 
          id: 'APPT-2026-078',
          date: '2026-03-15', 
          time: '2:00 PM',
          type: 'Dental Checkup', 
          doctor: 'Dr. Maria Garcia',
          purpose: 'Routine 6-month checkup',
          status: 'Scheduled',
          notes: ''
        },
      ],
      
      // Past Appointments
      pastAppointments: [
        { date: '2026-01-15', type: 'Medical Consultation', status: 'Completed' },
        { date: '2025-11-20', type: 'Dental Checkup', status: 'Completed' },
        { date: '2025-08-15', type: 'Dental Cleaning', status: 'Completed' },
      ],
      
      // Medicine Requests
      medicineRequests: [
        {
          id: 'MED-2026-089',
          date: '2026-01-20',
          medicine: 'Paracetamol 500mg',
          quantity: '10 tablets',
          reason: 'Headache relief',
          prescribedBy: 'Dr. Elena Smith',
          status: 'Dispensed',
          dispensedDate: '2026-01-20'
        },
        {
          id: 'MED-2025-234',
          date: '2025-12-05',
          medicine: 'Salbutamol Inhaler',
          quantity: '1 piece',
          reason: 'Asthma maintenance',
          prescribedBy: 'Dr. Elena Smith',
          status: 'Dispensed',
          dispensedDate: '2025-12-05'
        },
      ],
      
      // Record Update Requests
      updateRequests: [
        {
          id: 'UPD-2026-012',
          date: '2026-01-30',
          type: 'Medical Record Update',
          description: 'Updated allergy information',
          requestedBy: 'Juan Dela Cruz',
          status: 'Approved',
          approvedBy: 'Dr. Elena Smith',
          approvedDate: '2026-02-01'
        },
      ],
    },
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'medical', label: 'Medical Record' },
    { id: 'dental', label: 'Dental Record' },
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
              <div className="p-6">
                <p className="text-sm text-secondary-700 dark:text-neutral-300">{patient.personal.address}</p>
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
                  'First Time Dentist': patient.dental.firstTimeDentist,
                  'Last Consultation': patient.dental.lastConsultation,
                  'Last Cleaning': patient.dental.lastCleaning,
                }).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{value}</p>
                  </div>
                ))}
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

      case 'documents':
        return (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Documents feature coming soon</p>
            <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Medical certificates, lab results, and uploaded documents will appear here</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Link
        to="/staff/search"
        className="inline-flex items-center gap-1 text-sm text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Search
      </Link>

      {/* Patient Header */}
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
