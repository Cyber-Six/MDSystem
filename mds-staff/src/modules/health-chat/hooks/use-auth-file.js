import { useState, useEffect } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';

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
        const response = await axiosRequest.get(url, {
          responseType: 'blob',
        });

        if (revoked) return;

        const ct = response.headers?.['content-type'] || '';
        setContentType(ct);

        objectUrl = URL.createObjectURL(response.data);
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
