'use strict';
function fixture(role = 'Student', kind = 'initial', scope = 'Both') {
  const manifest = {
    version: 1, verified: true, role, kind, scope, url: 'https://patient.qa.invalid', patientId: '7001', ticketId: '9001',
    labels: { '101': 'QA Self Condition', '102': 'QA Family Condition', '103': 'QA Vaccine',
      'allergen:11': 'QA Allergen', '104': 'QA Hospitalization', '105': 'QA Operation', '106': 'QA Medication',
      '107': 'QA Dental Procedure', '108': 'QA Appliance', '109': 'QA Computer Science' },
    record: {
      personalInfo: { first_name: 'Synthetic', middle_name: 'QA', last_name: role, suffix: 'Jr.', date_of_birth: '2000-04-05', sex: 'Female',
        civil_status: 'Single', nationality: 'Filipino', religion: 'QA Belief', contactNumber: '09170000000', present_address: 'QA Present Address\nSecond line', province_address: 'QA Province', branch: 'Manila', identifier: '70010001' },
      profile: role === 'Student' ? { programId: '109', year: 'Freshman' } : { department: 'QA Facilities', role: 'Other', employmentCategoryOther: 'QA Research Consultant', position: 'QA Consultant' },
      emergencyContact: { firstContact: { contactName: 'QA Primary', relationship: 'Mother', contactNumber: '09180000001', address: 'QA Contact Address' }, secondContact: { contactName: 'QA Secondary', relationship: 'Father', contactNumber: '09180000002', address: 'QA Other Address' } },
      medicalHistory: { conditions: [{ conditionId: '101', relationship: null, description: null, diagnosedDate: '2024-02-03' }, { conditionId: '102', relationship: 'Mother', description: null, diagnosedDate: null }], notes: 'QA History\nMultiline note' },
      allergyProfile: { allergies: [{ allergenCatalogId: '11', status: 'Active', severity: 'Mild', notes: 'QA Allergy Detail', dateIdentified: '2024-02-04' }], notes: 'QA Allergy Profile Notes' },
      immunizationProfile: { immunizations: [{ vaccineTypeId: '103', immunizationDate: '2024-02-05', doseNumber: 2 }], notes: 'QA Vaccine Notes' },
      hospitalizationProfile: { hospitalizations: [{ conditionId: '104', admissionDate: '2024-02-06', dischargeDate: '2024-02-07', notes: 'QA Hospital Detail' }], notes: 'QA Hospital Notes' },
      operationProfile: { operations: [{ procedureId: '105', operationDate: '2024-02-08', notes: 'QA Operation Detail' }], notes: 'QA Operation Notes' },
      medicationProfile: { medications: [{ medicineId: '106', description: 'QA Medication Reason' }], notes: 'QA Medication Notes' },
      lifestyle: { smoker: true, numberOfCigarettesPerDay: 0, yearsSmoked: 0, alcoholConsumer: true, frequencyOfAlcoholConsumption: 'QA Occasionally', vapeUser: true, vapeType: 'QA Vape', vapeFrequency: 'QA Weekly', yearsVaping: 0, notes: 'QA Lifestyle Notes' },
      visualAcuityProfile: { acuity: { acuityId: '1', left_eye: '0', right_eye: '-1.75', notes: 'QA Glasses Notes', recorded_at: '2024-02-09' }, notes: 'QA Vision Notes' },
      dentalHistory: { seenByDentist: true, lastDentalCleaning: '0-6', purpose: 'QA Consultation', lastVisitDate: '2024-02-10' },
      dentalProcedureProfile: { procedures: [{ procedureTypeId: '107', procedureDate: '2024-02-11' }], notes: 'QA Dental Procedure Notes' },
      oralApplianceProfile: { appliances: [{ tagId: '108', status: 'Active', dateIssued: '2024-02-12', arch: 'Upper' }], notes: 'QA Appliance Notes', otherDescription: 'QA Other Appliance', otherArch: 'Lower' },
      dentalPhotoRecord: { upperTeeth: 'qa-upper-photo', lowerTeeth: 'qa-lower-photo' },
      obgynHistory: { lastMenstrualPeriod: '2024-02-13', hasDysmenorrhea: false, notes: 'QA OB Notes\nSecond line' },
    },
    controls: [{ section: 'personal', fields: [] }, { section: 'history', fields: [] }, { section: 'background', fields: [] }, { section: 'dental', fields: [] }],
    review: [{ label: 'Nationality', value: 'Filipino' }],
  };
  if (kind === 'update') manifest.baseline = { ticketId: '8001', record: structuredClone(manifest.record) };
  return manifest;
}

function staffRecord(manifest) {
  const record = Object.fromEntries(Object.entries(manifest.record).map(([key, value]) => [key, { id: manifest.ticketId, ...structuredClone(value) }]));
  record.basicInfo = { ...manifest.record.personalInfo, id: manifest.patientId, profile_type: manifest.role };
  if (manifest.role === 'Student') { record.profile.program = manifest.labels[record.profile.programId]; delete record.profile.programId; }
  const catalog = ids => ids.map(id => ({ id, name: manifest.labels[id] }));
  record.catalogs = {
    medicalConditionCatalog: catalog(['101', '102']), hospitalizationCatalog: catalog(['104']), operationCatalog: catalog(['105']),
    medicationCatalog: catalog(['106']), immunizationCatalog: catalog(['103']), dentalProcedureCatalog: catalog(['107']), oralApplianceCatalog: catalog(['108']),
    allergenCatalog: [{ id: '11', allergen: manifest.labels['allergen:11'], type: 'Environmental' }],
  };
  return record;
}
module.exports = { fixture, staffRecord };
