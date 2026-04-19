/**
 * Medical Certificate Document Service — Health Chat
 *
 * REST calls to generate medical certificate PDFs via the doc-generate-module.
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
    return await fetchPdfBlob(`/documents/generated/download/${documentId}`);
  } catch {
    return await fetchPdfBlob(`/documents/${documentId}`);
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