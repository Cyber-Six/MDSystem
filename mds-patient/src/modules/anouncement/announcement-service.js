/**
 * Announcement Service - Patient Version (Read-only)
 * Handles REST API calls to fetch announcements only
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
