const path = require('path');
const dotenv = require('dotenv');
const { version } = require('./package.json');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

process.env.EXPO_PUBLIC_APP_ENV =
  process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'development';
process.env.EXPO_PUBLIC_APP_VERSION =
  process.env.EXPO_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? version;
process.env.EXPO_PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_API_URL
  ?? process.env.API_URL
  ?? process.env.VITE_PATIENT_BACKEND_URL
  ?? process.env.VITE_BACKEND_URL
  ?? 'https://www.mdsystemtip.space';
process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  ?? process.env.GOOGLE_CLIENT_ID
  ?? process.env.VITE_GOOGLE_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_MOBILE_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_WEB_CLIENT_ID
  ?? '';
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_MOBILE_IOS_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_MOBILE_CLIENT_ID
  ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  ?? '';
process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_MOBILE_ANDROID_CLIENT_ID
  ?? process.env.SHARED_GOOGLE_MOBILE_CLIENT_ID
  ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  ?? '';
process.env.EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET =
  process.env.EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET
  ?? process.env.RECAPTCHA_MOBILE_SECRET
  ?? process.env.SHARED_RECAPTCHA_MOBILE_SECRET
  ?? '';

module.exports = ({ config }) => ({
  ...config,

  // ── Identity ──────────────────────────────────────────────────────────────
  name: 'MDSystem',
  slug: 'mds-mobile',
  version,

  // ── Display ───────────────────────────────────────────────────────────────
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  // ── Icons (MDSystem brand) ─────────────────────────────────────────────────
  icon: './assets/MDSystem.png',

  splash: {
    image: './assets/MDSystem.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  // ── Platform Config ───────────────────────────────────────────────────────
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mdsystem.mdsmobile',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/MDSystem.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'pan',
    predictiveBackGestureEnabled: false,
    package: 'com.mdsystem.mdsmobile',
  },

  web: {
    favicon: './assets/favicon.png',
  },

  // ── Extra / Runtime Config ────────────────────────────────────────────────
  // Values here are accessible via expo-constants: Constants.expoConfig.extra
  // Public env vars (EXPO_PUBLIC_*) are also directly accessible in-app via process.env
  extra: {
    eas: {
      projectId: 'fd8e640c-c5f9-4d72-b714-7888d470eff4',
    },
    appEnv:    process.env.EXPO_PUBLIC_APP_ENV     ?? 'development',
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? version,
    apiUrl:    process.env.EXPO_PUBLIC_API_URL     ?? 'https://www.mdsystemtip.space',
  },

  // ── Plugins ──────────────────────────────────────────────────────────────
  plugins: [
    ['expo-notifications', {
      defaultChannel: 'mds-notifications',
      enableBackgroundRemoteNotifications: true,
    }],
    '@react-native-community/datetimepicker',
    'expo-web-browser',
  ],
});
