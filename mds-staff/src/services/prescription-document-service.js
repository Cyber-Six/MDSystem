/**
 * Prescription Document Service — Health Chat
 *
 * REST calls to generate prescription PDFs via the doc-generate-module.
 * Endpoint: /documents
 */

import { axiosRequest } from '../packages-core-adapter';

/**
 * Generate a prescription PDF — saves to PatientDocuments in the DB.
 * @param {number} patientId
 * @param {object} data - { patient, prescription, issuedDate, ... }
 * @returns {{ success, documentId, filename, metadata }}
 */
export const generatePrescription = async (patientId, data) => {
  const response = await axiosRequest.post('/documents/prescription/generate', {
    patientId,
    data,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to generate prescription');
  }
  return response.data;
};

/**
 * Download a generated document as a Blob.
 * @param {number} documentId
 * @returns {Blob}
 */
export const downloadDocumentBlob = async (documentId) => {
  const response = await axiosRequest.get(`/documents/${documentId}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Preview a prescription PDF without saving — streams directly.
 * @param {object} data - same shape as generate
 * @returns {Blob}
 */
export const previewPrescription = async (data) => {
  const response = await axiosRequest.post('/documents/prescription/preview', {
    data,
  }, {
    responseType: 'blob',
  });
  return response.data;
};
