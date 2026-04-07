/**
 * EMR Service — Handles all GraphQL mutations and queries for EMR data
 * Port of mds-patient/src/services/emr-service.js to React Native TypeScript
 */

import { sendGraphQLRequest } from './graphql-client';
import { axiosRequest } from '../core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  code?: string;
  name: string;
}

export interface AllergenCatalogItem {
  id: string;
  allergen: string;
  type: string;
}

export interface OralApplianceCatalogItem {
  id: string;
  name: string;
  description: string;
}

export interface AllCatalogs {
  medicalConditionCatalog: CatalogItem[];
  hospitalizationCatalog: CatalogItem[];
  operationCatalog: CatalogItem[];
  medicationCatalog: CatalogItem[];
  immunizationCatalog: CatalogItem[];
  allergenCatalog: AllergenCatalogItem[];
  oralApplianceCatalog: OralApplianceCatalogItem[];
  visualAcuityCatalog: CatalogItem[];
  dentalProcedureCatalog: CatalogItem[];
}

export interface RecordStatus {
  needsInitialRecord: boolean;
  status: string | null;
  ticketId?: string | null;
  notes?: string | null;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  contactNumber: string;
  address: string;
}

export interface PersonalInfo {
  surname: string;
  firstName: string;
  middleName: string;
  suffix?: string;
  birthday: string;
  age: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  religion: string;
  address: string;
  provinceAddress: string;
  contactNumber: string;
  program: string;
  programOther?: string;
  studentNumber: string;
  studentCategory: string;
  drugTestDone: string;
  lastSchoolAttended: string;
  emergencyContacts: EmergencyContact[];
}

export interface FormData {
  personalInfo: PersonalInfo;
  medicalHistory: {
    self: Record<string, boolean>;
    family: Record<string, boolean>;
    familyWhoHasIt: Record<string, string>;
    selfOther?: string;
    selfOtherChecked?: boolean;
    familyOther?: string;
    familyOtherWhoHasIt?: string;
    familyOtherChecked?: boolean;
  };
  medicalBackground: {
    immunizations: Record<string, boolean>;
    immunizationDetails: Record<string, { date: string; doseNumber: string }>;
    immunizationOther: string;
    hasAllergies: string;
    allergies: Record<string, { checked: boolean; severity: string; status: string } | boolean>;
    allergyOther: string;
    allergyNotes: string;
    hasHospitalization: string;
    hospitalizationConditions: Record<string, boolean>;
    hospitalizationDates: Record<string, { admissionDate: string; dischargeDate: string }>;
    hospitalizationDate: string;
    hospitalizationDischargeDate: string;
    hospitalizationNotes: string;
    hasOperation: string;
    operationConditions: Record<string, boolean>;
    operationDates: Record<string, string>;
    operationDate: string;
    operationNotes: string;
    hasMedications: string;
    selectedMedications: Record<string, boolean>;
    medicationReason: string;
    medicationNotes: string;
    medicationDescription: string;
    smoker: string;
    smokerSticksPerDay: string;
    smokerYears: string;
    alcoholDrinker: string;
    alcoholFrequency: string;
    vaper: string;
    vapeType: string;
    vapeFrequency: string;
    yearsVaping: string;
    eyeglasses: boolean;
    contactLenses: boolean;
    gradeOD: string;
    gradeOS: string;
    visualAcuityDate: string;
  };
  dentalHistory: {
    firstTimeDentist: string;
    lastDentalConsultation: string;
    lastDentalCleaning: string;
    purpose: string;
    hasIntraOralAppliance: string;
    intraOralAppliances: Record<string, { checked: boolean; arch: string; status: string; dateIssued: string } | boolean>;
    applianceOther: string;
    applianceLocation: string;
    selectedDentalProcedures: Record<string, boolean>;
    procedureDates: Record<string, string>;
    upperTeethPhoto: { uri: string; name: string; type: string; id?: string } | null;
    lowerTeethPhoto: { uri: string; name: string; type: string; id?: string } | null;
  };
  obgyne?: {
    lastMenstrualPeriod: string;
    menstruationDuration: string;
    menarcheYearAge: string;
    padsPerDay: string;
    dysmenorrhea: string;
  };
  certification?: {
    verified: boolean;
    fullName: string;
    date: string;
  };
}

// ─── Empty form data initializer ──────────────────────────────────────────────

export const createEmptyFormData = (): FormData => ({
  personalInfo: {
    surname: '', firstName: '', middleName: '', suffix: '',
    birthday: '', age: '', gender: '', civilStatus: '',
    nationality: '', religion: '', address: '', provinceAddress: '',
    contactNumber: '', program: '', programOther: '',
    studentNumber: '', studentCategory: '', drugTestDone: '',
    lastSchoolAttended: '',
    emergencyContacts: [
      { name: '', relationship: '', contactNumber: '', address: '' },
      { name: '', relationship: '', contactNumber: '', address: '' },
    ],
  },
  medicalHistory: { self: {}, family: {}, familyWhoHasIt: {} },
  medicalBackground: {
    immunizations: {}, immunizationDetails: {}, immunizationOther: '',
    hasAllergies: '', allergies: {}, allergyOther: '', allergyNotes: '',
    hasHospitalization: '', hospitalizationConditions: {}, hospitalizationDates: {}, hospitalizationDate: '', hospitalizationDischargeDate: '', hospitalizationNotes: '',
    hasOperation: '', operationConditions: {}, operationDates: {}, operationDate: '', operationNotes: '',
    hasMedications: '', selectedMedications: {}, medicationReason: '', medicationNotes: '', medicationDescription: '',
    smoker: '', smokerSticksPerDay: '', smokerYears: '',
    alcoholDrinker: '', alcoholFrequency: '',
    vaper: '', vapeType: '', vapeFrequency: '', yearsVaping: '',
    eyeglasses: false, contactLenses: false, gradeOD: '', gradeOS: '', visualAcuityDate: '',
  },
  dentalHistory: {
    firstTimeDentist: '', lastDentalConsultation: '', lastDentalCleaning: '',
    purpose: '',
    hasIntraOralAppliance: '', intraOralAppliances: {}, applianceOther: '',
    applianceLocation: '', selectedDentalProcedures: {}, procedureDates: {},
    upperTeethPhoto: null, lowerTeethPhoto: null,
  },
  obgyne: {
    lastMenstrualPeriod: '', menstruationDuration: '',
    menarcheYearAge: '', padsPerDay: '', dysmenorrhea: '',
  },
  certification: { verified: false, fullName: '', date: '' },
});

// ─── Ticket management ───────────────────────────────────────────────────────

const fetchCurrentUpdateTicket = async () => {
  try {
    const data = await sendGraphQLRequest(
      `query GetCurrentUpdateTicket { getUpdateTicket { id status scope } }`, {}
    );
    return data.getUpdateTicket ?? null;
  } catch { return null; }
};

