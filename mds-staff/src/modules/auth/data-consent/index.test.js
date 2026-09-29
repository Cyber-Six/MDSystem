jest.mock('./data-consent', () => ({ __esModule: true, default: jest.fn(() => null) }));

import DataConsentDefault, { DataConsent } from './index';
import DataConsentComponent from './data-consent';

describe('staff data-consent module entry point', () => {
  it('provides identical default and named component exports', () => {
    expect(DataConsentDefault).toBe(DataConsentComponent);
    expect(DataConsent).toBe(DataConsentComponent);
  });
});
