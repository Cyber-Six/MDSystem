/**
 * Announcement Service
 * Handles REST API calls to the backend announcement endpoints
 * Endpoint: /announcement
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * Fetch all active announcements (publicly accessible)
 * @returns {Promise<Array>} Array of announcements
 */
export const fetchActiveAnnouncements = async () => {
  try {
    const response = await axiosRequest.get('/announcement');
    return response.data.data || [];
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
 * @returns {Promise<Object>} Created announcement object
 */
export const createAnnouncement = async (data) => {
  try {
    const response = await axiosRequest.post('/announcement', data);
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
 * @returns {Promise<Object>} Updated announcement object
 */
export const updateAnnouncement = async (id, data) => {
  try {
    const response = await axiosRequest.put(`/announcement/${id}`, data);
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
