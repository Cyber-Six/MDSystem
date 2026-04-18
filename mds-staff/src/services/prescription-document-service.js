/**
 * Prescription Document Service — Health Chat
 *
 * REST calls to generate prescription PDFs via the doc-generate-module.
 * Endpoint: /documents
 */

import { axiosRequest } from '../packages-core-adapter';

const isPdfBlob = async (blob) => {
  if (!blob) return false;

  const contentType = String(blob.type || '').split(';')[0].trim().toLowerCase();
  if (contentType === 'application/pdf') return true;

  try {
    const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    return (
      header.length === 5 &&
      header[0] === 0x25 && // %
      header[1] === 0x50 && // P
      header[2] === 0x44 && // D
      header[3] === 0x46 && // F
      header[4] === 0x2d    // -
    );
  } catch {
    return false;
  }
};

const fetchPdfBlob = async (url) => {
  const response = await axiosRequest.get(url, { responseType: 'blob' });
  const blob = response.data;

  if (!(await isPdfBlob(blob))) {
    throw new Error('Received non-PDF payload while downloading document.');
  }

  return blob;
};

/**
 * Generate a prescription PDF — saves to PatientDocuments in the DB.
 * @param {number} patientId
 * @param {object} data - { patient, prescription, issuedDate, ... }
 * @param {object} options - Optional integration options
 * @returns {{ success, documentId, filename, metadata }}
 */
export const generatePrescription = async (patientId, data, options = {}) => {
  const payload = {
    patientId,
    data,
  };

  if (options.chatId) {
    payload.chatId = options.chatId;
  }

  const response = await axiosRequest.post('/documents/prescription/generate', payload);
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
  try {
    return await fetchPdfBlob(`/documents/generated/download/${documentId}`);
  } catch {
    // Backward-compatible fallback for older route variants.
    return await fetchPdfBlob(`/documents/${documentId}`);
  }
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
