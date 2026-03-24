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

  const profileData = await sendGraphQLRequest(
    `query GetPatientProfileData {
      personalLog: getPersonalRecordLog {
        id first_name middle_name last_name suffix contactNumber
      }
      personalRecord: getPersonalRecord { id }
      personalLogStatus: getPersonalRecordLogStatus
      loginEmail: getLoginEmail
      branchId: getBranchIdentifier { identifier }
    }`,
    {},
    { endpoint: '/profile/patient' },
  ).catch(() => ({}));

  const log = (profileData as any)?.personalLog || {};
  const activeStatuses = new Set(['InProgress', 'Pending', 'Revision', 'Approved']);
  const hasActiveProfile = activeStatuses.has((profileData as any)?.personalLogStatus);

  let emergencyData: any = null;

  if (hasActiveProfile) {
    emergencyData = await sendGraphQLRequest(
      `query GetEmergencyContact {
        emergencyContact: getEmergencyContact {
          firstContact { contactNumber }
          secondContact { contactNumber }
        }
      }`,
      {},
    ).catch(() => null);
  }

  if (!emergencyData) {
    const userId = (profileData as any)?.personalRecord?.id || log.id || null;
    if (userId) {
      emergencyData = await sendGraphQLRequest(
        `query GetLatestEmergencyContact($userId: ID!, $offset: Int, $limit: Int) {
          emergencyContacts: getUserEmergencyContact(userId: $userId, offset: $offset, limit: $limit) {
            firstContact { contactNumber }
            secondContact { contactNumber }
          }
        }`,
        { userId, offset: 0, limit: 1 },
      ).catch(() => null);
    }
  }

  const latestEmergency =
    emergencyData?.emergencyContact ||
    (Array.isArray(emergencyData?.emergencyContacts)
      ? emergencyData.emergencyContacts[0]
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
    identifier: (profileData as any)?.branchId?.identifier || null,
  };

  return _cache;
};

/** Clear profile cache (call on logout or data changes) */
export const clearProfileCache = (): void => {
  _cache = null;
  _cacheTimestamp = 0;
};
