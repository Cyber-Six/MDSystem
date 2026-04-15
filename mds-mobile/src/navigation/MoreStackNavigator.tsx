/**
 * More Stack Navigator
 * Stack navigator for the "More" tab: Menu → Profile, ChangePassword, etc.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { toggleAppDrawer } from './drawer-utils';

const Stack = createNativeStackNavigator<MoreStackParamList>();

const HeaderMenuButton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={[
        styles.headerMenuButton,
        { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
      ]}
      onPress={() => toggleAppDrawer(navigation)}
      accessibilityRole="button"
      accessibilityLabel="Open sidebar"
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <Ionicons
        name="menu"
        size={22}
        color={isDark ? colors.neutral[100] : colors.secondary[900]}
      />
    </TouchableOpacity>
  );
};

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
    headerRight: () => <HeaderMenuButton isDark={isDark} />,
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
      <Stack.Screen name="InitialRecordForm" component={InitialRecordFormScreen} options={{ ...subScreenOptions, title: 'Record Form' }} />
      <Stack.Screen name="UpdateRecordChoice" component={UpdateRecordChoiceScreen} options={{ ...subScreenOptions, title: 'Update Record' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ ...subScreenOptions, title: 'Announcements' }} />
      <Stack.Screen name="MyDocuments" component={MyDocumentsScreen} options={{ ...subScreenOptions, title: 'My Documents' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});

export default MoreStackNavigator;
