/**
 * Announcement Service
 * Handles REST API calls to the backend announcement endpoints
 * Endpoint: GET /info/announcement
 */

import { axiosRequest } from '../../packages-core-adapter';

/**
 * Fetch all active announcements (publicly accessible)
 * @returns {Promise<Array>} Array of announcements
 */
export const fetchActiveAnnouncements = async () => {
  try {
    const response = await axiosRequest.get('/info/announcement');
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
    const response = await axiosRequest.get(`/info/announcement/${id}`);
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
    const response = await axiosRequest.post('/info/announcement', data);
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
    const response = await axiosRequest.put(`/info/announcement/${id}`, data);
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
    const response = await axiosRequest.delete(`/info/announcement/${id}`);
    return response.data;
  } catch (err) {
    console.error(`Failed to delete announcement ${id}:`, err);
    throw err;
  }
};

/**
 * Fetch all announcements including inactive (Staff only - Admin)
 * @returns {Promise<Array>} Array of all announcements
 */
export const fetchAllAnnouncementsAdmin = async () => {
  try {
    const response = await axiosRequest.get('/info/announcement/admin/all');
    return response.data.data || [];
  } catch (err) {
    console.error('Failed to fetch all announcements:', err);
    throw err;
  }
};
