import { sendGraphQLRequest } from '../../utils/graphql-client';

const GET_PATIENT_DASHBOARD_DATA_QUERY = `
  query GetPatientDashboardData {
    getPatientDashboardData {
      appointment {
        id
        status
        session
        purpose
        schedulerLabel
        scheduledDate
        created_at
      }
      medicineReqs {
        id
        status
        purpose
        created_at
      }
      updateTicket {
        id
        status
        scope
        notes
        created_at
      }
      chatData {
        total
        chats {
          id
          status
          purpose
          session_start
        }
      }
    }
  }
`;

export const fetchPatientDashboardData = async () => {
  const response = await sendGraphQLRequest(
    GET_PATIENT_DASHBOARD_DATA_QUERY,
    {},
    { endpoint: '/dashboard/patient' }
  );

  return response?.getPatientDashboardData || {
    appointment: null,
    medicineReqs: [],
    updateTicket: null,
    chatData: { chats: [], total: 0 },
  };
};
