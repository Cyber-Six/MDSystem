/**
 * Main Tab Navigator
 * Bottom tab navigation: Home, Appointments, HealthChat, Medicine, More
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { MainTabParamList } from './types';
import { DashboardHomeScreen } from '../screens/dashboard/DashboardHomeScreen';
import { AppointmentScreen } from '../screens/appointment/AppointmentScreen';
import { HealthChatScreen } from '../screens/health-chat/HealthChatScreen';
import InitialRecordFormScreen from '../screens/record-forms/InitialRecordFormScreen';
import { MoreStackNavigator } from './MoreStackNavigator';
import { useTheme, colors } from '../context/ThemeContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{ icon: string; focused: boolean }> = ({
  icon,
  focused,
}) => (
  <View
    style={[
      styles.iconContainer,
      focused && styles.iconContainerFocused,
    ]}
  >
    <Text style={[styles.icon, focused && styles.iconFocused]}>{icon}</Text>
  </View>
);

export const MainTabNavigator: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
          borderTopColor: isDark ? colors.neutral[800] : colors.neutral[200],
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: isDark
          ? colors.neutral[500]
          : colors.neutral[400],
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardHomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentScreen}
        options={{
          tabBarLabel: 'Appointments',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📅" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="HealthChat"
        component={HealthChatScreen}
        options={{
          tabBarLabel: 'Health Chat',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Records"
        component={InitialRecordFormScreen}
        options={{
          tabBarLabel: 'Records',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📋" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="☰" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
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
  icon: {
    fontSize: 18,
  },
  iconFocused: {
    fontSize: 20,
  },
});

export default MainTabNavigator;
