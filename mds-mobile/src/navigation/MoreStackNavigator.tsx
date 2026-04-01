/**
 * More Stack Navigator
 * Stack navigator for the "More" tab: Menu → Profile, ChangePassword, etc.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { MoreMenuScreen } from '../screens/more/MoreMenuScreen';
import { ProfileScreen } from '../screens/more/ProfileScreen';
import { ChangePasswordScreen } from '../screens/more/ChangePasswordScreen';
import { LoginActivityScreen } from '../screens/more/LoginActivityScreen';
import { FAQsScreen } from '../screens/more/FAQsScreen';
import { SettingsScreen } from '../screens/more/SettingsScreen';
import { MedicineRequestScreen } from '../screens/medicine/MedicineRequestScreen';
import { MyDocumentsScreen } from '../screens/more/MyDocumentsScreen';
import InitialRecordFormScreen from '../screens/record-forms/InitialRecordFormScreen';
import UpdateRecordChoiceScreen from '../screens/record-forms/UpdateRecordChoiceScreen';
import { AnnouncementsScreen } from '../screens/more/AnnouncementsScreen';

import { useTheme, colors } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export const MoreStackNavigator: React.FC = () => {
  const { isDark } = useTheme();

  const subScreenOptions = {
    headerShown: true,
    headerBackTitle: 'Back',
    headerStyle: {
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    },
    headerTintColor: isDark ? colors.neutral[100] : colors.secondary[900],
    headerShadowVisible: false,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ ...subScreenOptions, title: 'Profile' }} />
      <Stack.Screen name="MedicineRequest" component={MedicineRequestScreen} options={{ ...subScreenOptions, title: 'Medicine Request' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...subScreenOptions, title: 'Settings' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ ...subScreenOptions, title: 'Change Password' }} />
      <Stack.Screen name="LoginActivity" component={LoginActivityScreen} options={{ ...subScreenOptions, title: 'Login Activity' }} />
      <Stack.Screen name="FAQs" component={FAQsScreen} options={{ ...subScreenOptions, title: 'FAQs' }} />
      <Stack.Screen name="InitialRecordForm" component={InitialRecordFormScreen} options={{ ...subScreenOptions, title: 'Medical Record' }} />
      <Stack.Screen name="UpdateRecordChoice" component={UpdateRecordChoiceScreen} options={{ ...subScreenOptions, title: 'Update Record' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ ...subScreenOptions, title: 'Announcements' }} />
      <Stack.Screen name="MyDocuments" component={MyDocumentsScreen} options={{ ...subScreenOptions, title: 'My Documents' }} />
    </Stack.Navigator>
  );
};

export default MoreStackNavigator;
