jest.mock('./components/announcement-carousel', () => ({ __esModule: true, default: jest.fn(() => null) }));
jest.mock('./components/announcement-modal', () => ({ __esModule: true, default: jest.fn(() => null) }));
jest.mock('./components/announcement-management', () => ({ __esModule: true, default: jest.fn(() => null) }));
jest.mock('./announcement-service', () => ({ fetchActiveAnnouncements: jest.fn() }));
jest.mock('./timezoneUtils', () => ({ toUTC: jest.fn() }));

import * as announcementService from './announcement-service';
import * as timezoneUtils from './timezoneUtils';
import AnnouncementCarousel from './components/announcement-carousel';
import AnnouncementModal from './components/announcement-modal';
import AnnouncementManagement from './components/announcement-management';
import {
  AnnouncementCarousel as ExportedCarousel,
  AnnouncementManagement as ExportedManagement,
  AnnouncementModal as ExportedModal,
  fetchActiveAnnouncements,
  toUTC,
} from './index';

describe('staff announcement module entry point', () => {
  it('re-exports components, service methods, and timezone utilities', () => {
    expect(ExportedCarousel).toBe(AnnouncementCarousel);
    expect(ExportedModal).toBe(AnnouncementModal);
    expect(ExportedManagement).toBe(AnnouncementManagement);
    expect(fetchActiveAnnouncements).toBe(announcementService.fetchActiveAnnouncements);
    expect(toUTC).toBe(timezoneUtils.toUTC);
  });
});
