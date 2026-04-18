import React, { useEffect, useState } from 'react';
import { axiosRequest } from '../../../packages-core-adapter';

const ANNOUNCEMENT_IMAGE_CACHE_MAX_ENTRIES = 60;
const ANNOUNCEMENT_IMAGE_CACHE_TTL_MS = 30 * 60 * 1000;

const announcementImageCache = new Map();

const normalizePath = (path) => (typeof path === 'string' ? path.trim() : '');

const revokeBlobUrl = (blobUrl) => {
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
  }
};

const pruneAnnouncementImageCache = () => {
  const now = Date.now();

  for (const [path, entry] of announcementImageCache.entries()) {
    const isExpired = now - (entry.lastAccessedAt || 0) > ANNOUNCEMENT_IMAGE_CACHE_TTL_MS;
    if (isExpired && !entry.inFlightPromise) {
      revokeBlobUrl(entry.blobUrl);
      announcementImageCache.delete(path);
    }
  }

  if (announcementImageCache.size <= ANNOUNCEMENT_IMAGE_CACHE_MAX_ENTRIES) {
    return;
  }

  const removableEntries = [...announcementImageCache.entries()]
    .filter(([, entry]) => !entry.inFlightPromise)
    .sort((a, b) => (a[1].lastAccessedAt || 0) - (b[1].lastAccessedAt || 0));

  while (announcementImageCache.size > ANNOUNCEMENT_IMAGE_CACHE_MAX_ENTRIES && removableEntries.length > 0) {
    const [path, entry] = removableEntries.shift();
    revokeBlobUrl(entry.blobUrl);
    announcementImageCache.delete(path);
  }
};

const loadAnnouncementImage = async (path) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    throw new Error('Announcement image path is required');
  }

  const now = Date.now();
  const cachedEntry = announcementImageCache.get(normalizedPath);

  if (cachedEntry?.blobUrl) {
    cachedEntry.lastAccessedAt = now;
    return cachedEntry.blobUrl;
  }

  if (cachedEntry?.inFlightPromise) {
    cachedEntry.lastAccessedAt = now;
    return cachedEntry.inFlightPromise;
  }

  const inFlightPromise = axiosRequest
    .get(normalizedPath, { responseType: 'blob' })
    .then((response) => {
      const blobUrl = URL.createObjectURL(response.data);
      announcementImageCache.set(normalizedPath, {
        blobUrl,
        inFlightPromise: null,
        lastAccessedAt: Date.now(),
      });
      pruneAnnouncementImageCache();
      return blobUrl;
    })
    .catch((error) => {
      const currentEntry = announcementImageCache.get(normalizedPath);
      if (currentEntry?.inFlightPromise) {
        announcementImageCache.delete(normalizedPath);
      }
      throw error;
    });

  announcementImageCache.set(normalizedPath, {
    blobUrl: null,
    inFlightPromise,
    lastAccessedAt: now,
  });

  return inFlightPromise;
};

const AuthenticatedAnnouncementImage = ({ path, alt, className }) => {
  const [loadedImage, setLoadedImage] = useState({ path: '', src: null });
  const normalizedPath = normalizePath(path);
  const cachedBlobUrl = normalizedPath
    ? announcementImageCache.get(normalizedPath)?.blobUrl || null
    : null;

  useEffect(() => {
    if (!normalizedPath) {
      return;
    }

    if (cachedBlobUrl) {
      const cachedEntry = announcementImageCache.get(normalizedPath);
      if (cachedEntry) {
        cachedEntry.lastAccessedAt = Date.now();
      }
      return;
    }

    let cancelled = false;

    loadAnnouncementImage(normalizedPath)
      .then((blobUrl) => {
        if (!cancelled) {
          setLoadedImage({ path: normalizedPath, src: blobUrl });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedImage({ path: normalizedPath, src: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedPath, cachedBlobUrl]);

  const src = cachedBlobUrl || (loadedImage.path === normalizedPath ? loadedImage.src : null);

  if (!normalizedPath || !src) {
    return null;
  }

  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
};

export default AuthenticatedAnnouncementImage;