/** Public helper — returns the current update ticket including revision notes. */
export const getUpdateTicketStatus = async (): Promise<{
  id: string; status: string; scope: string; notes?: string;
} | null> => {
  try {
    const data = await sendGraphQLRequest(
      `query GetUpdateTicketFull { getUpdateTicket { id status scope notes } }`, {}
    );
    return data.getUpdateTicket ?? null;
  } catch { return null; }
};

const createUpdateTicket = async (scope = 'Both'): Promise<string> => {
  const mutation = `mutation CreateUpdateTicket($scope: UpdateScope!) { createUpdateTicket(scope: $scope) }`;
  try {
    const data = await sendGraphQLRequest(mutation, { scope });
    return data.createUpdateTicket;
  } catch (error: any) {
    const isStale = error.message?.toLowerCase().includes('already in progress');
    if (isStale) {
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.status === 'Revision') return existing.id;
      await cancelUpdateTicket();
      const retryData = await sendGraphQLRequest(mutation, { scope });
      return retryData.createUpdateTicket;
    }
    throw error;
  }
};

const submitUpdateTicket = async () => {
  const mutation = `mutation SubmitUpdateTicket { submitUpdateTicket }`;
  const data = await sendGraphQLRequest(mutation, {});
  return data.submitUpdateTicket;
};

const cancelUpdateTicket = async () => {
  try {
    const data = await sendGraphQLRequest(
      `mutation CancelUpdateTicket { cancelUpdateTicket }`, {}
    );
    return data.cancelUpdateTicket;
  } catch { return null; }
};

const cancelPersonalRecordLog = async () => {
  try {
    const data = await sendGraphQLRequest(
      `mutation CancelPersonalRecordLog { cancelPersonalRecordLog }`, {},
      { endpoint: '/profile/patient' }
    );
    return data.cancelPersonalRecordLog;
  } catch { return null; }
};

// ─── Media file upload (React Native) ─────────────────────────────────────────

const uploadMediaFile = async (photo: { uri: string; name: string; type: string } | null): Promise<string | null> => {
  if (!photo) return null;
  const body = new FormData();
  body.append('file', {
    uri: photo.uri,
    name: photo.name || 'photo.jpg',
    type: photo.type || 'image/jpeg',
  } as any);
  const response = await axiosRequest.post('/media/stage/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.fileId;
};

const unstageMediaFile = async (fileId: string | null) => {
  if (!fileId) return;
  try { await axiosRequest.delete(`/media/unstage/${encodeURIComponent(fileId)}`); } catch {}
};

// ─── Profile setup ───────────────────────────────────────────────────────────

const registerProfileSetup = async (
  identifier: string | undefined,
  personalInfo: PersonalInfo,
  isRevision = false,
  options: { branch?: string } = {}
) => {
  const pi = personalInfo || {} as PersonalInfo;
  const hasIdentifier = !!identifier?.trim();

  const personalInput = {
    first_name: pi.firstName?.trim() || '',
    middle_name: pi.middleName?.trim() || '',
    last_name: pi.surname?.trim() || '',
    suffix: pi.suffix?.trim() || null,
    date_of_birth: pi.birthday || null,
    sex: pi.gender || null,
    civil_status: pi.civilStatus || null,
    nationality: pi.nationality?.trim() || '',
    religion: pi.religion?.trim() || '',
    contactNumber: pi.contactNumber?.trim() || '',
    present_address: pi.address?.trim() || '',
    province_address: pi.provinceAddress?.trim() || pi.address?.trim() || '',
  };

  if (isRevision) {
    await cancelPersonalRecordLog();
  }

  const mutation = hasIdentifier && !isRevision
    ? `mutation ProfileSetup($branchInput: BranchIdentifierInput!, $input: userProfileInput!) {
        createBranchIdentifier(input: $branchInput) { branch identifier }
        createPersonalRecordLog(input: $input) { first_name last_name }
      }`
    : `mutation ProfileSetup($input: userProfileInput!) {
        createPersonalRecordLog(input: $input) { first_name last_name }
      }`;

  const branchInput: any = { identifier: identifier?.trim() || '' };
  if (options.branch) branchInput.branch = options.branch;

  const variables = hasIdentifier && !isRevision
    ? { branchInput, input: personalInput }
    : { input: personalInput };

  try {
    await sendGraphQLRequest(mutation, variables, { endpoint: '/profile/patient' });
  } catch (error: any) {
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('already in progress') || (msg.includes('identifier') && msg.includes('branch'))) {
      try { await cancelPersonalRecordLog(); } catch {}
      if (hasIdentifier) {
        try {
          const retryBranchInput: any = { identifier: identifier!.trim() };
          if (options.branch) retryBranchInput.branch = options.branch;
          await sendGraphQLRequest(
            `mutation RetryBranch($branchInput: BranchIdentifierInput!) { createBranchIdentifier(input: $branchInput) { branch identifier } }`,
            { branchInput: retryBranchInput },
            { endpoint: '/profile/patient' }
          );
        } catch {}
      }
      await sendGraphQLRequest(
        `mutation ProfileSetupRetry($input: userProfileInput!) { createPersonalRecordLog(input: $input) { first_name last_name } }`,
        { input: personalInput },
        { endpoint: '/profile/patient' }
      );
      return;
    }
    throw error;
  }
};

// ─── Record Builder Functions ─────────────────────────────────────────────────

const buildMedicalConditionRecords = (medicalHistory: FormData['medicalHistory']) => {
  const notes: string[] = [];
  const conditions = [
    ...Object.entries(medicalHistory?.self || {})
      .filter(([, checked]) => checked)
      .map(([id]) => ({ conditionId: id, diagnosedDate: null, relationship: null, description: null })),
    ...Object.entries(medicalHistory?.family || {})
      .filter(([, checked]) => checked)
      .map(([id]) => {
        const who = medicalHistory.familyWhoHasIt?.[id] || 'Family';
        return { conditionId: id, diagnosedDate: null, relationship: who, description: null };
      }),
  ];
  if (medicalHistory?.selfOther) notes.push(`Self: ${medicalHistory.selfOther}`);
  if (medicalHistory?.familyOther) {
    const who = medicalHistory.familyOtherWhoHasIt;
    notes.push(who ? `Family other: ${medicalHistory.familyOther} (${who})` : `Family other: ${medicalHistory.familyOther}`);
  }
  return { conditions, notes: notes.length ? notes.join('; ') : null };
};

const buildAllergyRecords = (bg: FormData['medicalBackground']) => {
  if (bg?.hasAllergies !== 'Yes') return { allergies: [], notes: null };
  const notes: string[] = [];
  const allergies = Object.entries(bg.allergies || {})
    .filter(([, val]) => (typeof val === 'object' ? val?.checked : val))
    .map(([id, val]) => ({
      allergenCatalogId: id,
      status: (typeof val === 'object' && val?.status) ? val.status : 'Active',
      severity: (typeof val === 'object' && val?.severity) ? val.severity : 'Unknown',
      notes: null,
      date_identified: null,
    }));
  if (bg.allergyOther) notes.push(`Other: ${bg.allergyOther}`);
  if (bg.allergyNotes) notes.push(bg.allergyNotes);
  return { allergies, notes: notes.length ? notes.join('; ') : null };
};

