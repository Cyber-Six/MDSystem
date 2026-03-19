/**
 * Medicine Request Service for React Native
 * Mirrors mds-patient medicine-request functionality
 */

import { sendGraphQLRequest } from './graphql-client';

const sendGraphQL = async (query: string, variables: Record<string, any> = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: '/medical-inventory/patient' });
};

export const listMedicines = async (branch: string) => {
  const data = await sendGraphQL(`
    query ListMedicines($branch: String!) {
      listMedicines(branch: $branch) {
        id name dosage unit quantity
      }
    }
  `, { branch });
  return data.listMedicines;
};

export const submitMedicineRequest = async (
  chiefComplaint: string,
  branch: string,
  medicines: Array<{ medicineId: string; quantity: number }>
) => {
  const data = await sendGraphQL(`
    mutation SubmitMedicineRequest(
      $chiefComplaint: String!, $branch: String!,
      $medicines: [MedicineRequestInput!]!
    ) {
      submitMedicineRequest(
        chiefComplaint: $chiefComplaint, branch: $branch,
        medicines: $medicines
      ) { id status created_at }
    }
  `, { chiefComplaint, branch, medicines });
  return data.submitMedicineRequest;
};

export const getMedicineRequestStatus = async () => {
  const data = await sendGraphQL(`
    query {
      getMedicineRequestStatus {
        id status chiefComplaint branch created_at
        medicines { name dosage quantity }
      }
    }
  `);
  return data.getMedicineRequestStatus;
};
