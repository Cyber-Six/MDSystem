// Internal URL policy shared by the authenticated HTTP and token services.
export const normalizeApiBaseUrl = (value) => {
  if (typeof value !== 'string') throw new Error('API base URL must be a string');
  const base = value.trim();
  if (!base) return '';
  const invalid = () => new Error('API base URL must be an HTTP(S) URL or a root-relative path without credentials, query, or fragment');
  if (/[\\\s\u0000-\u001f\u007f?#]/.test(base) || base.startsWith('//')) throw invalid();
  const relative = base.startsWith('/');
  if (!relative && !/^https?:\/\//i.test(base)) throw invalid();
  let url;
  try {
    url = new URL(base, relative ? 'https://api.invalid' : undefined);
  } catch {
    throw invalid();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw invalid();
  return (relative ? url.pathname : url.href).replace(/\/+$/, '');
};

export const apiEndpoint = (base, path) => `${normalizeApiBaseUrl(base)}${path}`;
