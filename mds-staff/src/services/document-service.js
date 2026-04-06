import { axiosRequest } from '../packages-core-adapter';

/**
 * Get all required document tags with patient's submission status.
 * @param {string|number} patientId - The patient ID to fetch documents for
 * @returns {Promise<Array>} List of document tags with submission info
 */
export const getRequiredDocuments = async (patientId) => {
  const response = await axiosRequest.get('/documents/required', {
    params: { patientId },
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load documents');
  }
  return response.data.documents;
};

/**
 * Request a document from a patient (sets status to 'Requested').
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @param {string} [notes] - Optional notes explaining why the document is needed
 * @returns {Promise<{submissionId: number}>}
 */
export const requestDocument = async (documentId, patientId, notes = null) => {
  const response = await axiosRequest.post(`/documents/required/${documentId}/request`, {
    patientId,
    notes,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to request document');
  }
  return response.data;
};

/**
 * Approve a submitted document (sets status to 'Recorded').
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @param {string} [notes] - Optional review notes
 * @returns {Promise<{submissionId: number}>}
 */
export const approveDocument = async (documentId, patientId, notes = null) => {
  const response = await axiosRequest.post(`/documents/required/${documentId}/approve`, {
    patientId,
    notes,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to approve document');
  }
  return response.data;
};

/**
 * Reject a submitted document (sets status to 'Rejected').
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @param {string} [notes] - Optional rejection reason
 * @returns {Promise<{submissionId: number}>}
 */
export const rejectDocument = async (documentId, patientId, notes = null) => {
  const response = await axiosRequest.post(`/documents/required/${documentId}/reject`, {
    patientId,
    notes,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to reject document');
  }
  return response.data;
};

/**
 * Archive a recorded document (sets status to 'Archived').
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @param {string} [notes] - Optional reason for archiving
 * @returns {Promise<{submissionId: number}>}
 */
export const archiveDocument = async (documentId, patientId, notes = null) => {
  const response = await axiosRequest.post(`/documents/required/${documentId}/archive`, {
    patientId,
    notes,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to archive document');
  }
  return response.data;
};

/**
 * Record a document (sets status to 'Recorded').
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @param {string} [file] - Optional file UUID from staging
 * @returns {Promise<{submissionId: number}>}
 */
export const recordDocument = async (documentId, patientId, file = null) => {
  const response = await axiosRequest.post(`/documents/required/${documentId}`, {
    patientId,
    ...(file && { file }),
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to record document');
  }
  return response.data;
};

/**
 * View a patient's uploaded document file.
 * @param {string} fileId - The file UUID
 * @returns {Promise<Blob>}
 */
export const viewDocumentFile = async (fileId) => {
  const response = await axiosRequest.get(`/media/documents/${fileId}`, {
    responseType: 'blob',
  });
  return response.data;
};
