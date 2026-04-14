/**
 * Patient Appointment Service for React Native
 * Mirrors mds-patient/src/modules/appointment/patient-appointment-service.js
 */

import { sendGraphQLRequest } from './graphql-client';
import { axiosRequest } from '../core';

export const STATUS = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'InProgress',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  COMPLETED: 'Completed',
  NO_SHOW: 'NoShow',
  CANCELLED_PATIENT: 'CancelledByPatient',
  CANCELLED_MEDICAL: 'CancelledByMedical',
};

export const SESSION = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
};

export const ACTIVE_STATUSES = [STATUS.PENDING, STATUS.SCHEDULED, STATUS.IN_PROGRESS];

const sendGraphQL = async (query: string, variables: Record<string, any> = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: '/appointment/patient' });
};

export const getAppointmentStatus = async () => {
  const data = await sendGraphQL(`
    query {
      getAppointmentStatus {
        id
        status
        session
        notes
        created_at
        schedulerLabel
      }
    }
  `);
  return data.getAppointmentStatus;
};

export const listOpenAppointments = async (offset = 0, limit = 20) => {
  const data = await sendGraphQL(`
    query ListOpenAppointments($offset: Int, $limit: Int) {
      listOpenAppointments(offset: $offset, limit: $limit) {
        id label location patientType schedulePerWeek
        morningAllowed afternoonAllowed notes
        purposeRequired
        isActive containsCustomDates whitelistOnly
      }
    }
  `, { offset, limit });
  return data.listOpenAppointments;
};

export const listRequirements = async (schedulerId: string, offset = 0, limit = 50) => {
  const data = await sendGraphQL(`
    query ListAppointmentRequirements($schedulerId: ID!, $offset: Int, $limit: Int) {
      listAppointmentRequirements(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id slotId label notes isDigital isActive
      }
    }
  `, { schedulerId, offset, limit });
  return data.listAppointmentRequirements;
};

export const listCustomDates = async (schedulerId: string, offset = 0, limit = 100) => {
  const data = await sendGraphQL(`
    query ListCustomDates($schedulerId: ID!, $offset: Int, $limit: Int) {
      listCustomDates(schedulerId: $schedulerId, offset: $offset, limit: $limit) {
        id
        scheduledDate
        type
        morningAllowed
        afternoonAllowed
      }
    }
  `, { schedulerId, offset, limit });
  return data.listCustomDates;
};

export const getScheduleAvailability = async (schedulerId: string, date: string) => {
  const data = await sendGraphQL(`
    query ListAppointmentSchedule($schedulerId: ID!, $date: Date!) {
      listAppointmentSchedule(schedulerId: $schedulerId, date: $date) {
        id slotId morningAllowed morningRegistered morningPending
        afternoonAllowed afternoonRegistered afternoonPending
        allowDuring scheduledDate
      }
    }
  `, { schedulerId, date });
  return data.listAppointmentSchedule;
};

export const getMonthAvailability = async (schedulerId: string, startDate: string, endDate: string) => {
  const data = await sendGraphQL(`
    query ListMonthAvailability($schedulerId: ID!, $startDate: Date!, $endDate: Date!) {
      listMonthAvailability(schedulerId: $schedulerId, startDate: $startDate, endDate: $endDate) {
        id
        slotId
        morningAllowed
        morningRegistered
        morningPending
        afternoonAllowed
        afternoonRegistered
        afternoonPending
        scheduledDate
      }
    }
  `, { schedulerId, startDate, endDate });
  return data.listMonthAvailability;
};

export const submitAppointment = async (
  schedulerId: string,
  date: string,
  session: string,
  requirements: Array<{ scheduleRequirementId: string; filename: string }> = [],
  purpose?: string,
  purposeRequired = false
) => {
  const normalizedPurpose = (purpose || '').trim();
  if (purposeRequired && !normalizedPurpose) {
    throw new Error('Purpose / reason for visit is required for this appointment type.');
  }

  const data = await sendGraphQL(`
    mutation SubmitAppointment(
      $schedulerId: ID!, $date: Date!, $session: SCHEDULE_SESSION!,
      $requirements: [patientScheduleRequirementInput!]!,
      $purpose: String
    ) {
      submitAppointment(
        schedulerId: $schedulerId, date: $date,
        session: $session, requirements: $requirements,
        purpose: $purpose
      ) { id patientId slotEntityId status session purpose notes created_at }
    }
  `, { schedulerId, date, session, requirements, purpose: normalizedPurpose || null });
  return data.submitAppointment;
};

export const cancelAppointment = async () => {
  const data = await sendGraphQL(`mutation { cancelAppointment }`);
  return data.cancelAppointment;
};

export const stageFile = async (uri: string, name: string, type: string) => {
  const body = new FormData();
  body.append('file', { uri, name, type } as any);
  const response = await axiosRequest.post('/media/stage/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.fileId;
};

export const unstageFile = async (fileId: string) => {
  if (!fileId) return;
  await axiosRequest.delete(`/media/unstage/${fileId}`);
};
