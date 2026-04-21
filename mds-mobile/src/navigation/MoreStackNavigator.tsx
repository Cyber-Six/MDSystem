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

const returnToLeftPanel = (navigation: any) => {
  const drawerNavigation = navigation.getParent?.();
  if (drawerNavigation) {
    drawerNavigation.navigate('MainTabs', { screen: 'Home' });
    return;
  }
  navigation.navigate('MainTabs', { screen: 'Home' });
};

const HeaderBackButton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={styles.headerBackButton}
      onPress={() => returnToLeftPanel(navigation)}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <Ionicons
        name="chevron-back"
        size={22}
        color={isDark ? colors.neutral[100] : colors.secondary[900]}
      />
    </TouchableOpacity>
  );
};

export const MoreStackNavigator: React.FC = () => {
  const { isDark } = useTheme();

  const baseSubScreenOptions = {
    headerShown: true,
    headerBackTitle: 'Back',
    headerStyle: {
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    },
    headerTintColor: isDark ? colors.neutral[100] : colors.secondary[900],
    headerShadowVisible: false,
    headerRight: () => null,
  };

  const leftPanelScreenOptions = {
    ...baseSubScreenOptions,
    headerLeft: () => <HeaderBackButton isDark={isDark} />,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ ...leftPanelScreenOptions, title: 'Profile' }}
      />
      <Stack.Screen name="MedicineRequest" component={MedicineRequestScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ ...leftPanelScreenOptions, title: 'Settings' }}
      />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ ...baseSubScreenOptions, title: 'Change Password' }} />
      <Stack.Screen name="LoginActivity" component={LoginActivityScreen} options={{ ...baseSubScreenOptions, title: 'Login Activity' }} />
      <Stack.Screen name="FAQs" component={FAQsScreen} options={{ ...leftPanelScreenOptions, title: 'FAQs' }} />
      <Stack.Screen name="InitialRecordForm" component={InitialRecordFormScreen} options={{ ...baseSubScreenOptions, title: 'Record Form' }} />
      <Stack.Screen name="UpdateRecordChoice" component={UpdateRecordChoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ ...leftPanelScreenOptions, title: 'Announcements' }} />
      <Stack.Screen name="MyDocuments" component={MyDocumentsScreen} options={{ ...leftPanelScreenOptions, title: 'My Documents' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
});

export default MoreStackNavigator;
