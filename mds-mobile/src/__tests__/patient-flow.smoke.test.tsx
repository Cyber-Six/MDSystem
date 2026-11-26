import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { axiosRequest, getNavigationRef, TokenStorage } from '../core';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { HealthChatNotificationProvider } from '../context/HealthChatNotificationProvider';
import { ThemeProvider } from '../context/ThemeContext';
import { AppointmentScreen } from '../screens/appointment/AppointmentScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';

jest.mock('../core', () => ({
  axiosRequest: { post: jest.fn() },
  TokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
  },
  registerSessionExpiredCallback: jest.fn(),
  getNavigationRef: jest.fn(),
}));
jest.mock('@mdsystem/core/services/socket-service', () => ({
  createSocketService: () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    on: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({}) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'View' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('../components/auth/GoogleSignInSection', () => ({ GoogleSignInSection: () => null }));
jest.mock('../components/layout/TopBar', () => ({ TopBar: () => null }));
jest.mock('../navigation/drawer-utils', () => ({ toggleAppDrawer: jest.fn() }));
jest.mock('../services/profile-service', () => ({ clearProfileCache: jest.fn() }));
jest.mock('../context/RecordStatusContext', () => ({
  useRecordStatus: () => ({ recordStatus: { credentialStatus: 'Active' }, isRecordLoading: false }),
}));
jest.mock('../context/SettingsContext', () => ({ useSettings: () => ({ settings: {} }) }));

function PatientScreens() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <LoginScreen onNavigateToRegister={jest.fn()} onLoginSuccess={jest.fn()} />;
  }
  return (
    <HealthChatNotificationProvider>
      <AppointmentScreen />
    </HealthChatNotificationProvider>
  );
}

afterEach(() => jest.useRealTimers());

test('a patient signs in, books an appointment, and opens its push notification', async () => {
  jest.useFakeTimers({
    now: new Date(2026, 5, 15, 12),
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
      'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
    ],
  });
  const date = '2026-06-16';
  const schedulerId = 'clinic-1';
  const appointment = { id: 'appointment-1', status: 'Pending' };
  const slot = {
    scheduledDate: date,
    morningAllowed: 2, morningRegistered: 0, morningPending: 0,
    afternoonAllowed: 0, afternoonRegistered: 0, afternoonPending: 0,
  };
  let booked = false;
  const post = jest.mocked(axiosRequest.post);
  post.mockImplementation(async (url, body) => {
    switch (url) {
      case '/auth/login':
        return { data: { ok: true, LoginKey: 'login-key' } };
      case '/auth/login/complete':
        return { data: { ok: true, accessToken: 'access-token', refreshToken: 'refresh-token' } };
      case '/auth/push-token':
        return { data: { ok: true } };
      case '/appointment/patient': {
        const field = body.query.match(/\{\s*(\w+)/)?.[1];
        const data = {
          getAppointmentStatus: booked ? appointment : null,
          listOpenAppointments: [{
            id: schedulerId, label: 'Clinic Consultation', location: 'Manila', schedulePerWeek: ['Tuesday'],
          }],
          listMonthAvailability: [slot],
          listAppointmentSchedule: slot,
          listAppointmentRequirements: [],
          submitAppointment: appointment,
        };
        if (!field || !(field in data)) throw new Error(`Unexpected GraphQL operation: ${field}`);
        if (field === 'submitAppointment') booked = true;
        return { data: { data: { [field]: data[field as keyof typeof data] } } };
      }
      default:
        throw new Error(`Unexpected patient API request: ${url}`);
    }
  });
  jest.mocked(TokenStorage.setTokens).mockImplementation(async access => {
    jest.mocked(TokenStorage.getAccessToken).mockResolvedValue(access);
  });
  const pushToken = 'ExponentPushToken[patient-smoke]';
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
    { status: 'granted' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
  );
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: pushToken });
  const remove = jest.fn();
  const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener);
  listener.mockReturnValue({ remove } as ReturnType<typeof listener>);
  const navigate = jest.fn();
  jest.mocked(getNavigationRef).mockReturnValue({ navigate } as ReturnType<typeof getNavigationRef>);

  const app = render(
    <ThemeProvider>
      <AuthProvider><PatientScreens /></AuthProvider>
    </ThemeProvider>,
  );
  fireEvent.changeText(await screen.findByPlaceholderText('your.email@tip.edu.ph'), 'patient@tip.edu.ph');
  fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'patient-password');
  fireEvent.press(screen.getByText('Sign In'));
  fireEvent.press(await screen.findByText('Clinic Consultation'));
  fireEvent.press(screen.getByText('16'));
  fireEvent.press(await screen.findByText('Morning'));
  fireEvent.press(screen.getByText('Next ›'));
  fireEvent.press(await screen.findByText('Submit Appointment'));
  expect(await screen.findByText('Your appointment has been submitted successfully!')).toBeOnTheScreen();
  expect(await screen.findByText('Pending')).toBeOnTheScreen();

  expect(post).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
    email: 'patient@tip.edu.ph', password: 'patient-password',
  }));
  expect(post).toHaveBeenCalledWith('/auth/login/complete', { LoginKey: 'login-key' });
  expect(TokenStorage.setTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
  expect(post).toHaveBeenCalledWith('/appointment/patient', {
    query: expect.stringContaining('mutation SubmitAppointment'),
    variables: { schedulerId, date, session: 'Morning', requirements: [], purpose: null },
  });
  await waitFor(() => {
    expect(post).toHaveBeenCalledWith('/auth/push-token', { token: pushToken });
  });
  const [onResponse] = listener.mock.calls[0];
  act(() => {
    onResponse({
      notification: { request: { identifier: 'appointment-update', content: { data: { type: 'appointment' } } } },
    } as Notifications.NotificationResponse);
  });
  expect(navigate).toHaveBeenCalledWith('MainTabs', { screen: 'Appointments', params: undefined });
  app.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
