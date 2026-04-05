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

/**
 * Get documents that have been requested by staff.
 * Only returns documents with status 'Requested'.
 * @returns {Promise<Array>} List of requested documents
 */
export const getRequestedDocuments = async () => {
  const response = await axiosRequest.get('/documents/requests');
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load requested documents');
  }
  return response.data.documents;
};

/**
 * Upload/submit a requested document.
 * @param {string|number} documentId - The document tag ID
 * @param {string} fileUUID - The staged file UUID from /media/stage
 * @returns {Promise<{submissionId: number}>}
 */
export const uploadRequestedDocument = async (documentId, fileUUID) => {
  const response = await axiosRequest.post(`/documents/requests/${documentId}`, {
    file: fileUUID,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to upload document');
  }
  return response.data;
};
