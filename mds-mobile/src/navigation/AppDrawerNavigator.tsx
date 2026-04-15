/**
 * App Drawer Navigator
 * Sidebar navigation (mirrors mds-patient sidebar modules) + bottom tabs.
 */

import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabNavigator } from './MainTabNavigator';
import { AppDrawerParamList, MainTabParamList } from './types';
import { useTheme, colors } from '../context/ThemeContext';
import { useRecordStatus } from '../context/RecordStatusContext';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

type DrawerItem = {
  key: string;
  label: string;
  iconName: string;
  iconLib?: 'Ionicons' | 'MCI';
  targetTab: keyof MainTabParamList;
  params?: Record<string, unknown>;
  activeRoutes: string[];
};

const drawerItems: DrawerItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    iconName: 'home-outline',
    targetTab: 'Home',
    activeRoutes: ['Home'],
  },
  {
    key: 'announcements',
    label: 'Announcements',
    iconName: 'megaphone-outline',
    targetTab: 'More',
    params: { screen: 'Announcements' },
    activeRoutes: ['Announcements'],
  },
  {
    key: 'record-update',
    label: 'Record Update',
    iconName: 'create-outline',
    targetTab: 'UpdateRecord',
    activeRoutes: ['UpdateRecord', 'UpdateRecordChoice', 'InitialRecordForm'],
  },
  {
    key: 'appointments',
    label: 'Appointment',
    iconName: 'calendar-outline',
    targetTab: 'Appointments',
    activeRoutes: ['Appointments'],
  },
  {
    key: 'medicine-request',
    label: 'Medicine Request',
    iconName: 'pill',
    iconLib: 'MCI',
    targetTab: 'Medicine',
    activeRoutes: ['Medicine', 'MedicineRequest'],
  },
  {
    key: 'health-chat',
    label: 'Health Chat',
    iconName: 'chatbubbles-outline',
    targetTab: 'HealthChat',
    activeRoutes: ['HealthChat'],
  },
  {
    key: 'my-documents',
    label: 'My Documents',
    iconName: 'folder-open-outline',
    targetTab: 'More',
    params: { screen: 'MyDocuments' },
    activeRoutes: ['MyDocuments'],
  },
];

const getActiveRouteName = (state: any): string => {
  if (!state?.routes?.length) return 'Home';

  let route = state.routes[state.index ?? 0];
  while (route?.state?.routes?.length) {
    route = route.state.routes[route.state.index ?? 0];
  }

  return route?.name ?? 'Home';
};

const SidebarContent: React.FC<DrawerContentComponentProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { recordStatus } = useRecordStatus();
  const insets = useSafeAreaInsets();
  const footerBottomInset = Platform.OS === 'ios'
    ? Math.max(insets.bottom, 12)
    : Math.max(insets.bottom, 14);
  const currentYear = new Date().getFullYear();
  const activeRoute = getActiveRouteName(navigation.getState());
  const isDomainAccessRestricted =
    Boolean(recordStatus?.needsInitialRecord) || recordStatus?.credentialStatus === 'Inactive';
  const shouldShowInitialRecordLabel =
    Boolean(recordStatus?.needsInitialRecord) && recordStatus?.credentialStatus !== 'Inactive';
  const recordUpdateDrawerItem =
    drawerItems.find((item) => item.key === 'record-update') ?? drawerItems[0];

  const visibleDrawerItems = isDomainAccessRestricted
    ? [
        {
          ...recordUpdateDrawerItem,
          label: shouldShowInitialRecordLabel ? 'Complete Record' : 'Record Update',
          iconName: shouldShowInitialRecordLabel ? 'clipboard-outline' : 'create-outline',
        },
      ]
    : drawerItems;

  const handleNavigate = (item: DrawerItem) => {
    (navigation as any).navigate('MainTabs', {
      screen: item.targetTab,
      params: item.params,
    });
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  return (
    <View
      style={[
        styles.drawerRoot,
        {
          backgroundColor: isDark ? colors.neutral[900] : colors.primary[500],
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.logoSection}>
        <TouchableOpacity
          onPress={() => {
            if (isDomainAccessRestricted) {
              handleNavigate(visibleDrawerItems[0]);
              return;
            }
            handleNavigate({
              key: 'logo',
              label: 'Dashboard',
              iconName: 'home-outline',
              targetTab: 'Home',
              activeRoutes: ['Home'],
            });
          }}
          style={styles.logoButton}
          accessibilityRole="button"
          accessibilityLabel="Go to Dashboard"
        >
          <Image source={require('../../assets/MDSystem.png')} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <DrawerContentScrollView
        contentContainerStyle={styles.drawerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleDrawerItems.map((item) => {
          const isActive = item.activeRoutes.includes(activeRoute);

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.drawerItem,
                isActive
                  ? {
                      backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                      borderLeftColor: isDark ? colors.primary[400] : colors.primary[500],
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderLeftColor: 'transparent',
                    },
              ]}
              onPress={() => handleNavigate(item)}
              activeOpacity={0.7}
            >
              <View style={styles.drawerItemIcon}>
                {item.iconLib === 'MCI' ? (
                  <MaterialCommunityIcons
                    name={item.iconName as any}
                    size={22}
                    color={
                      isActive
                        ? (isDark ? colors.primary[400] : colors.primary[500])
                        : '#FFFFFF'
                    }
                  />
                ) : (
                  <Ionicons
                    name={item.iconName as any}
                    size={22}
                    color={
                      isActive
                        ? (isDark ? colors.primary[400] : colors.primary[500])
                        : '#FFFFFF'
                    }
                  />
                )}
              </View>

              <Text
                style={[
                  styles.drawerItemLabel,
                  {
                    color: isActive
                      ? (isDark ? colors.neutral[100] : colors.secondary[900])
                      : '#FFFFFF',
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomInset }]}>
        <Text style={[styles.footerText, { color: isDark ? colors.neutral[500] : 'rgba(0,0,0,0.45)' }]}>© {currentYear} @ mdsystem</Text>
      </View>
    </View>
  );
};

export const AppDrawerNavigator: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <Drawer.Navigator
      initialRouteName="MainTabs"
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.6)',
        swipeEnabled: true,
        drawerStyle: {
          width: 286,
          backgroundColor: isDark ? colors.neutral[900] : colors.primary[500],
        },
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabNavigator} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
  },
  logoSection: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  logoButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  drawerScrollContent: {
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
  },
  drawerItemIcon: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  drawerItemLabel: {
    fontSize: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export default AppDrawerNavigator;
