import { axiosRequest } from '../packages-core-adapter';

const normalizeTemplateType = (templateType = '') =>
  String(templateType).trim().toLowerCase().replace(/\s+/g, '-');

const normalizeDocumentMode = (mode = '') =>
  String(mode).trim().toLowerCase() === 'view' ? 'view' : 'download';

const resolveGeneratedDocumentPath = (documentId, templateType = '', mode = 'download') => {
  const normalizedType = normalizeTemplateType(templateType);
  const normalizedMode = normalizeDocumentMode(mode);

  if (normalizedType === 'prescription') {
    return `/documents/prescription/${normalizedMode}/${documentId}`;
  }
  if (normalizedType === 'medical-certificate') {
    return `/documents/medical-certificate/${normalizedMode}/${documentId}`;
  }
  return `/documents/generated/download/${documentId}`;
};

const fetchGeneratedDocumentBlob = async (path) => {
  const response = await axiosRequest.get(path, {
    responseType: 'blob',
  });
  return response.data;
};

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
 * Cancel a document request (deletes the submission).
 * @param {string|number} documentId - The document tag ID
 * @param {string|number} patientId - The patient ID
 * @returns {Promise<{success: boolean}>}
 */
export const cancelDocument = async (documentId, patientId) => {
  const response = await axiosRequest.delete(`/documents/required/${documentId}/cancel`, {
    params: { patientId },
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to cancel document');
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
  const response = await axiosRequest.get(`/media/record/documents/${fileId}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get all generated documents (prescriptions, certificates, etc.) for a patient.
 * @param {string|number} patientId - The patient ID
 * @returns {Promise<Array>} Generated documents with metadata
 */
export const getGeneratedDocuments = async (patientId) => {
  const response = await axiosRequest.get(`/documents/generated/patient/${patientId}`);
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load generated documents');
  }
  return response.data.documents;
};

/**
 * Download a generated document PDF as Blob.
 * @param {string|number|object} documentOrId - generated document id or object with { id, templateType }
 * @param {string} templateType - optional template type override when first arg is id
 * @returns {Promise<Blob>}
 */
export const downloadGeneratedDocumentBlob = async (documentOrId, templateType = '') => {
  const documentId =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.id
      : documentOrId;

  const documentTemplateType =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.templateType
      : templateType;

  const preferredPath = resolveGeneratedDocumentPath(documentId, documentTemplateType, 'download');
  const fallbackPath = `/documents/generated/download/${documentId}`;

  try {
    return await fetchGeneratedDocumentBlob(preferredPath);
  } catch (err) {
    if (preferredPath !== fallbackPath) {
      return fetchGeneratedDocumentBlob(fallbackPath);
    }
    throw err;
  }
};

/**
 * View a generated document PDF as Blob.
 * @param {string|number|object} documentOrId - generated document id or object with { id, templateType }
 * @param {string} templateType - optional template type override when first arg is id
 * @returns {Promise<Blob>}
 */
export const viewGeneratedDocumentBlob = async (documentOrId, templateType = '') => {
  const documentId =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.id
      : documentOrId;

  const documentTemplateType =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.templateType
      : templateType;

  const preferredPath = resolveGeneratedDocumentPath(documentId, documentTemplateType, 'view');
  const fallbackPath = `/documents/generated/download/${documentId}`;

  try {
    return await fetchGeneratedDocumentBlob(preferredPath);
  } catch (err) {
    if (preferredPath !== fallbackPath) {
      return fetchGeneratedDocumentBlob(fallbackPath);
    }
    throw err;
  }
};
