/**
 * Medicine Request Service for React Native
 * Mirrors mds-patient medicine-request functionality
 * 
 * Endpoint: /medical-inventory/medicine-request/patient
 * Backend schema: getAvailableMedicine, getMedicineStatus, createMedicineRequest, cancelMedicineRequest
 */

import { sendGraphQLRequest } from './graphql-client';

const sendGraphQL = async (query: string, variables: Record<string, any> = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: '/medical-inventory/medicine-request/patient' });
};

// Backend LocationDesignation enum values
export type LocationDesignation = 'Arlegui' | 'Casal' | 'QuezonCity';

export const BRANCHES: { label: string; value: LocationDesignation }[] = [
  { label: 'Casal', value: 'Casal' },
  { label: 'Arlegui', value: 'Arlegui' },
  { label: 'Quezon City', value: 'QuezonCity' },
];

export interface AvailableMedicine {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
}

export interface MedicineRequestItem {
  id: string;
  batchId?: number;
  medicineId?: number;
  requestId?: number;
  quantity: number;
}

export interface MedicineRequest {
  id: string;
  patientId?: number;
  status: string;
  purpose: string;
  notes?: string;
  approved_by?: number;
  created_at: string;
  location?: LocationDesignation;
  items: MedicineRequestItem[];
}

/**
 * Get available medicines for a given branch/location
 */
export const getAvailableMedicine = async (location: LocationDesignation) => {
  const data = await sendGraphQL(`
    query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
      getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
        id
        item_code
        item_name
        category
      }
    }
  `, { location, offset: 0, limit: 100 });
  return (data.getAvailableMedicine || []) as AvailableMedicine[];
};

/**
 * Get patient's medicine request history
 */
export const getMedicineStatus = async (): Promise<MedicineRequest[]> => {
  const data = await sendGraphQL(`
    query GetMedicineStatus {
      getMedicineStatus {
        id
        patientId
        status
        purpose
        notes
        approved_by
        created_at
        items {
          id
          medicineId
          requestId
          quantity
        }
      }
    }
  `);
  return data.getMedicineStatus || [];
};

/**
 * Submit a new medicine request
 */
export const createMedicineRequest = async (
  purpose: string,
  location: LocationDesignation,
  items: Array<{ batchId: number; quantity: number }>
) => {
  const data = await sendGraphQL(`
    mutation CreateMedicineRequest($input: CreateMedicineRequestInput!) {
      createMedicineRequest(input: $input) {
        id
        patientId
        status
        purpose
        created_at
        items {
          id
          medicineId
          quantity
        }
      }
    }
  `, {
    input: {
      purpose,
      location,
      items,
    },
  });
  return data.createMedicineRequest as MedicineRequest;
};

/**
 * Cancel patient's pending medicine request
 */
export const cancelMedicineRequest = async () => {
  const data = await sendGraphQL(`
    mutation {
      cancelMedicineRequest {
        id
        status
      }
    }
  `);
  return data.cancelMedicineRequest;
};