const buildHospitalizationRecords = (bg: FormData['medicalBackground']) => {
  if (bg?.hasHospitalization !== 'Yes') return { hospitalizations: [], notes: null };
  const today = new Date().toISOString().split('T')[0];
  const hospitalizations = Object.entries(bg.hospitalizationConditions || {})
    .filter(([, checked]) => checked)
    .map(([id]) => {
      const perItem = bg.hospitalizationDates?.[id];
      const admissionDate = perItem?.admissionDate
        ? new Date(perItem.admissionDate).toISOString().split('T')[0]
        : (bg.hospitalizationDate ? new Date(bg.hospitalizationDate).toISOString().split('T')[0] : today);
      const dischargeDate = perItem?.dischargeDate
        ? new Date(perItem.dischargeDate).toISOString().split('T')[0]
        : (bg.hospitalizationDischargeDate ? new Date(bg.hospitalizationDischargeDate).toISOString().split('T')[0] : null);
      return { conditionId: id, admissionDate, dischargeDate, notes: bg.hospitalizationNotes || null };
    });
  return { hospitalizations, notes: bg.hospitalizationNotes || null };
};

const buildOperationRecords = (bg: FormData['medicalBackground']) => {
  if (bg?.hasOperation !== 'Yes') return { operations: [], notes: null };
  const today = new Date().toISOString().split('T')[0];
  const operations = Object.entries(bg.operationConditions || {})
    .filter(([, checked]) => checked)
    .map(([id]) => {
      const perItemDate = bg.operationDates?.[id];
      const operationDate = perItemDate
        ? new Date(perItemDate).toISOString().split('T')[0]
        : (bg.operationDate ? new Date(bg.operationDate).toISOString().split('T')[0] : today);
      return { procedureId: id, operationDate, notes: bg.operationNotes || null };
    });
  return { operations, notes: bg.operationNotes || null };
};

const buildMedicationRecords = (bg: FormData['medicalBackground']) => {
  if (bg?.hasMedications !== 'Yes') return { medications: [], notes: null };
  const medications = Object.entries(bg.selectedMedications || {})
    .filter(([, checked]) => checked)
    .map(([id]) => ({ medicineId: id, description: bg.medicationDescription || bg.medicationReason || null }));
  return { medications, notes: bg.medicationNotes || null };
};

const buildImmunizationRecords = (bg: FormData['medicalBackground'], catalog: CatalogItem[]) => {
  const today = new Date().toISOString().split('T')[0];
  const validIds = new Set(catalog.map(c => c.id));
  const noteParts: string[] = [];
  const immunizationRecords = Object.entries(bg?.immunizations || {})
    .filter(([, checked]) => checked)
    .flatMap(([id]) => {
      if (!validIds.has(id)) { noteParts.push(id); return []; }
      const details = bg?.immunizationDetails?.[id];
      const immunizationDate = details?.date
        ? new Date(details.date).toISOString().split('T')[0]
        : today;
      const doseNumber = details?.doseNumber ? parseInt(details.doseNumber) || 1 : 1;
      return [{ vaccineTypeId: id, immunizationDate, doseNumber }];
    });
  if (bg?.immunizationOther?.trim()) noteParts.push(`Other: ${bg.immunizationOther.trim()}`);
  return { immunizationRecords, immunizationNotes: noteParts.length ? noteParts.join('; ') : null };
};

const buildOralApplianceRecords = (dh: FormData['dentalHistory'], catalog: OralApplianceCatalogItem[]) => {
  const validIds = new Set(catalog.map(c => c.id));
  const today = new Date().toISOString().split('T')[0];
  const appliances = Object.entries(dh?.intraOralAppliances || {})
    .filter(([, val]) => (typeof val === 'object' ? val?.checked : val))
    .flatMap(([id, val]) => {
      if (!validIds.has(id)) return [];
      const itemArch = (typeof val === 'object' && val?.arch) ? val.arch : 'None';
      const itemStatus = (typeof val === 'object' && val?.status) ? val.status : 'Active';
      const itemDate = (typeof val === 'object' && val?.dateIssued) ? val.dateIssued : today;
      return [{ tagId: id, status: itemStatus, dateIssued: itemDate, arch: itemArch }];
    });
  return { appliances, notes: dh?.applianceOther || null };
};

// ─── Utility mappings ─────────────────────────────────────────────────────────

const mapYearLevel = (category: string): string => {
  const mapping: Record<string, string> = {
    'Freshmen': 'Freshman', 'Freshmen - New student': 'Freshman',
    'Transferee': 'Sophomore', 'Graduate studies (New student)': 'Masteral',
    'Graduate studies (Old student)': 'Masteral', 'Returnee': 'Sophomore', 'Old Student': 'Junior',
  };
  return mapping[category] || category || 'Freshman';
};

const mapDentalCleaningRange = (frontendValue: string): string => {
  const mapping: Record<string, string> = {
    '0 to 6 months ago': '0-6', '7 to 11 months ago': '7-12', '1 year or more': '12-24', '': '',
  };
  return mapping[frontendValue] || '';
};

// ─── Batch input builder ──────────────────────────────────────────────────────

