import { Platform } from 'react-native';

type EnvSource = Record<string, string | undefined>;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export interface MobileAuthFeatureConfig {
  googleOAuthEnabled: boolean;
  googleOAuthConfigured: boolean;
  googleOAuthAvailable: boolean;
  googleOAuthClientId: string;
  googleOAuthStatusMessage: string | null;
  recaptchaEnabled: boolean;
  recaptchaConfigured: boolean;
  recaptchaAvailable: boolean;
  recaptchaToken: string;
  recaptchaStatusMessage: string | null;
}

export function parseBooleanEnv(value: string | undefined, defaultValue = false): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

function resolveGoogleClientId(env: EnvSource, platform: string): string {
  const genericClientId = String(env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

  if (platform === 'ios') {
    return String(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? genericClientId).trim();
  }

  if (platform === 'android') {
    return String(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? genericClientId).trim();
  }

  return genericClientId;
}

export function resolveMobileAuthFeatureConfig(
  env: EnvSource = process.env as EnvSource,
  platform: string = Platform.OS
): MobileAuthFeatureConfig {
  const googleOAuthEnabled = parseBooleanEnv(env.EXPO_PUBLIC_ENABLE_GOOGLE_OAUTH, false);
  const googleOAuthClientId = resolveGoogleClientId(env, platform);
  const googleOAuthConfigured = googleOAuthClientId.length > 0;
  const googleOAuthAvailable = googleOAuthEnabled && googleOAuthConfigured;

  const recaptchaEnabled = parseBooleanEnv(env.EXPO_PUBLIC_ENABLE_RECAPTCHA, false);
  const recaptchaToken = String(env.EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET ?? '').trim();
  const recaptchaConfigured = recaptchaToken.length > 0;
  const recaptchaAvailable = recaptchaEnabled && recaptchaConfigured;

  return {
    googleOAuthEnabled,
    googleOAuthConfigured,
    googleOAuthAvailable,
    googleOAuthClientId,
    googleOAuthStatusMessage: !googleOAuthEnabled
      ? 'Google sign-in is disabled for this build.'
      : !googleOAuthConfigured
        ? 'Google sign-in is enabled, but no Google client ID is configured.'
        : null,
    recaptchaEnabled,
    recaptchaConfigured,
    recaptchaAvailable,
    recaptchaToken,
    recaptchaStatusMessage: !recaptchaEnabled
      ? 'reCAPTCHA is disabled for this build.'
      : !recaptchaConfigured
        ? 'reCAPTCHA is enabled, but no mobile secret is configured.'
        : null,
  };
}

export const mobileAuthFeatureConfig = resolveMobileAuthFeatureConfig();

export function withOptionalRecaptcha<T extends Record<string, unknown>>(
  payload: T,
  config: MobileAuthFeatureConfig = mobileAuthFeatureConfig
): T & { recaptchaToken?: string } {
  if (!config.recaptchaAvailable) {
    return payload;
  }

  return {
    ...payload,
    recaptchaToken: config.recaptchaToken,
  };
}

export function getAuthFeatureNotices(
  {
    includeGoogleOAuth = false,
    includeRecaptcha = false,
  }: {
    includeGoogleOAuth?: boolean;
    includeRecaptcha?: boolean;
  },
  config: MobileAuthFeatureConfig = mobileAuthFeatureConfig
): string[] {
  const notices: string[] = [];

  if (includeGoogleOAuth && config.googleOAuthStatusMessage) {
    notices.push(config.googleOAuthStatusMessage);
  }

  if (includeRecaptcha && config.recaptchaStatusMessage) {
    notices.push(config.recaptchaStatusMessage);
  }

  return notices;
}
