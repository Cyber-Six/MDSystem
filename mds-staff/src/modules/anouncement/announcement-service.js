/**
 * Announcement Service
 * Handles REST API calls to the backend announcement endpoints
 * Endpoint: /announcement
 */

import { axiosRequest } from '../../packages-core-adapter';

const ACTIVE_ANNOUNCEMENTS_CACHE_TTL_MS = 30_000;

let activeAnnouncementsCache = null;
let activeAnnouncementsCacheAt = 0;
let activeAnnouncementsInFlight = null;

export const clearActiveAnnouncementsCache = () => {
  activeAnnouncementsCache = null;
  activeAnnouncementsCacheAt = 0;
  activeAnnouncementsInFlight = null;
};

/**
 * Fetch all active announcements (publicly accessible)
 * @returns {Promise<Array>} Array of announcements
 */
export const fetchActiveAnnouncements = async (options = {}) => {
  const force = Boolean(options?.force);
  const now = Date.now();

  if (!force && activeAnnouncementsCache && now - activeAnnouncementsCacheAt < ACTIVE_ANNOUNCEMENTS_CACHE_TTL_MS) {
    return activeAnnouncementsCache;
  }

  if (!force && activeAnnouncementsInFlight) {
    return activeAnnouncementsInFlight;
  }

  try {
    activeAnnouncementsInFlight = axiosRequest.get('/announcement')
      .then((response) => {
        const data = response.data.data || [];
        activeAnnouncementsCache = data;
        activeAnnouncementsCacheAt = Date.now();
        return data;
      })
      .finally(() => {
        activeAnnouncementsInFlight = null;
      });

    return await activeAnnouncementsInFlight;
  } catch (err) {
    console.error('Failed to fetch announcements:', err);
    throw err;
  }
};

/**
 * Fetch a single announcement by ID
 * @param {string|number} id - Announcement ID
 * @returns {Promise<Object>} Announcement object
 */
export const fetchAnnouncementById = async (id) => {
  try {
    const response = await axiosRequest.get(`/announcement/${id}`);
    return response.data.data;
  } catch (err) {
    console.error(`Failed to fetch announcement ${id}:`, err);
    throw err;
  }
};

/**
 * Create a new announcement (Staff only)
 * @param {Object} data - Announcement data
 * @param {string} data.label - Announcement title
 * @param {string} data.description - Announcement description
 * @param {string} [data.pubmat] - Public material UUID/filename
 * @param {boolean} [data.isActive=true] - Whether announcement is active
 * @param {string|null} [data.viewableUntil] - ISO date-time until visible; null for indefinite visibility
 * @returns {Promise<Object>} Created announcement object
 */
export const createAnnouncement = async (data) => {
  try {
    const response = await axiosRequest.post('/announcement', data);
    clearActiveAnnouncementsCache();
    return response.data.data;
  } catch (err) {
    console.error('Failed to create announcement:', err);
    throw err;
  }
};

/**
 * Update an existing announcement (Staff only)
 * @param {string|number} id - Announcement ID
 * @param {Object} data - Partial announcement data to update
 * @param {string|null} [data.viewableUntil] - ISO date-time until visible; null clears to indefinite visibility
 * @returns {Promise<Object>} Updated announcement object
 */
export const updateAnnouncement = async (id, data) => {
  try {
    const response = await axiosRequest.put(`/announcement/${id}`, data);
    clearActiveAnnouncementsCache();
    return response.data.data;
  } catch (err) {
    console.error(`Failed to update announcement ${id}:`, err);
    throw err;
  }
};

/**
 * Delete an announcement (Staff only)
 * @param {string|number} id - Announcement ID
 * @returns {Promise<Object>} Response data
 */
export const deleteAnnouncement = async (id) => {
  try {
    const response = await axiosRequest.delete(`/announcement/${id}`);
    clearActiveAnnouncementsCache();
    return response.data;
  } catch (err) {
    console.error(`Failed to delete announcement ${id}:`, err);
    throw err;
  }
};

/**
 * Fetch all announcements including inactive (Staff only - Admin)
 * @param {string} [location] - Optional location filter ('Manila', 'QuezonCity', 'Both')
 * @returns {Promise<{data: Array, branch: string}>} Announcements and user's permission branch
 */
export const fetchAllAnnouncementsAdmin = async (location) => {
  try {
    const params = location ? { location } : {};
    const response = await axiosRequest.get('/announcement/admin/all', { params });
    return { data: response.data.data || [], branch: response.data.branch || 'Both' };
  } catch (err) {
    console.error('Failed to fetch all announcements:', err);
    throw err;
  }
};

/**
 * Upload an image/file to staging for use as pubmat
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The staged fileId (UUID)
 */
export const uploadPubmat = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosRequest.post('/media/stage/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.fileId;
};
