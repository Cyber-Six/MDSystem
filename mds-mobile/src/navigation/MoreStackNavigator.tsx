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
import InitialRecordFormScreen from '../screens/record-forms/InitialRecordFormScreen';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export const MoreStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="LoginActivity" component={LoginActivityScreen} />
      <Stack.Screen name="FAQs" component={FAQsScreen} />
      <Stack.Screen name="InitialRecordForm" component={InitialRecordFormScreen} />
    </Stack.Navigator>
  );
};

export default MoreStackNavigator;
