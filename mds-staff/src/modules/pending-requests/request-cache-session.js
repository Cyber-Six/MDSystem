// Cache identity remains in memory and is never included in a key or persisted.
let credential = null;
let generation = 0;
let sessionGeneration = 0;
const listeners = new Set();

export function invalidateRequestCaches() {
  generation += 1;
  listeners.forEach(clear => clear());
}

export function requestCacheGeneration() {
  const current = localStorage.getItem('staff_refreshToken');
  if (current !== credential) {
    credential = current;
    sessionGeneration += 1;
    invalidateRequestCaches();
  }
  return sessionGeneration;
}

export function onRequestCacheInvalidated(clear) { listeners.add(clear); }
export function requestCacheVersion() { return generation; }

if (typeof window !== 'undefined') {
  window.addEventListener('mds:auth-changed', () => { sessionGeneration += 1; invalidateRequestCaches(); });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === 'staff_refreshToken') { sessionGeneration += 1; invalidateRequestCaches(); }
  });
}
