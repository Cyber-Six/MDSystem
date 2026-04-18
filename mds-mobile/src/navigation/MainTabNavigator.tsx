/**
 * Main Tab Navigator
 * Bottom tab navigation: Home, Appointments, HealthChat, Medicine, More
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Platform, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { DashboardHomeScreen } from '../screens/dashboard/DashboardHomeScreen';
import { AppointmentScreen } from '../screens/appointment/AppointmentScreen';
import { HealthChatScreen } from '../screens/health-chat/HealthChatScreen';
import { MedicineRequestScreen } from '../screens/medicine/MedicineRequestScreen';
import { MoreStackNavigator } from './MoreStackNavigator';
import { UpdateRecordStackNavigator } from './UpdateRecordStackNavigator';
import { useTheme, colors } from '../context/ThemeContext';
import PendingRecordGate from '../components/PendingRecordGate';
import { useHealthChatBadge } from '../context/HealthChatNotificationProvider';
import { useRecordStatus } from '../context/RecordStatusContext';

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

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{
  name: string;
  lib?: 'Ionicons' | 'MCI';
  focused: boolean;
  color: string;
}> = ({ name, lib = 'Ionicons', focused, color }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    {lib === 'MCI' ? (
      <MaterialCommunityIcons name={name as any} size={focused ? 22 : 20} color={color} />
    ) : (
      <Ionicons name={name as any} size={focused ? 22 : 20} color={color} />
    )}
  </View>
);

const TabLabel: React.FC<{
  label: string;
  secondLine?: string;
  color: string;
}> = ({ label, secondLine, color }) => (
  <View style={styles.tabLabelContainer}>
    <Text
      style={[styles.tabLabel, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
    >
      {label}
    </Text>
    {secondLine ? (
      <Text
        style={[styles.tabLabel, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {secondLine}
      </Text>
    ) : null}
  </View>
);

export const MainTabNavigator: React.FC = () => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { badgeCount } = useHealthChatBadge();
  const { recordStatus, isRecordLoading } = useRecordStatus();

  const isDomainAccessRestricted =
    Boolean(recordStatus?.needsInitialRecord) || recordStatus?.credentialStatus === 'Inactive';

  if (isRecordLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 10, color: isDark ? colors.neutral[400] : colors.neutral[600] }}>
          Loading navigation...
        </Text>
      </View>
    );
  }

  // On Android, bottom insets can be 0 even with gesture nav. Ensure a minimum.
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      initialRouteName={isDomainAccessRestricted ? 'UpdateRecord' : 'Home'}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
          borderTopColor: isDark ? colors.neutral[800] : colors.neutral[200],
          borderTopWidth: 1,
          height: 62 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: isDark
          ? colors.neutral[500]
          : colors.neutral[400],
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardHomeScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="UpdateRecord"
        component={UpdateRecordStackNavigator}
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="Update" secondLine="Record" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'create' : 'create-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={GatedAppointmentScreen}
        options={{
          ...(isDomainAccessRestricted
            ? { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }
            : {}),
          tabBarLabel: ({ color }) => <TabLabel label="Appointment" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HealthChat"
        component={GatedHealthChatScreen}
        options={{
          ...(isDomainAccessRestricted
            ? { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }
            : {}),
          tabBarLabel: ({ color }) => <TabLabel label="Health" secondLine="Chat" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} color={color} />
          ),
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tab.Screen
        name="Medicine"
        component={GatedMedicineScreen}
        options={{
          ...(isDomainAccessRestricted
            ? { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }
            : {}),
          tabBarLabel: ({ color }) => <TabLabel label="Medicine" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="pill" lib="MCI" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: ({ color }) => <TabLabel label="More" color={color} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(241,197,38,0.12)',
  },
  tabLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default MainTabNavigator;
