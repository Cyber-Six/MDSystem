/**
 * Medical Certificate Document Service — Health Chat
 *
 * REST calls to generate medical certificate PDFs via the doc-generate-module.
 * Endpoint: /documents
 */

import { axiosRequest } from '../packages-core-adapter';

/**
 * Generate a medical certificate PDF — saves to PatientDocuments in the DB.
 * @param {number} patientId
 * @param {object} data - { patient, certificate, issuedDate, physician, ... }
 * @param {object} options - Optional integration options
 * @returns {{ success, documentId, filename, metadata }}
 */
export const generateMedicalCertificate = async (patientId, data, options = {}) => {
  const payload = {
    patientId,
    data,
  };

  if (options.chatId) {
    payload.chatId = options.chatId;
  }

  const response = await axiosRequest.post('/documents/medical-certificate/generate', payload);
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to generate medical certificate');
  }
  return response.data;
};

/**
 * Download a generated document as a Blob.
 * @param {number} documentId
 * @returns {Blob}
 */
export const downloadDocumentBlob = async (documentId) => {
  try {
    const response = await axiosRequest.get(`/documents/generated/download/${documentId}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch {
    const fallbackResponse = await axiosRequest.get(`/documents/${documentId}`, {
      responseType: 'blob',
    });
    return fallbackResponse.data;
  }
};

/**
 * Preview a medical certificate PDF without saving — streams directly.
 * @param {object} data - same shape as generate
 * @returns {Blob}
 */
export const previewMedicalCertificate = async (data) => {
  const response = await axiosRequest.post('/documents/medical-certificate/preview', {
    data,
  }, {
    responseType: 'blob',
  });
  return response.data;
};