const buildBatchInputs = (
  formData: FormData,
  photoIds: { upperTeethFileId: string | null; lowerTeethFileId: string | null },
  allCatalogs: AllCatalogs
) => {
  const inputs: Record<string, any> = {};

  // Student profile
  if (formData.personalInfo.program) {
    inputs.studentProfile = {
      program: formData.personalInfo.program === 'Other'
        ? formData.personalInfo.programOther : formData.personalInfo.program,
      year: mapYearLevel(formData.personalInfo.studentCategory),
    };
  }

  // Emergency contacts
  if (formData.personalInfo.emergencyContacts?.length >= 2) {
    inputs.emergencyContact = {
      firstContact: {
        contactName: formData.personalInfo.emergencyContacts[0].name,
        relationship: formData.personalInfo.emergencyContacts[0].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[0].contactNumber,
        address: formData.personalInfo.emergencyContacts[0].address || null,
      },
      secondContact: {
        contactName: formData.personalInfo.emergencyContacts[1].name,
        relationship: formData.personalInfo.emergencyContacts[1].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[1].contactNumber,
        address: formData.personalInfo.emergencyContacts[1].address || null,
      },
    };
  }

  // Medical history
  const { conditions: medConditions, notes: medNotes } = buildMedicalConditionRecords(formData.medicalHistory);
  inputs.medicalHistory = { conditions: medConditions, notes: medNotes };

  // Allergy profile
  const { allergies, notes: allergyNotes } = buildAllergyRecords(formData.medicalBackground);
  inputs.allergyProfile = { allergies, notes: allergyNotes };

  // Hospitalization profile
  const { hospitalizations, notes: hospNotes } = buildHospitalizationRecords(formData.medicalBackground);
  inputs.hospitalizationProfile = { hospitalizations, notes: hospNotes };

  // Operation profile
  const { operations, notes: opNotes } = buildOperationRecords(formData.medicalBackground);
  inputs.operationProfile = { operations, notes: opNotes };

  // Medication profile
  const { medications, notes: medicalNotes } = buildMedicationRecords(formData.medicalBackground);
  inputs.medicationProfile = { medications, notes: medicalNotes };

  // Immunization profile
  const { immunizationRecords, immunizationNotes } = buildImmunizationRecords(
    formData.medicalBackground, allCatalogs.immunizationCatalog
  );
  inputs.immunizationProfile = { immunizations: immunizationRecords, notes: immunizationNotes };

  // Lifestyle
  inputs.lifestyle = {
    smoker: formData.medicalBackground.smoker === 'yes',
    numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerSticksPerDay) || null : null,
    yearsSmoked: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerYears) || null : null,
    alcoholConsumer: formData.medicalBackground.alcoholDrinker === 'yes',
    frequencyOfAlcoholConsumption: formData.medicalBackground.alcoholDrinker === 'yes'
      ? formData.medicalBackground.alcoholFrequency || null : null,
    vapeUser: formData.medicalBackground.vaper === 'yes',
    vapeType: formData.medicalBackground.vaper === 'yes'
      ? formData.medicalBackground.vapeType || null : null,
    vapeFrequency: formData.medicalBackground.vaper === 'yes'
      ? formData.medicalBackground.vapeFrequency || null : null,
    yearsVaping: formData.medicalBackground.vaper === 'yes'
      ? parseInt(formData.medicalBackground.yearsVaping) || null : null,
    notes: null,
  };

  // Visual acuity
  const hasVA = formData.medicalBackground.eyeglasses || formData.medicalBackground.contactLenses;
  const vaId = allCatalogs.visualAcuityCatalog[0]?.id ?? null;
  inputs.visualAcuityProfile = {
    notes: hasVA
      ? `Eyeglasses: ${formData.medicalBackground.eyeglasses ? 'Yes' : 'No'}, Contact Lenses: ${formData.medicalBackground.contactLenses ? 'Yes' : 'No'}`
      : null,
    acuity: hasVA && vaId ? {
      acuityId: vaId,
      left_eye: formData.medicalBackground.gradeOS || 'N/A',
      right_eye: formData.medicalBackground.gradeOD || 'N/A',
      notes: null,
      recorded_at: formData.medicalBackground.visualAcuityDate
        ? new Date(formData.medicalBackground.visualAcuityDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    } : null,
  };

  // Dental history
  inputs.dentalHistory = {
    seenByDentist: formData.dentalHistory.firstTimeDentist === 'no',
    lastDentalCleaning: mapDentalCleaningRange(formData.dentalHistory.lastDentalCleaning),
    purpose: formData.dentalHistory.purpose || null,
    lastVisitDate: formData.dentalHistory.lastDentalConsultation
      ? new Date(formData.dentalHistory.lastDentalConsultation + '-01').toISOString().split('T')[0]
      : null,
  };

  // Dental procedures
  const today = new Date().toISOString().split('T')[0];
  const validProcIds = new Set(allCatalogs.dentalProcedureCatalog.map(c => c.id));
  const dentalProcedures = Object.entries(formData.dentalHistory.selectedDentalProcedures || {})
    .filter(([id, checked]) => checked && validProcIds.has(id))
    .map(([id]) => ({
      procedureTypeId: id,
      procedureDate: formData.dentalHistory.procedureDates?.[id]
        ? new Date(formData.dentalHistory.procedureDates[id]).toISOString().split('T')[0]
        : today,
    }));
  inputs.dentalProcedureProfile = { procedures: dentalProcedures, notes: null };

  // Oral appliances
  const { appliances, notes: oralNotes } = buildOralApplianceRecords(
    formData.dentalHistory, allCatalogs.oralApplianceCatalog
  );
  inputs.oralApplianceProfile = { appliances, notes: oralNotes };

  // Dental photos — only include if both UUIDs are available (backend requires UUID! for both)
  if (photoIds.upperTeethFileId && photoIds.lowerTeethFileId) {
    inputs.dentalPhotoRecord = {
      upperTeeth: photoIds.upperTeethFileId,
      lowerTeeth: photoIds.lowerTeethFileId,
    };
  }

  // OB-GYNE (female only)
  if (formData.personalInfo.gender === 'Female' && formData.obgyne) {
    const lmpDate = formData.obgyne.lastMenstrualPeriod
      ? new Date(formData.obgyne.lastMenstrualPeriod).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const noteParts: string[] = [];
    if (formData.obgyne.menstruationDuration) noteParts.push(`Duration: ${formData.obgyne.menstruationDuration} days`);
    if (formData.obgyne.menarcheYearAge) noteParts.push(`Menarche: ${formData.obgyne.menarcheYearAge}`);
    if (formData.obgyne.padsPerDay) noteParts.push(`Pads/day: ${formData.obgyne.padsPerDay}`);
    inputs.obgynHistory = {
      lastMenstrualPeriod: lmpDate,
      hasDysmenorrhea: formData.obgyne.dysmenorrhea === 'Yes',
      notes: noteParts.length ? noteParts.join('; ') : null,
    };
  }

  return inputs;
};

// ─── Batch mutation sender ────────────────────────────────────────────────────

