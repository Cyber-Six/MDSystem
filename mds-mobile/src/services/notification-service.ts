/**
 * Notification Service
 * Manages local push notifications via expo-notifications.
 * Used to alert users of health chat messages when not on the chat screen.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
