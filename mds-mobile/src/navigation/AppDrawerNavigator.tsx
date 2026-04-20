/**
 * App Drawer Navigator
 * Sidebar contains only secondary pages not duplicated in the bottom tabs.
 */

import React, { useEffect, useState } from 'react';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { MainTabNavigator } from './MainTabNavigator';
import { MoreStackNavigator } from './MoreStackNavigator';
import { AppDrawerParamList } from './types';
import { useTheme, colors } from '../context/ThemeContext';
import { DrawerMenu } from '../components/layout/DrawerMenu';
import { getPatientProfile } from '../services/profile-service';
import { unregisterPushToken } from '../services/notification-service';
import { useAuth } from '../context/AuthContext';
import { useRecordStatus } from '../context/RecordStatusContext';
import { axiosRequest, logout } from '../core';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

type DrawerContentProps = DrawerContentComponentProps & {
  showMyDocuments: boolean;
};

const DrawerContent: React.FC<DrawerContentProps> = ({ showMyDocuments, ...props }) => {
  const { setAuthenticated } = useAuth();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;

    getPatientProfile()
      .then((profile) => {
        if (!mounted) return;
        setUserName(profile?.name || profile?.firstName || '');
        setUserEmail(profile?.email || '');
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await unregisterPushToken(axiosRequest);
      await logout();
    } catch {
      // If sign-out cleanup fails, force logout state anyway.
    }
    setAuthenticated(false);
  };

  return (
    <DrawerMenu
      {...props}
      userName={userName}
      userEmail={userEmail}
      onSignOut={handleSignOut}
      showMyDocuments={showMyDocuments}
    />
  );
};

export const AppDrawerNavigator: React.FC = () => {
  const { isDark } = useTheme();
  const { recordStatus } = useRecordStatus();

  const normalizedRecordStatus = String(recordStatus?.status || '').toLowerCase();
  const isAwaitingInitialApproval =
    normalizedRecordStatus === 'pending'
    || normalizedRecordStatus === 'revisionsubmitted'
    || normalizedRecordStatus === 'underreview'
    || normalizedRecordStatus === 'in review';
  const isInitialFormOnlyMode = Boolean(recordStatus?.needsInitialRecord) && !isAwaitingInitialApproval;
  const showMyDocuments = !isInitialFormOnlyMode;

  return (
    <Drawer.Navigator
      initialRouteName="MainTabs"
      drawerContent={(props) => <DrawerContent {...props} showMyDocuments={showMyDocuments} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.45)',
        swipeEnabled: !isInitialFormOnlyMode,
        drawerStyle: {
          width: 302,
          backgroundColor: isDark ? colors.secondary[900] : colors.neutral[50],
        },
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ swipeEnabled: !isInitialFormOnlyMode }}
      />
      <Drawer.Screen
        name="MoreStack"
        component={MoreStackNavigator}
        options={{ swipeEnabled: false }}
      />
    </Drawer.Navigator>
  );
};

export default AppDrawerNavigator;
