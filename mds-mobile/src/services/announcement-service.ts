/**
 * Announcement Service - Read-only REST API
 * Mirrors mds-patient/src/modules/anouncement/announcement-service.js
 * Endpoint: /announcement
 */

import { axiosRequest } from '../core';

export interface Announcement {
  id: string;
  label: string;          // backend aliases title column as 'label'
  description: string;
  pubmat?: string;        // file UUID for announcement image; fetch via /media/record/announcement/:pubmat
  created_at: string;
  updated_at?: string;
}

export const fetchActiveAnnouncements = async (): Promise<Announcement[]> => {
  const response = await axiosRequest.get('/announcement');
  return response.data.data || [];
};

export const fetchAnnouncementById = async (id: string): Promise<Announcement> => {
  const response = await axiosRequest.get(`/announcement/${id}`);
  return response.data.data;
};
