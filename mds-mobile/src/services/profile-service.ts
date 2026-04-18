/**
 * Profile Service - Patient profile data
 * Mirrors mds-patient/src/services/emr-service.js getPatientProfile()
 * Endpoints: /profile/patient, /emr/patient
 */

import { sendGraphQLRequest } from './graphql-client';

export type PatientIdentity = 'Student' | 'Employee' | 'Superior';

export interface PatientProfile {
  name: string | null;
  firstName: string | null;
  email: string | null;
  contactNumber: string | null;
  firstEmergencyContactNumber: string | null;
  secondEmergencyContactNumber: string | null;
  identifier: string | null;
  identity: PatientIdentity | null;
  department: string | null;
}

let _cache: PatientProfile | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const sanitizeDisplayValue = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  const lowered = normalized.toLowerCase();

  if (
    !normalized ||
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === '--' ||
    lowered === '—' ||
    lowered === 'n/a' ||
    lowered === 'na'
  ) {
    return null;
  }

  return normalized;
};

const extractContactNumber = (contact: any): string | null => {
  if (!contact) return null;
  if (typeof contact === 'string') return sanitizeDisplayValue(contact);
  if (typeof contact?.contactNumber === 'string') return sanitizeDisplayValue(contact.contactNumber);
  return null;
};

const STUDENT_EMAIL_REGEX = /^[mq][a-z]+[0-9]*@tip\.edu\.ph$/;
const EMPLOYEE_EMAIL_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+@tip\.edu\.ph$/;
const SUPERIOR_EMAIL_REGEX = /^[a-z][a-z0-9]*(\.([a-z][a-z0-9]*))*\.superior@tip\.edu\.ph$/;

const inferIdentityFromEmail = (email: string | null | undefined): PatientIdentity | null => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (SUPERIOR_EMAIL_REGEX.test(normalized)) return 'Superior';
  if (STUDENT_EMAIL_REGEX.test(normalized)) return 'Student';
  if (EMPLOYEE_EMAIL_REGEX.test(normalized)) return 'Employee';
  return null;
};

const normalizeIdentity = (value: unknown): PatientIdentity | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'student') return 'Student';
  if (normalized === 'employee') return 'Employee';
  if (normalized === 'superior') return 'Superior';
  return null;
};

const inferIdentityFromActiveProfile = (activeProfile: any): PatientIdentity | null => {
  const typeName = String(activeProfile?.__typename || '').trim().toLowerCase();
  if (typeName === 'studentprofile') return 'Student';
  if (typeName === 'employeeprofile') return 'Employee';
  return null;
};

const inferIdentityFromBasicInfo = (basicInfo: any): PatientIdentity | null => {
  if (!basicInfo) return null;

  const profileIdentity = normalizeIdentity(basicInfo.profile_type);
  if (profileIdentity) return profileIdentity;

  const roleIdentity = normalizeIdentity(basicInfo.role);
  if (roleIdentity) return roleIdentity;

  return null;
};

const extractDepartment = (
  basicInfo: any,
  activeProfile: any,
  identity: PatientIdentity | null,
): string | null => {
  const basicProgram = sanitizeDisplayValue(basicInfo?.program);
  const basicDepartment = sanitizeDisplayValue(basicInfo?.department);
  const activeProgram = sanitizeDisplayValue(activeProfile?.program);
  const activeDepartment = sanitizeDisplayValue(activeProfile?.department);

  if (identity === 'Student') {
    return basicProgram || activeProgram || basicDepartment || activeDepartment || null;
  }

  if (identity === 'Employee' || identity === 'Superior') {
    return basicDepartment || activeDepartment || basicProgram || activeProgram || null;
  }

  return basicProgram || basicDepartment || activeProgram || activeDepartment || null;
};

const fetchPatientBasicInfo = async (): Promise<any> => {
  const queryWithUserId = `query GetIdentityAndDepartment {
    basicInfo: getPatientBasicInfo(userId: "self") {
      profile_type
      program
      department
      role
    }
  }`;

  try {
    return await sendGraphQLRequest(queryWithUserId, {}, { allowPartialData: true });
  } catch (error: any) {
    const errorMessage = String(error?.message || '').toLowerCase();
    const canRetryWithoutArgs =
      errorMessage.includes('unknown argument') ||
      errorMessage.includes('required argument') ||
      errorMessage.includes('argument "userid"') ||
      errorMessage.includes('field "getpatientbasicinfo" argument "userid"');

    if (!canRetryWithoutArgs) {
      throw error;
    }
  }

  const queryWithoutUserId = `query GetIdentityAndDepartmentNoArgs {
    basicInfo: getPatientBasicInfo {
      profile_type
      program
      department
      role
    }
  }`;

  return sendGraphQLRequest(queryWithoutUserId, {}, { allowPartialData: true });
};

