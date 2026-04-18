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

const extractContactNumber = (contact: any): string | null => {
  if (!contact) return null;
  if (typeof contact === 'string') return contact;
  if (typeof contact?.contactNumber === 'string') return contact.contactNumber;
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

const inferIdentityFromEmrProfile = (emrProfile: any): PatientIdentity | null => {
  if (!emrProfile) return null;
  if (emrProfile.__typename === 'StudentProfile') return 'Student';
  if (emrProfile.__typename === 'EmployeeProfile') {
    const role = String(emrProfile.role || '').trim().toLowerCase();
    return role === 'superior' ? 'Superior' : 'Employee';
  }
  return null;
};

const extractDepartment = (emrProfile: any): string | null => {
  if (!emrProfile) return null;
  if (emrProfile.__typename === 'StudentProfile') {
    return emrProfile.program || null;
  }
  if (emrProfile.__typename === 'EmployeeProfile') {
    return emrProfile.department || null;
  }
  return null;
};

const shouldFetchEmrProfile = (status: unknown): boolean => {
  const normalized = String(status || '').trim();
  return normalized === 'InProgress' || normalized === 'Revision';
};

export const getPatientProfile = async (): Promise<PatientProfile> => {
  if (_cache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _cache;

  const [profileResult, emergencyResult] = await Promise.allSettled([
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

  const log = (profileData as any)?.personalLog || {};
  const email = (profileData as any)?.loginEmail || null;
  const personalLogStatus = (profileData as any)?.personalLogStatus;

  let emrProfile: any = null;
  if (shouldFetchEmrProfile(personalLogStatus)) {
    try {
      const emrProfileData = await sendGraphQLRequest(
        `query GetIdentityAndDepartment {
          emrProfile: getProfile {
            __typename
            ... on StudentProfile { program }
            ... on EmployeeProfile { department role }
          }
        }`,
        {},
        { allowPartialData: true },
      );
      emrProfile = (emrProfileData as any)?.emrProfile || null;
    } catch {
      // Ignore EMR profile fetch failures for profile card rendering.
    }
  }

  const latestEmergency =
    (emergencyData as any)?.emergencyContact ||
    (Array.isArray((emergencyData as any)?.emergencyContacts)
      ? (emergencyData as any).emergencyContacts[0]
      : null) ||
    null;

  const nameParts = [log.first_name, log.middle_name, log.last_name, log.suffix].filter(Boolean);
  const emailIdentity = inferIdentityFromEmail(email);
  const emrIdentity = inferIdentityFromEmrProfile(emrProfile);
  const identity = emailIdentity === 'Superior' ? 'Superior' : (emrIdentity || emailIdentity);

  _cacheTimestamp = Date.now();
  _cache = {
    name: nameParts.length > 0 ? nameParts.join(' ') : null,
    firstName: log.first_name || null,
    email,
    contactNumber: log.contactNumber || null,
    firstEmergencyContactNumber: extractContactNumber(latestEmergency?.firstContact),
    secondEmergencyContactNumber: extractContactNumber(latestEmergency?.secondContact),
    identifier: (profileData as any)?.personalRecord?.identifier || null,
    identity,
    department: extractDepartment(emrProfile),
  };

  return _cache;
};

/** Clear profile cache (call on logout or data changes) */
export const clearProfileCache = (): void => {
  _cache = null;
  _cacheTimestamp = 0;
};
