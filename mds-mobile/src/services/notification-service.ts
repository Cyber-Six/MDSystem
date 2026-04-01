/**
 * Notification Service
 * Manages local push notifications via expo-notifications.
 * Used to alert users of health chat messages when not on the chat screen.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AxiosInstance } from 'axios';

// Configure how notifications display when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions from the user.
 * Must be called before scheduling any notification.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Emulator — permissions may not work, but we allow it
    console.warn('[Notifications] Running on emulator — notifications may not display.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Set up the Android notification channel (required for Android 8+).
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('health-chat', {
      name: 'Health Chat',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F1C526',
      sound: 'default',
    });
  }
}

/**
 * Show a local notification for a health chat message.
 */
export async function showHealthChatNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { type: 'health-chat', ...data },
      ...(Platform.OS === 'android' ? { channelId: 'health-chat' } : {}),
    },
    trigger: null, // Show immediately
  });
}

/**
 * Add a listener for notification taps (user presses notification).
 * Returns cleanup function.
 */
export function onNotificationResponse(
  handler: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

// ── Expo Push Token (remote notifications when app is closed) ─────────────────

/**
 * Get the Expo push token for this device.
 * Returns null on emulators or if EAS project ID is missing.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Emulators have no push token
    return null;
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      console.warn('[Notifications] No EAS project ID found in app config — skipping push token.');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err: any) {
    console.warn('[Notifications] Failed to get Expo push token:', err.message);
    return null;
  }
}

/**
 * Register the Expo push token with the backend so it can send remote pushes
 * while the app is fully closed.
 */
export async function registerPushToken(token: string, axiosInstance: AxiosInstance): Promise<void> {
  try {
    await axiosInstance.post('/auth/push-token', { token });
  } catch (err: any) {
    console.warn('[Notifications] Failed to register push token with backend:', err.message);
  }
}

/**
 * Unregister the push token from the backend (call on logout).
 */
export async function unregisterPushToken(axiosInstance: AxiosInstance): Promise<void> {
  try {
    await axiosInstance.delete('/auth/push-token');
  } catch (err: any) {
    console.warn('[Notifications] Failed to unregister push token:', err.message);
  }
}
