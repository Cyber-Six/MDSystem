import {
  getAuthFeatureNotices,
  resolveMobileAuthFeatureConfig,
  withOptionalRecaptcha,
} from '../config/authFeatures';

describe('mobile auth feature flags', () => {
  it('defaults Google OAuth and reCAPTCHA to disabled', () => {
    const config = resolveMobileAuthFeatureConfig({}, 'android');

    expect(config.googleOAuthEnabled).toBe(false);
    expect(config.googleOAuthConfigured).toBe(false);
    expect(config.googleOAuthAvailable).toBe(false);
    expect(config.googleOAuthStatusMessage).toBeNull();
    expect(config.recaptchaEnabled).toBe(false);
    expect(config.recaptchaConfigured).toBe(false);
    expect(config.recaptchaAvailable).toBe(false);
    expect(config.recaptchaStatusMessage).toBeNull();
  });

  it('only enables Google OAuth when both the flag and client ID are present', () => {
    const config = resolveMobileAuthFeatureConfig(
      {
        EXPO_PUBLIC_ENABLE_GOOGLE_OAUTH: 'true',
        EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: 'android-client-id',
      },
      'android'
    );

    expect(config.googleOAuthEnabled).toBe(true);
    expect(config.googleOAuthConfigured).toBe(true);
    expect(config.googleOAuthAvailable).toBe(true);
    expect(config.googleOAuthClientId).toBe('android-client-id');
    expect(config.googleOAuthStatusMessage).toBeNull();
  });

  it('only attaches the recaptcha token when the feature is available', () => {
    const disabledConfig = resolveMobileAuthFeatureConfig({}, 'android');
    const enabledConfig = resolveMobileAuthFeatureConfig(
      {
        EXPO_PUBLIC_ENABLE_RECAPTCHA: 'true',
        EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET: 'shared-mobile-secret',
      },
      'android'
    );

    expect(withOptionalRecaptcha({ email: 'sample@tip.edu.ph' }, disabledConfig)).toEqual({
      email: 'sample@tip.edu.ph',
    });
    expect(withOptionalRecaptcha({ email: 'sample@tip.edu.ph' }, enabledConfig)).toEqual({
      email: 'sample@tip.edu.ph',
      recaptchaToken: 'shared-mobile-secret',
    });
  });

  it('does not return UI notices for disabled features', () => {
    const config = resolveMobileAuthFeatureConfig({}, 'android');

    expect(
      getAuthFeatureNotices(
        {
          includeGoogleOAuth: true,
          includeRecaptcha: true,
        },
        config
      )
    ).toEqual([]);
  });

  it('does not return UI notices for enabled but unconfigured features', () => {
    const config = resolveMobileAuthFeatureConfig(
      {
        EXPO_PUBLIC_ENABLE_GOOGLE_OAUTH: 'true',
        EXPO_PUBLIC_ENABLE_RECAPTCHA: 'true',
      },
      'android'
    );

    expect(
      getAuthFeatureNotices(
        {
          includeGoogleOAuth: true,
          includeRecaptcha: true,
        },
        config
      )
    ).toEqual([]);
  });
});
