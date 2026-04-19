import { axiosRequest } from '../packages-core-adapter';

const normalizeTemplateType = (templateType = '') =>
  String(templateType).trim().toLowerCase().replace(/\s+/g, '-');

const normalizeDocumentMode = (mode = '') =>
  String(mode).trim().toLowerCase() === 'view' ? 'view' : 'download';

const normalizeContentType = (value = '') =>
  String(value).split(';')[0].trim().toLowerCase();

const inFlightPdfRequests = new Map();

const readBlobTextSafe = async (blob) => {
  try {
    if (!blob || typeof blob.text !== 'function') return '';
    return await blob.text();
  } catch {
    return '';
  }
};

const blobStartsWithPdfHeader = async (blob) => {
  try {
    if (!blob || typeof blob.slice !== 'function') return false;
    const maxScanBytes = 1024;
    const header = new Uint8Array(await blob.slice(0, maxScanBytes).arrayBuffer());

    for (let i = 0; i <= header.length - 5; i += 1) {
      const isPdfSignature =
        header[i] === 0x25 // %
        && header[i + 1] === 0x50 // P
        && header[i + 2] === 0x44 // D
        && header[i + 3] === 0x46 // F
        && header[i + 4] === 0x2d; // -

      if (isPdfSignature) return true;
    }

    return false;
  } catch {
    return false;
  }
};

const extractDocumentErrorMessage = async (blob, contentType) => {
  const text = (await readBlobTextSafe(blob)).trim();
  if (!text) {
    return 'Received a non-PDF response from the server.';
  }

  if (contentType === 'application/json') {
    try {
      const parsed = JSON.parse(text);
      return parsed?.message || parsed?.error || 'Received a JSON response instead of PDF.';
    } catch {
      return 'Received a JSON response instead of PDF.';
    }
  }

  if (text.startsWith('<!doctype') || text.startsWith('<html')) {
    return 'Received an HTML response instead of PDF.';
  }

  return 'Received a non-PDF response from the server.';
};

const fetchPdfBlobFromPath = async (path) => {
  const response = await axiosRequest.get(path, {
    responseType: 'blob',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

  const blob = response.data;
  const headerContentType = normalizeContentType(response.headers?.['content-type'] || '');
  const blobContentType = normalizeContentType(blob?.type || '');
  const startsWithPdf = await blobStartsWithPdfHeader(blob);

  if (!startsWithPdf) {
    const message = await extractDocumentErrorMessage(blob, headerContentType || blobContentType);
    const err = new Error(message);
    err.code = 'INVALID_PDF_RESPONSE';
    err.path = path;
    throw err;
  }

  if (blobContentType !== 'application/pdf') {
    return blob.slice(0, blob.size, 'application/pdf');
  }

  return blob;
};

const fetchPdfBlobSingleFlight = async (path) => {
  if (inFlightPdfRequests.has(path)) {
    return inFlightPdfRequests.get(path);
  }

  const requestPromise = fetchPdfBlobFromPath(path).finally(() => {
    inFlightPdfRequests.delete(path);
  });

  inFlightPdfRequests.set(path, requestPromise);
  return requestPromise;
};

const resolvePatientDocumentPath = (documentId, templateType = '', mode = 'download') => {
  const normalizedType = normalizeTemplateType(templateType);
  const normalizedMode = normalizeDocumentMode(mode);

  const resolveTemplatePath = (template) => {
    if (normalizedMode === 'view') {
      return `/documents/${template}/view/${documentId}`;
    }
    return `/documents/${template}/download/${documentId}`;
  };

  if (normalizedType === 'prescription') {
    return resolveTemplatePath('prescription');
  }
  if (normalizedType === 'medical-certificate') {
    return resolveTemplatePath('medical-certificate');
  }
  return `/documents/my/download/${documentId}`;
};

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
 * @param {number|object} documentOrId - document id or document object with { id, templateType }
 * @param {string|object} templateTypeOrOptions - optional template type or options { templateType, mode }
 * @param {string} mode - optional explicit mode ('view' | 'download')
 * @returns {Blob}
 */
export const downloadMyDocument = async (documentOrId, templateTypeOrOptions = '', mode = 'download') => {
  const documentId =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.id
      : documentOrId;

  const explicitTemplateType =
    typeof templateTypeOrOptions === 'object' && templateTypeOrOptions !== null
      ? templateTypeOrOptions.templateType || ''
      : templateTypeOrOptions;

  const requestedMode =
    typeof templateTypeOrOptions === 'object' && templateTypeOrOptions !== null
      ? templateTypeOrOptions.mode || mode
      : mode;

  const documentTemplateType =
    typeof documentOrId === 'object' && documentOrId !== null
      ? documentOrId.templateType
      : explicitTemplateType;

  if (!documentId) {
    throw new Error('documentId is required');
  }

  const preferredPath = resolvePatientDocumentPath(documentId, documentTemplateType, requestedMode);
  return fetchPdfBlobSingleFlight(preferredPath);
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
