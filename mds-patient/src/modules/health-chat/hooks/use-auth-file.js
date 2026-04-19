import { useState, useEffect } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';

const normalizeContentType = (contentType = '') => (
  String(contentType).split(';')[0].trim().toLowerCase()
);

const inFlightBlobRequests = new Map();

const isGeneratedDocumentUrl = (url = '') => {
  const path = String(url).split('?')[0].split('#')[0];
  return (
    /^\/documents\/(?:patient\/)?(?:prescription|medical-certificate)\//i.test(path)
    || /^\/documents\/my\/download\//i.test(path)
  );
};

const normalizeTemplateType = (templateType = '') =>
  String(templateType).trim().toLowerCase().replace(/\s+/g, '-');

const extractDocumentIdFromUrl = (url = '') => {
  const path = String(url).split('?')[0].split('#')[0];
  const patientIdFirstMatch = path.match(/^\/documents\/patient\/(?:prescription|medical-certificate)\/([^/]+)\/(?:view|download)$/i);
  if (patientIdFirstMatch) return patientIdFirstMatch[1];

  const patientLegacyMatch = path.match(/^\/documents\/patient\/(?:prescription|medical-certificate)\/(?:view|download)\/([^/]+)$/i);
  if (patientLegacyMatch) return patientLegacyMatch[1];

  const directMatch = path.match(/^\/documents\/my\/download\/([^/]+)$/i);
  if (directMatch) return directMatch[1];

  const legacyMatch = path.match(/^\/documents\/(?:prescription|medical-certificate)(?:\/(?:view|download))?\/([^/]+)$/i);
  if (legacyMatch) return legacyMatch[1];

  return '';
};

const extractTemplateTypeFromUrl = (url = '') => {
  const path = String(url).split('?')[0].split('#')[0];
  const templatePatterns = [
    /^\/documents\/patient\/(prescription|medical-certificate)\//i,
    /^\/documents\/(prescription|medical-certificate)(?:\/(?:view|download))?\//i,
  ];

  for (const pattern of templatePatterns) {
    const templateMatch = path.match(pattern);
    if (templateMatch) return normalizeTemplateType(templateMatch[1]);
  }

  return '';
};

const extractModeFromUrl = (url = '') => {
  const path = String(url).split('?')[0].split('#')[0];
  if (/\/download(?:\/|$)/i.test(path)) return 'download';
  return 'view';
};

const resolveGeneratedDocumentPath = (url = '') => {
  const documentId = extractDocumentIdFromUrl(url);
  if (!documentId) return url;

  const templateType = extractTemplateTypeFromUrl(url);
  const mode = extractModeFromUrl(url);

  const resolveTemplatePath = (template) => {
    if (mode === 'view') {
      return `/documents/${template}/view/${documentId}`;
    }
    return `/documents/${template}/download/${documentId}`;
  };

  if (templateType === 'prescription') {
    return resolveTemplatePath('prescription');
  }

  if (templateType === 'medical-certificate') {
    return resolveTemplatePath('medical-certificate');
  }

  return `/documents/my/download/${documentId}`;
};

const fetchBlobSingleFlight = async (requestUrl) => {
  if (inFlightBlobRequests.has(requestUrl)) {
    return inFlightBlobRequests.get(requestUrl);
  }

  const requestPromise = axiosRequest.get(requestUrl, {
    responseType: 'blob',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  }).finally(() => {
    inFlightBlobRequests.delete(requestUrl);
  });

  inFlightBlobRequests.set(requestUrl, requestPromise);
  return requestPromise;
};

const readBlobTextSafe = async (blob) => {
  try {
    if (!blob || typeof blob.text !== 'function') return '';
    return await blob.text();
  } catch {
    return '';
  }
};

const extractPdfErrorMessage = async (blob) => {
  const textPayload = (await readBlobTextSafe(blob)).trim();
  let message = 'Failed to load PDF document.';

  if (textPayload) {
    try {
      const parsedJson = JSON.parse(textPayload);
      message = parsedJson?.message || parsedJson?.error || message;
    } catch {
      if (textPayload.startsWith('<!doctype') || textPayload.startsWith('<html')) {
        message = 'Received HTML response instead of PDF.';
      }
    }
  }

  return message;
};

const sniffPdfMimeType = async (blob) => {
  try {
    const maxScanBytes = 1024;
    const header = new Uint8Array(await blob.slice(0, maxScanBytes).arrayBuffer());
    let isPdf = false;

    for (let i = 0; i <= header.length - 5; i += 1) {
      const matchesSignature =
        header[i] === 0x25 && // %
        header[i + 1] === 0x50 && // P
        header[i + 2] === 0x44 && // D
        header[i + 3] === 0x46 && // F
        header[i + 4] === 0x2d;   // -

      if (matchesSignature) {
        isPdf = true;
        break;
      }
    }

    return isPdf ? 'application/pdf' : '';
  } catch {
    return '';
  }
};

/**
 * Hook that fetches a JWT-protected file and returns a blob URL for display.
 * The media endpoint requires JWT auth, so we can't use plain <img src="/media/...">.
 * Instead, we fetch via axiosRequest (which includes JWT) and create an object URL.
 *
 * @param {string|null} url - The media URL path (e.g. /media/record/eConsultation/uuid)
 * @returns {{ blobUrl: string|null, loading: boolean, error: string|null, contentType: string }}
 */
export function useAuthFile(url) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contentType, setContentType] = useState('');

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Set loading true synchronously so the first render already shows the spinner
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setContentType('');

    let revoked = false;
    let objectUrl = null;

    const fetchFile = async () => {
      try {
        const parseResponse = async (response) => {
          const responseBlob = response.data;
          const headerContentType = normalizeContentType(response.headers?.['content-type'] || '');
          let resolvedContentType = headerContentType || normalizeContentType(responseBlob?.type || '');

          if (!resolvedContentType || resolvedContentType === 'application/octet-stream') {
            const sniffedType = await sniffPdfMimeType(responseBlob);
            if (sniffedType) {
              resolvedContentType = sniffedType;
            }
          }

          return {
            responseBlob,
            resolvedContentType,
          };
        };

        const shouldValidatePdf = isGeneratedDocumentUrl(url);
        const requestUrl = shouldValidatePdf ? resolveGeneratedDocumentPath(url) : url;
        const response = await fetchBlobSingleFlight(requestUrl);
        const parsed = await parseResponse(response);

        if (shouldValidatePdf) {
          const signatureMimeType = await sniffPdfMimeType(parsed.responseBlob);
          if (signatureMimeType !== 'application/pdf') {
            const message = await extractPdfErrorMessage(parsed.responseBlob);
            throw new Error(message);
          }
        }

        if (revoked) return;

        const { responseBlob, resolvedContentType } = parsed;

        setContentType(resolvedContentType);

        const blobForPreview =
          resolvedContentType && normalizeContentType(responseBlob.type) !== resolvedContentType
            ? responseBlob.slice(0, responseBlob.size, resolvedContentType)
            : responseBlob;

        objectUrl = URL.createObjectURL(blobForPreview);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (revoked) return;
        setError(err.message || 'Failed to load file');
        setBlobUrl(null);
      } finally {
        if (!revoked) setLoading(false);
      }
    };

    fetchFile();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return { blobUrl, loading, error, contentType };
}