export const getPatientProfile = async (): Promise<PatientProfile> => {
  if (_cache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _cache;

  const [profileResult, emergencyResult, basicInfoResult, activeProfileResult] = await Promise.allSettled([
    sendGraphQLRequest(
      `query GetPatientProfileData {
        personalLog: getPersonalRecordLog {
          id first_name middle_name last_name suffix contactNumber
        }
        personalRecord: getPersonalRecord { id identifier }
        personalLogStatus: getPersonalRecordLogStatus
        loginEmail: getLoginEmail
      }`,
      {},
      { endpoint: '/profile/patient' },
    ),
    sendGraphQLRequest(
      `query GetEmergencyContact {
        emergencyContact: getEmergencyContact(approved: true) {
          firstContact { contactNumber }
          secondContact { contactNumber }
        }
      }`,
      {},
    ),
    fetchPatientBasicInfo(),
    sendGraphQLRequest(
      `query GetActiveProfileFallback {
        activeProfile: getProfile {
          __typename
          ... on StudentProfile {
            program
          }
          ... on EmployeeProfile {
            department
          }
        }
      }`,
      {},
      { allowPartialData: true },
    ),
  ]);

  const profileData =
    profileResult.status === 'fulfilled'
      ? profileResult.value
      : ((profileResult as PromiseRejectedResult).reason?.data || {});

  if (profileResult.status === 'rejected') {
    console.warn('[Profile Service] Could not fetch patient profile data:', (profileResult as PromiseRejectedResult).reason?.message);
  }

  const emergencyData =
    emergencyResult.status === 'fulfilled'
      ? emergencyResult.value
      : null;

  if (emergencyResult.status === 'rejected') {
    console.warn('[Profile Service] Active emergency contact fetch failed:', (emergencyResult as PromiseRejectedResult).reason?.message);
  }

  const basicInfoData =
    basicInfoResult.status === 'fulfilled'
      ? basicInfoResult.value
      : ((basicInfoResult as PromiseRejectedResult).reason?.data || null);

  if (basicInfoResult.status === 'rejected') {
    console.warn('[Profile Service] Profile basic info fetch failed:', (basicInfoResult as PromiseRejectedResult).reason?.message);
  }

  const activeProfileData =
    activeProfileResult.status === 'fulfilled'
      ? activeProfileResult.value
      : ((activeProfileResult as PromiseRejectedResult).reason?.data || null);

  if (activeProfileResult.status === 'rejected') {
    console.warn('[Profile Service] Active profile fallback fetch failed:', (activeProfileResult as PromiseRejectedResult).reason?.message);
  }

  const log = (profileData as any)?.personalLog || {};
  const email = (profileData as any)?.loginEmail || null;
  const basicInfo = (basicInfoData as any)?.basicInfo || null;
  const activeProfile = (activeProfileData as any)?.activeProfile || null;

  const latestEmergency =
    (emergencyData as any)?.emergencyContact ||
    (Array.isArray((emergencyData as any)?.emergencyContacts)
      ? (emergencyData as any).emergencyContacts[0]
      : null) ||
    null;

  const nameParts = [
    sanitizeDisplayValue(log.first_name),
    sanitizeDisplayValue(log.middle_name),
    sanitizeDisplayValue(log.last_name),
    sanitizeDisplayValue(log.suffix),
  ].filter(Boolean) as string[];
  const emailIdentity = inferIdentityFromEmail(sanitizeDisplayValue(email));
  const profileIdentity = inferIdentityFromBasicInfo(basicInfo);
  const activeProfileIdentity = inferIdentityFromActiveProfile(activeProfile);
  const identity =
    emailIdentity === 'Superior'
      ? 'Superior'
      : (profileIdentity || activeProfileIdentity || emailIdentity);

  _cacheTimestamp = Date.now();
  _cache = {
    name: nameParts.length > 0 ? nameParts.join(' ') : null,
    firstName: sanitizeDisplayValue(log.first_name),
    email: sanitizeDisplayValue(email),
    contactNumber: sanitizeDisplayValue(log.contactNumber),
    firstEmergencyContactNumber: extractContactNumber(latestEmergency?.firstContact),
    secondEmergencyContactNumber: extractContactNumber(latestEmergency?.secondContact),
    identifier: sanitizeDisplayValue((profileData as any)?.personalRecord?.identifier),
    identity,
    department: extractDepartment(basicInfo, activeProfile, identity),
  };

  return _cache;
};

/** Clear profile cache (call on logout or data changes) */
export const clearProfileCache = (): void => {
  _cache = null;
  _cacheTimestamp = 0;
};
