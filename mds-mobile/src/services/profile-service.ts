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
  const identity =
    emailIdentity === 'Superior'
      ? 'Superior'
      : emailIdentity;

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
  };

  return _cache;
};

/** Clear profile cache (call on logout or data changes) */
export const clearProfileCache = (): void => {
  _cache = null;
  _cacheTimestamp = 0;
};
