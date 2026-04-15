/**
 * Documents Service
 * Mirrors mds-patient's documents-service.js
 *
 * Provides functions for issued documents and requested document submissions.
 *
 * Uses authenticated axios to download PDFs, then saves them to the
 * device cache and opens them via expo-sharing.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { axiosRequest } from '../core';

export interface DocumentIssuer {
  name?: string;
}

export interface PatientDocument {
  id: number;
  templateType: string;
  description?: string;
  createdAt: string;
  expiredAt?: string;
  issuedBy?: DocumentIssuer;
}

export interface RequestedDocumentSubmission {
  id: number;
  status: 'Requested' | 'Pending' | 'Recorded' | 'Rejected' | string;
  file?: string | null;
  notes?: string | null;
  recordedBy?: DocumentIssuer | null;
  submittedAt?: string;
}

export interface RequestedDocument {
  id: number;
  label: string;
  isActive: boolean;
  submission: RequestedDocumentSubmission | null;
}

/**
 * List all documents for the authenticated patient.
 */
export const getMyDocuments = async (): Promise<PatientDocument[]> => {
  const response = await axiosRequest.get('/documents/my');
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load documents');
  }
  return response.data.documents as PatientDocument[];
};

/**
 * List requested documents for the authenticated patient.
 */
export const getRequestedDocuments = async (): Promise<RequestedDocument[]> => {
  const response = await axiosRequest.get('/documents/requests');
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to load requested documents');
  }
  return response.data.documents as RequestedDocument[];
};

/**
 * Upload a local file to staging and return the staged file UUID.
 */
export const stageRequestedDocumentFile = async (file: {
  uri: string;
  name: string;
  type: string;
}): Promise<string> => {
  const body = new FormData();
  body.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const response = await axiosRequest.post('/media/stage/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.fileId) {
    throw new Error('Failed to stage selected file.');
  }

  return response.data.fileId;
};

/**
 * Submit a staged file for a requested document.
 */
export const uploadRequestedDocument = async (
  documentId: number,
  fileUUID: string
): Promise<{ submissionId: number }> => {
  const response = await axiosRequest.post(`/documents/requests/${documentId}`, {
    file: fileUUID,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.message || response.data?.error || 'Failed to upload document');
  }
  return response.data as { submissionId: number };
};

/**
 * Download a document via authenticated request and open it via the system
 * share sheet (mirrors patient's blob download approach).
 *
 * @param doc - The document to download and open
 * @throws Error with user-friendly message on failure
 */
export const downloadAndOpenDocument = async (doc: PatientDocument): Promise<void> => {
  // 1. Authenticated download as arraybuffer
  const response = await axiosRequest.get(`/documents/my/download/${doc.id}`, {
    responseType: 'arraybuffer',
  });

  // 2. Convert to base64 for FileSystem
  const uint8 = new Uint8Array(response.data);
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  // 3. Write to cache directory with meaningful filename
  const dateStr = new Date(doc.createdAt).toISOString().split('T')[0];
  const fileName = `${doc.templateType}_${dateStr}.pdf`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 4. Share / open
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Open ${doc.templateType}`,
    UTI: 'com.adobe.pdf',
  });
};

