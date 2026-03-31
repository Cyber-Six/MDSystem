import { axiosRequest } from '../packages-core-adapter';

/**
 * List all documents for the authenticated patient.
 * @returns {{ success: boolean, documents: Array }}
 */
export const getMyDocuments = async () => {
  const response = await axiosRequest.get('/documents/my');
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load documents');
  }
  return response.data.documents;
};

/**
 * Download a specific document as a Blob.
 * @param {number} documentId
 * @returns {Blob}
 */
export const downloadMyDocument = async (documentId) => {
  const response = await axiosRequest.get(`/documents/my/${documentId}`, {
    responseType: 'blob',
  });
  return response.data;
};
