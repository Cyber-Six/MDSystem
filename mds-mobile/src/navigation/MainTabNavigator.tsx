/**
 * Main Tab Navigator
 * Bottom tab navigation: Home, Appointments, Health Chat, Medicine, Records
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { DashboardHomeScreen } from '../screens/dashboard/DashboardHomeScreen';
import { AppointmentScreen } from '../screens/appointment/AppointmentScreen';
import { HealthChatScreen } from '../screens/health-chat/HealthChatScreen';
import { MedicineRequestScreen } from '../screens/medicine/MedicineRequestScreen';
import { RecordsStackNavigator } from './RecordsStackNavigator';
import { useTheme, colors } from '../context/ThemeContext';
import PendingRecordGate from '../components/PendingRecordGate';
import { useHealthChatBadge } from '../context/HealthChatNotificationProvider';
import { useRecordStatus } from '../context/RecordStatusContext';
import { getMedicineStatus } from '../services/medicine-service';
import { BottomTabBar } from '../components/layout/BottomTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Wrap screens that should be gated behind initial-record approval
const GatedAppointmentScreen = (props: any) => (
  <PendingRecordGate><AppointmentScreen {...props} /></PendingRecordGate>
);

const GatedHealthChatScreen = (props: any) => (
  <PendingRecordGate><HealthChatScreen {...props} /></PendingRecordGate>
);

const GatedMedicineScreen = (props: any) => (
  <PendingRecordGate><MedicineRequestScreen {...props} /></PendingRecordGate>
);

const countPendingMedicineRequests = (requests: Array<{ status?: string }>) => {
  return requests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length;
};

export const MainTabNavigator: React.FC = () => {
  const { isDark } = useTheme();
  const { badgeCount } = useHealthChatBadge();
  const { isRecordLoading, recordStatus } = useRecordStatus();
  const [medicinePendingCount, setMedicinePendingCount] = useState(0);

  const normalizedRecordStatus = String(recordStatus?.status || '').toLowerCase();
  const isAwaitingInitialApproval =
    normalizedRecordStatus === 'pending'
    || normalizedRecordStatus === 'revisionsubmitted'
    || normalizedRecordStatus === 'underreview'
    || normalizedRecordStatus === 'in review';
  const isInitialFormOnlyMode = Boolean(recordStatus?.needsInitialRecord) && !isAwaitingInitialApproval;
  const shouldSkipMedicinePolling = isRecordLoading
    || !recordStatus
    || (recordStatus.credentialStatus == null && recordStatus.status == null)
    || isInitialFormOnlyMode
    || recordStatus.credentialStatus === 'Inactive'
    || recordStatus.credentialStatus === 'Unverified';
  const isRevisionInitialForm = normalizedRecordStatus === 'revision';

  const loadMedicinePendingCount = useCallback(async () => {
    try {
      const requests = await getMedicineStatus();
      setMedicinePendingCount(countPendingMedicineRequests(requests || []));
    } catch {
      setMedicinePendingCount(0);
    }
  }, []);

  useEffect(() => {
    if (shouldSkipMedicinePolling) {
      setMedicinePendingCount(0);
      return;
    }

    loadMedicinePendingCount();

    const timer = setInterval(() => {
      loadMedicinePendingCount();
    }, 45000);

    return () => clearInterval(timer);
  }, [shouldSkipMedicinePolling, loadMedicinePendingCount]);

  if (isRecordLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 10, color: isDark ? colors.neutral[400] : colors.neutral[600] }}>
          Loading navigation...
        </Text>
      </View>
    );
  }

  return (
    <Tab.Navigator
      key={isInitialFormOnlyMode ? 'initial-record-only' : 'full-access'}
      initialRouteName={isInitialFormOnlyMode ? 'Records' : 'Home'}
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        <BottomTabBar
          {...props}
          badgeCounts={{
            HealthChat: badgeCount,
            Medicine: medicinePendingCount,
          }}
        />
      )}
    >
      {isInitialFormOnlyMode ? (
        <Tab.Screen
          name="Records"
          component={RecordsStackNavigator}
          initialParams={{
            screen: 'InitialRecordForm',
            params: { isRevision: isRevisionInitialForm },
          }}
          options={{
            tabBarLabel: 'Initial Form',
          }}
        />
      ) : (
        <>
          <Tab.Screen
            name="Home"
            component={DashboardHomeScreen}
          />
          <Tab.Screen
            name="Appointments"
            component={GatedAppointmentScreen}
          />
          <Tab.Screen
            name="HealthChat"
            component={GatedHealthChatScreen}
          />
          <Tab.Screen
            name="Medicine"
            component={GatedMedicineScreen}
          />
          <Tab.Screen
            name="Records"
            component={RecordsStackNavigator}
          />
        </>
      )}
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