const sendBatchedCreateMutations = async (inputs: Record<string, any>, formData: FormData) => {
  const mutationParts: string[] = [];
  const variableDefs: string[] = [];
  const variables: Record<string, any> = {};

  const addMutation = (alias: string, mutationName: string, inputType: string, inputKey: string, varName: string) => {
    variableDefs.push(`$${varName}: ${inputType}!`);
    mutationParts.push(`${alias}: ${mutationName}(input: $${varName}) { id }`);
    variables[varName] = inputs[inputKey];
  };

  if (inputs.studentProfile) addMutation('studentProfile', 'createStudentProfile', 'StudentProfileInput', 'studentProfile', 'studentInput');
  if (inputs.emergencyContact) addMutation('emergencyContact', 'createEmergencyContact', 'EmergencyContactInput', 'emergencyContact', 'emergencyInput');

  addMutation('medicalHistory', 'createMedicalHistory', 'MedicalHistoryInput', 'medicalHistory', 'medHistInput');
  addMutation('allergyProfile', 'createAllergyProfile', 'AllergyProfileInput', 'allergyProfile', 'allergyInput');
  addMutation('hospitalizationProfile', 'createHospitalizationProfile', 'HospitalizationProfileInput', 'hospitalizationProfile', 'hospInput');
  addMutation('operationProfile', 'createOperationProfile', 'OperationProfileInput', 'operationProfile', 'opInput');
  addMutation('medicationProfile', 'createMedicationProfile', 'MedicationProfileInput', 'medicationProfile', 'medInput');
  addMutation('immunizationProfile', 'createImmunizationProfile', 'ImmunizationProfileInput', 'immunizationProfile', 'immuInput');
  addMutation('lifestyle', 'createLifestyle', 'LifestyleInput', 'lifestyle', 'lifeInput');
  addMutation('visualAcuityProfile', 'createVisualAcuityProfile', 'VisualAcuityProfileInput', 'visualAcuityProfile', 'vaInput');
  addMutation('dentalHistory', 'createDentalHistory', 'DentalHistoryInput', 'dentalHistory', 'dentalHistInput');
  addMutation('dentalProcedureProfile', 'createDentalProcedureProfile', 'DentalProcedureProfileInput', 'dentalProcedureProfile', 'dentalProcInput');
  addMutation('oralApplianceProfile', 'createOralApplianceProfile', 'OralApplianceProfileInput', 'oralApplianceProfile', 'oralAppInput');
  addMutation('dentalPhotoRecord', 'createDentalPhotoRecord', 'DentalPhotoRecordInput', 'dentalPhotoRecord', 'dentalPhotoInput');

  if (inputs.obgynHistory) addMutation('obgynHistory', 'createObgynHistory', 'ObgynHistoryInput', 'obgynHistory', 'obgynInput');

  mutationParts.push('submitTicket: submitUpdateTicket');

  const mutation = `mutation BatchCreateInitialRecords(${variableDefs.join(', ')}) {\n  ${mutationParts.join('\n  ')}\n}`;
  return sendGraphQLRequest(mutation, variables);
};

// ─── Main submission functions ─────────────────────────────────────────────────

export const createInitialMedicalRecord = async (formData: FormData, { isRevision = false, scope = 'Both' as string } = {}) => {
  let ticketCreated = false;
  let profileLogCreated = false;
  let upperTeethFileId: string | null = null;
  let lowerTeethFileId: string | null = null;

  try {
    const results: Record<string, any> = {};

    // Phase 1: Profile setup
    await registerProfileSetup(formData.personalInfo?.studentNumber, formData.personalInfo, isRevision);
    profileLogCreated = !isRevision;

    // Phase 2: Ticket + photos (parallel)
    let ticketPromise: Promise<string>;
    if (isRevision) {
      const existing = await fetchCurrentUpdateTicket();
      ticketPromise = existing?.status === 'Revision'
        ? Promise.resolve(existing.id)
        : createUpdateTicket(scope);
    } else {
      ticketPromise = createUpdateTicket(scope);
    }

    const [ticketResult, upperResult, lowerResult] = await Promise.allSettled([
      ticketPromise,
      uploadMediaFile(formData.dentalHistory?.upperTeethPhoto ?? null),
      uploadMediaFile(formData.dentalHistory?.lowerTeethPhoto ?? null),
    ]);

    if (ticketResult.status === 'fulfilled') {
      if (!isRevision) ticketCreated = true;
      results.ticketId = ticketResult.value;
    }
    upperTeethFileId = upperResult.status === 'fulfilled' ? upperResult.value : null;
    lowerTeethFileId = lowerResult.status === 'fulfilled' ? lowerResult.value : null;

    const parallelError = [ticketResult, upperResult, lowerResult].find(r => r.status === 'rejected');
    if (parallelError && parallelError.status === 'rejected') throw parallelError.reason;

    // Phase 3: Batch mutations
    const allCatalogs = await fetchAllCatalogs();
    const inputs = buildBatchInputs(formData, { upperTeethFileId, lowerTeethFileId }, allCatalogs);
    const batchResult = await sendBatchedCreateMutations(inputs, formData);
    Object.assign(results, batchResult);
    return { success: true, data: results };

  } catch (error) {
    // Cleanup
    if (upperTeethFileId || lowerTeethFileId) {
      await Promise.all([unstageMediaFile(upperTeethFileId), unstageMediaFile(lowerTeethFileId)]);
    }
    if (ticketCreated) await cancelUpdateTicket();
    if (profileLogCreated) await cancelPersonalRecordLog();
    throw error;
  }
};

// ─── Update record submission (for validated users) ───────────────────────────

/**
 * Submit an update record for a validated user.
 * Unlike createInitialMedicalRecord, this does NOT call registerProfileSetup
 * and only sends mutations relevant to the selected scope.
 * Mirrors mds-patient's submitUpdateRecord flow.
 */
