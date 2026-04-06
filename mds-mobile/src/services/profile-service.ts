/**
 * Profile Service - Patient profile data
 * Mirrors mds-patient/src/services/emr-service.js getPatientProfile()
 * Endpoints: /profile/patient, /emr/patient
 */

import { sendGraphQLRequest } from './graphql-client';

export interface PatientProfile {
  name: string | null;
  firstName: string | null;
  email: string | null;
  contactNumber: string | null;
  firstEmergencyContactNumber: string | null;
  secondEmergencyContactNumber: string | null;
  identifier: string | null;
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

  const latestEmergency =
    (emergencyData as any)?.emergencyContact ||
    (Array.isArray((emergencyData as any)?.emergencyContacts)
      ? (emergencyData as any).emergencyContacts[0]
      : null) ||
    null;

  const nameParts = [log.first_name, log.middle_name, log.last_name, log.suffix].filter(Boolean);

  _cacheTimestamp = Date.now();
  _cache = {
    name: nameParts.length > 0 ? nameParts.join(' ') : null,
    firstName: log.first_name || null,
    email: (profileData as any)?.loginEmail || null,
    contactNumber: log.contactNumber || null,
    firstEmergencyContactNumber: extractContactNumber(latestEmergency?.firstContact),
    secondEmergencyContactNumber: extractContactNumber(latestEmergency?.secondContact),
    identifier: (profileData as any)?.personalRecord?.identifier || null,
  };

  return _cache;
};

/** Clear profile cache (call on logout or data changes) */
export const clearProfileCache = (): void => {
  _cache = null;
  _cacheTimestamp = 0;
};