export const submitUpdateRecord = async (
  formData: FormData,
  recordType: 'medical' | 'dental' | 'both',
) => {
  let ticketCreated = false;
  let upperTeethFileId: string | null = null;
  let lowerTeethFileId: string | null = null;

  try {
    // Step 1: Check for existing ticket
    const existingTicket = await fetchCurrentUpdateTicket();

    let ticketId: string;
    if (existingTicket?.status === 'Revision') {
      // Reuse existing Revision ticket (staff requested corrections)
      ticketId = existingTicket.id;
    } else {
      // Cancel any active ticket, then create new one with scope
      if (existingTicket) {
        const finalStatuses = ['Approved', 'Cancelled', 'Rejected', 'Expired'];
        if (!finalStatuses.includes(existingTicket.status)) {
          await cancelUpdateTicket();
        }
      }
      const scope = recordType === 'medical' ? 'Medical' : recordType === 'dental' ? 'Dental' : 'Both';
      ticketId = await createUpdateTicket(scope);
      ticketCreated = true;
    }

    // Step 2: Build all inputs
    const allCatalogs = await fetchAllCatalogs();

    // Upload dental photos before building inputs (need photo IDs for dentalPhotoRecord)
    const showDental = recordType === 'dental' || recordType === 'both';
    if (showDental) {
      const upperPhoto = formData.dentalHistory?.upperTeethPhoto;
      const lowerPhoto = formData.dentalHistory?.lowerTeethPhoto;

      if (upperPhoto?.uri && !upperPhoto?.id) {
        upperTeethFileId = await uploadMediaFile(upperPhoto);
      } else if (upperPhoto?.id) {
        upperTeethFileId = upperPhoto.id;
      }

      if (lowerPhoto?.uri && !lowerPhoto?.id) {
        lowerTeethFileId = await uploadMediaFile(lowerPhoto);
      } else if (lowerPhoto?.id) {
        lowerTeethFileId = lowerPhoto.id;
      }
    }

    const allInputs = buildBatchInputs(formData, { upperTeethFileId, lowerTeethFileId }, allCatalogs);

    // Step 3: Personal info — sequential like mds-patient
    if (allInputs.studentProfile) {
      await sendGraphQLRequest(
        `mutation CreateStudentProfile($input: StudentProfileInput!) { createStudentProfile(input: $input) { id } }`,
        { input: allInputs.studentProfile },
      );
    }
    if (allInputs.emergencyContact) {
      await sendGraphQLRequest(
        `mutation CreateEmergencyContact($input: EmergencyContactInput!) { createEmergencyContact(input: $input) { id } }`,
        { input: allInputs.emergencyContact },
      );
    }

    // Step 4: Medical mutations — sequential, only when scope includes medical
    if (recordType === 'medical' || recordType === 'both') {
      await sendGraphQLRequest(
        `mutation CreateMedicalHistory($input: MedicalHistoryInput!) { createMedicalHistory(input: $input) { id } }`,
        { input: allInputs.medicalHistory },
      );
      await sendGraphQLRequest(
        `mutation CreateAllergyProfile($input: AllergyProfileInput!) { createAllergyProfile(input: $input) { id } }`,
        { input: allInputs.allergyProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateHospitalizationProfile($input: HospitalizationProfileInput!) { createHospitalizationProfile(input: $input) { id } }`,
        { input: allInputs.hospitalizationProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateOperationProfile($input: OperationProfileInput!) { createOperationProfile(input: $input) { id } }`,
        { input: allInputs.operationProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateMedicationProfile($input: MedicationProfileInput!) { createMedicationProfile(input: $input) { id } }`,
        { input: allInputs.medicationProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateImmunizationProfile($input: ImmunizationProfileInput!) { createImmunizationProfile(input: $input) { id } }`,
        { input: allInputs.immunizationProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateLifestyle($input: LifestyleInput!) { createLifestyle(input: $input) { id } }`,
        { input: allInputs.lifestyle },
      );
      await sendGraphQLRequest(
        `mutation CreateVisualAcuityProfile($input: VisualAcuityProfileInput!) { createVisualAcuityProfile(input: $input) { id } }`,
        { input: allInputs.visualAcuityProfile },
      );
      if (allInputs.obgynHistory) {
        await sendGraphQLRequest(
          `mutation CreateObgynHistory($input: ObgynHistoryInput!) { createObgynHistory(input: $input) { id } }`,
          { input: allInputs.obgynHistory },
        );
      }
    }

    // Step 5: Dental mutations — sequential, only when scope includes dental
    if (showDental) {
      await sendGraphQLRequest(
        `mutation CreateDentalHistory($input: DentalHistoryInput!) { createDentalHistory(input: $input) { id } }`,
        { input: allInputs.dentalHistory },
      );
      await sendGraphQLRequest(
        `mutation CreateDentalProcedureProfile($input: DentalProcedureProfileInput!) { createDentalProcedureProfile(input: $input) { id } }`,
        { input: allInputs.dentalProcedureProfile },
      );
      await sendGraphQLRequest(
        `mutation CreateOralApplianceProfile($input: OralApplianceProfileInput!) { createOralApplianceProfile(input: $input) { id } }`,
        { input: allInputs.oralApplianceProfile },
      );
      if (allInputs.dentalPhotoRecord) {
        await sendGraphQLRequest(
          `mutation CreateDentalPhotoRecord($input: DentalPhotoRecordInput!) { createDentalPhotoRecord(input: $input) { id } }`,
          { input: allInputs.dentalPhotoRecord },
        );
      }
    }

    // Step 6: Submit the ticket for review — separate call like mds-patient
    await submitUpdateTicket();

    return { success: true, data: { ticketId } };
  } catch (error) {
    if (upperTeethFileId || lowerTeethFileId) {
      await Promise.all([unstageMediaFile(upperTeethFileId), unstageMediaFile(lowerTeethFileId)]);
    }
    if (ticketCreated) await cancelUpdateTicket();
    throw error;
  }
};

/**
 * Send only the mutations relevant to the selected scope, then submit the ticket.
 */
const sendScopedUpdateMutations = async (
  inputs: Record<string, any>,
  formData: FormData,
  recordType: 'medical' | 'dental' | 'both',
) => {
  const mutationParts: string[] = [];
  const variableDefs: string[] = [];
  const variables: Record<string, any> = {};

  const addMutation = (alias: string, mutationName: string, inputType: string, inputKey: string, varName: string) => {
    if (!inputs[inputKey]) return;
    variableDefs.push(`$${varName}: ${inputType}!`);
    mutationParts.push(`${alias}: ${mutationName}(input: $${varName}) { id }`);
    variables[varName] = inputs[inputKey];
  };

  // Personal info (profile + emergency contact) — always included
  if (inputs.studentProfile) addMutation('studentProfile', 'createStudentProfile', 'StudentProfileInput', 'studentProfile', 'studentInput');
  if (inputs.emergencyContact) addMutation('emergencyContact', 'createEmergencyContact', 'EmergencyContactInput', 'emergencyContact', 'emergencyInput');

  // Medical mutations — only for medical or both
  if (recordType === 'medical' || recordType === 'both') {
    addMutation('medicalHistory', 'createMedicalHistory', 'MedicalHistoryInput', 'medicalHistory', 'medHistInput');
    addMutation('allergyProfile', 'createAllergyProfile', 'AllergyProfileInput', 'allergyProfile', 'allergyInput');
    addMutation('hospitalizationProfile', 'createHospitalizationProfile', 'HospitalizationProfileInput', 'hospitalizationProfile', 'hospInput');
    addMutation('operationProfile', 'createOperationProfile', 'OperationProfileInput', 'operationProfile', 'opInput');
    addMutation('medicationProfile', 'createMedicationProfile', 'MedicationProfileInput', 'medicationProfile', 'medInput');
    addMutation('immunizationProfile', 'createImmunizationProfile', 'ImmunizationProfileInput', 'immunizationProfile', 'immuInput');
    addMutation('lifestyle', 'createLifestyle', 'LifestyleInput', 'lifestyle', 'lifeInput');
    addMutation('visualAcuityProfile', 'createVisualAcuityProfile', 'VisualAcuityProfileInput', 'visualAcuityProfile', 'vaInput');
    if (inputs.obgynHistory) addMutation('obgynHistory', 'createObgynHistory', 'ObgynHistoryInput', 'obgynHistory', 'obgynInput');
  }

  // Dental mutations — only for dental or both
  if (recordType === 'dental' || recordType === 'both') {
    addMutation('dentalHistory', 'createDentalHistory', 'DentalHistoryInput', 'dentalHistory', 'dentalHistInput');
    addMutation('dentalProcedureProfile', 'createDentalProcedureProfile', 'DentalProcedureProfileInput', 'dentalProcedureProfile', 'dentalProcInput');
    addMutation('oralApplianceProfile', 'createOralApplianceProfile', 'OralApplianceProfileInput', 'oralApplianceProfile', 'oralAppInput');
    addMutation('dentalPhotoRecord', 'createDentalPhotoRecord', 'DentalPhotoRecordInput', 'dentalPhotoRecord', 'dentalPhotoInput');
  }

  // Always submit the ticket at the end
  mutationParts.push('submitTicket: submitUpdateTicket');

  const mutation = `mutation BatchUpdateRecords(${variableDefs.join(', ')}) {\n  ${mutationParts.join('\n  ')}\n}`;
  return sendGraphQLRequest(mutation, variables);
};

// ─── Catalog fetcher ──────────────────────────────────────────────────────────

export const fetchAllCatalogs = async (): Promise<AllCatalogs> => {
  const query = `
    query FetchAllCatalogs {
      medicalConditionCatalog: getDomainCatalogs(domain: MedicalCondition, filterIsValid: true) { id code name }
      hospitalizationCatalog: getDomainCatalogs(domain: Hospitalization, filterIsValid: true) { id code name }
      operationCatalog: getDomainCatalogs(domain: Operation, filterIsValid: true) { id code name }
      medicationCatalog: getDomainCatalogs(domain: Medication, filterIsValid: true) { id code name }
      immunizationCatalog: getDomainCatalogs(domain: Immunization, filterIsValid: true) { id code name }
      allergenCatalog: getAllergenCatalogs(filterIsValid: true) { id allergen type }
      oralApplianceCatalog: getOralApplianceCatalogs(filterIsValid: true) { id name description }
      visualAcuityCatalog: getDomainCatalogs(domain: VisualAcuity, filterIsValid: true) { id code name }
      dentalProcedureCatalog: getDomainCatalogs(domain: DentalProcedure, filterIsValid: true) { id code name }
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {});
    return {
      medicalConditionCatalog: data.medicalConditionCatalog || [],
      hospitalizationCatalog: data.hospitalizationCatalog || [],
      operationCatalog: data.operationCatalog || [],
      medicationCatalog: data.medicationCatalog || [],
      immunizationCatalog: data.immunizationCatalog || [],
      allergenCatalog: data.allergenCatalog || [],
      oralApplianceCatalog: data.oralApplianceCatalog || [],
      visualAcuityCatalog: data.visualAcuityCatalog || [],
      dentalProcedureCatalog: data.dentalProcedureCatalog || [],
    };
  } catch {
    return {
      medicalConditionCatalog: [], hospitalizationCatalog: [], operationCatalog: [],
      medicationCatalog: [], immunizationCatalog: [], allergenCatalog: [],
      oralApplianceCatalog: [], visualAcuityCatalog: [], dentalProcedureCatalog: [],
    };
  }
};

// ─── Status checking ──────────────────────────────────────────────────────────

export const checkInitialRecordStatus = async (): Promise<RecordStatus> => {
  const [credentialResult, ticketResult] = await Promise.allSettled([
    sendGraphQLRequest(
      `query GetCredentialStatus { getCredentialStatus }`, {},
      { endpoint: '/profile/patient' }
    ),
    sendGraphQLRequest(
      `query GetUpdateTicket { getUpdateTicket { id status notes } }`, {}
    ),
  ]);

  const credentialStatus = credentialResult.status === 'fulfilled'
    ? credentialResult.value?.getCredentialStatus : null;
  const ticket = ticketResult.status === 'fulfilled'
    ? ticketResult.value?.getUpdateTicket : null;

  if (credentialStatus === 'Unverified') {
    return {
      needsInitialRecord: true,
      status: ticket?.status || null,
      ticketId: ticket?.id ?? null,
      notes: ticket?.notes ?? null,
    };
  }

  if (credentialStatus && credentialStatus !== 'Unverified') {
    return {
      needsInitialRecord: false,
      status: ticket?.status ?? null,
      ticketId: ticket?.id ?? null,
      notes: ticket?.notes ?? null,
    };
  }

  // Fallback
  if (!ticket) return { needsInitialRecord: true, status: null };

  const completedStatuses = ['Pending', 'Approved', 'RevisionSubmitted'];
  return {
    needsInitialRecord: !completedStatuses.includes(ticket.status),
    status: ticket.status,
    ticketId: ticket.id,
    notes: ticket.notes ?? null,
  };
};

// ─── Revision pre-fill ────────────────────────────────────────────────────────

const reverseMapDentalCleaningRange = (v: string): string => {
  const m: Record<string, string> = { '0-6': '0 to 6 months ago', '7-12': '7 to 11 months ago', '12-24': '1 year or more' };
  return m[v] || '';
};

const reverseMapYearLevel = (v: string): string => {
  const m: Record<string, string> = { 'Freshman': 'Freshmen', 'Sophomore': 'Transferee', 'Junior': 'Old Student', 'Senior': 'Old Student', 'Masteral': 'Graduate studies (New student)' };
  return m[v] || '';
};

export const fetchRevisionPrefill = async (): Promise<FormData | null> => {
  const [profileResult, emrResult] = await Promise.allSettled([
    sendGraphQLRequest(
      `query GetRevisionPersonalData {
        personalLog: getPersonalRecordLog {
          first_name middle_name last_name suffix
          date_of_birth sex civil_status nationality religion
          contactNumber present_address province_address
        }
        branchId: getPersonalRecord {
          branch
          identifier
        }
      }`, {}, { endpoint: '/profile/patient' }
    ),
    sendGraphQLRequest(
      `query GetRevisionEMRData {
        emrProfile: getProfile { ... on StudentProfile { program year } ... on EmployeeProfile { department role } }
        emergencyContact: getEmergencyContact {
          firstContact { contactName relationship contactNumber address }
          secondContact { contactName relationship contactNumber address }
        }
        medicalHistory: getMedicalHistory { conditions { conditionId relationship } notes }
        allergyProfile: getAllergyProfile { allergies { allergenCatalogId status severity } notes }
        hospitalizationProfile: getHospitalizationProfile { hospitalizations { conditionId admissionDate dischargeDate notes } notes }
        operationProfile: getOperationProfile { operations { procedureId operationDate notes } notes }
        medicationProfile: getMedicationProfile { medications { medicineId description } notes }
        immunizationProfile: getImmunizationProfile { immunizations { vaccineTypeId immunizationDate } notes }
        lifestyle: getLifestyle { smoker numberOfCigarettesPerDay yearsSmoked alcoholConsumer frequencyOfAlcoholConsumption vapeUser vapeType vapeFrequency }
        visualAcuity: getVisualAcuityProfile { notes acuity { left_eye right_eye recorded_at } }
        dentalHistory: getDentalHistory { seenByDentist lastDentalCleaning lastVisitDate }
        dentalProcedureProfile: getDentalProcedureProfile { procedures { procedureTypeId } }
        dentalPhotoRecord: getDentalPhotoRecord { upperTeeth lowerTeeth }
        oralAppliance: getOralApplianceProfile { appliances { tagId arch } }
        obgyne: getObgynHistory { lastMenstrualPeriod hasDysmenorrhea notes }
      }`, {}
    ),
  ]);

  const profileData = profileResult.status === 'fulfilled' ? profileResult.value : {};
  const emrData = emrResult.status === 'fulfilled' ? emrResult.value : {};

  if (!(profileData as any)?.personalLog && Object.keys(emrData).length === 0) return null;

  const pr = (profileData as any)?.personalLog || {};
  const bid = (profileData as any)?.branchId;
  const emr = emrData as any;

  const rawProgram = emr?.emrProfile?.program || '';
  const ec = emr?.emergencyContact || {};

  const base = createEmptyFormData();

  base.personalInfo = {
    ...base.personalInfo,
    firstName: pr.first_name || '', surname: pr.last_name || '', middleName: pr.middle_name || '',
    suffix: pr.suffix || '',
    birthday: pr.date_of_birth ? new Date(pr.date_of_birth).toISOString().split('T')[0] : '',
    gender: pr.sex || '', civilStatus: pr.civil_status || '',
    nationality: pr.nationality || '', religion: pr.religion || '',
    address: pr.present_address || '', provinceAddress: pr.province_address || '',
    contactNumber: pr.contactNumber || '', studentNumber: bid?.identifier || '',
    program: rawProgram || '', studentCategory: reverseMapYearLevel(emr?.emrProfile?.year || ''),
    emergencyContacts: [
      { name: ec.firstContact?.contactName || '', relationship: ec.firstContact?.relationship || '', contactNumber: ec.firstContact?.contactNumber || '', address: ec.firstContact?.address || '' },
      { name: ec.secondContact?.contactName || '', relationship: ec.secondContact?.relationship || '', contactNumber: ec.secondContact?.contactNumber || '', address: ec.secondContact?.address || '' },
    ],
  };

  // Medical history
  const conditions = emr?.medicalHistory?.conditions || [];
  for (const c of conditions) {
    if (!c.conditionId) continue;
    if (!c.relationship) base.medicalHistory.self[c.conditionId] = true;
    else { base.medicalHistory.family[c.conditionId] = true; base.medicalHistory.familyWhoHasIt[c.conditionId] = c.relationship; }
  }

  // Medical background
  const allergies = emr?.allergyProfile?.allergies || [];
  const hosps = emr?.hospitalizationProfile?.hospitalizations || [];
  const ops = emr?.operationProfile?.operations || [];
  const meds = emr?.medicationProfile?.medications || [];
  const immuns = emr?.immunizationProfile?.immunizations || [];
  const ls = emr?.lifestyle || {};

  base.medicalBackground.hasAllergies = allergies.length > 0 ? 'Yes' : 'No';
  for (const a of allergies) base.medicalBackground.allergies[a.allergenCatalogId] = { checked: true, severity: a.severity || 'Unknown', status: a.status || 'Active' };
  base.medicalBackground.hasHospitalization = hosps.length > 0 ? 'Yes' : 'No';
  for (const h of hosps) base.medicalBackground.hospitalizationConditions[h.conditionId] = true;
  base.medicalBackground.hasOperation = ops.length > 0 ? 'Yes' : 'No';
  for (const o of ops) base.medicalBackground.operationConditions[o.procedureId] = true;
  base.medicalBackground.hasMedications = meds.length > 0 ? 'Yes' : 'No';
  for (const m of meds) base.medicalBackground.selectedMedications[m.medicineId] = true;
  for (const i of immuns) base.medicalBackground.immunizations[i.vaccineTypeId] = true;
  base.medicalBackground.smoker = ls.smoker ? 'yes' : 'no';
  base.medicalBackground.smokerSticksPerDay = ls.numberOfCigarettesPerDay?.toString() || '';
  base.medicalBackground.smokerYears = ls.yearsSmoked?.toString() || '';
  base.medicalBackground.alcoholDrinker = ls.alcoholConsumer ? 'yes' : 'no';
  base.medicalBackground.alcoholFrequency = ls.frequencyOfAlcoholConsumption || '';

  // Visual acuity
  const va = emr?.visualAcuity;
  if (va?.acuity) {
    // Parse eyeglasses/contactLenses from the stored notes ("Eyeglasses: Yes, Contact Lenses: No")
    const vaNotes = (va.notes || '').toLowerCase();
    base.medicalBackground.eyeglasses = vaNotes.includes('eyeglasses: yes');
    base.medicalBackground.contactLenses = vaNotes.includes('contact lenses: yes');
    // Fallback: if no parseable notes but acuity data exists, assume eyeglasses
    if (!vaNotes && va.acuity) base.medicalBackground.eyeglasses = true;
    base.medicalBackground.gradeOD = va.acuity.right_eye || '';
    base.medicalBackground.gradeOS = va.acuity.left_eye || '';
    base.medicalBackground.visualAcuityDate = va.acuity.recorded_at
      ? new Date(va.acuity.recorded_at).toISOString().split('T')[0] : '';
  }

  // Dental
  const dh = emr?.dentalHistory || {};
  const oaAppliances = emr?.oralAppliance?.appliances || [];
  const dentalProcs = emr?.dentalProcedureProfile?.procedures || [];
  base.dentalHistory.firstTimeDentist = dh.seenByDentist === true ? 'no' : dh.seenByDentist === false ? 'yes' : '';
  base.dentalHistory.lastDentalConsultation = dh.lastVisitDate ? String(dh.lastVisitDate).slice(0, 7) : '';
  base.dentalHistory.lastDentalCleaning = reverseMapDentalCleaningRange(dh.lastDentalCleaning || '');
  base.dentalHistory.hasIntraOralAppliance = oaAppliances.length > 0 ? 'yes' : 'no';
  for (const a of oaAppliances) base.dentalHistory.intraOralAppliances[a.tagId] = { checked: true, arch: a.arch || 'None', status: a.status || '', dateIssued: a.dateIssued || '' };
  for (const p of dentalProcs) base.dentalHistory.selectedDentalProcedures[p.procedureTypeId] = true;

  // Dental photos — preserve existing UUIDs so updates can reuse them
  const dpr = emr?.dentalPhotoRecord;
  if (dpr?.upperTeeth) {
    base.dentalHistory.upperTeethPhoto = {
      uri: '', name: 'Upper Teeth (from revision)', type: 'image/jpeg', id: dpr.upperTeeth,
    };
  }
  if (dpr?.lowerTeeth) {
    base.dentalHistory.lowerTeethPhoto = {
      uri: '', name: 'Lower Teeth (from revision)', type: 'image/jpeg', id: dpr.lowerTeeth,
    };
  }

  // OB-GYNE
  const obg = emr?.obgyne || {};
  if (base.obgyne) {
    base.obgyne.lastMenstrualPeriod = obg.lastMenstrualPeriod
      ? new Date(obg.lastMenstrualPeriod).toISOString().split('T')[0] : '';
    base.obgyne.dysmenorrhea = obg.hasDysmenorrhea ? 'Yes' : 'No';
  }

  return base;
};
