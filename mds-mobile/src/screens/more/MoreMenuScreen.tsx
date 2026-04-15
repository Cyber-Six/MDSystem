/**
 * More Menu Screen — Landing screen for the "More" tab
 * Shows account info, settings menu items, and sign out button
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { logout, axiosRequest } from '../../core';
import { unregisterPushToken } from '../../services/notification-service';
import { getPatientProfile } from '../../services/profile-service';
import { toggleAppDrawer } from '../../navigation/drawer-utils';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MoreMenuScreenProps {
  navigation: any;
}

interface MenuItem {
  iconName: string;
  iconLib?: 'Ionicons' | 'MCI';
  label: string;
  screen: string;
  description?: string;
}

const menuItems: MenuItem[] = [
  { iconName: 'person', label: 'Profile', screen: 'Profile', description: 'View your personal info' },
  { iconName: 'pill', iconLib: 'MCI', label: 'Medicine Request', screen: 'MedicineRequest', description: 'Request medicines from the clinic' },
  { iconName: 'create', label: 'Update Record', screen: 'UpdateRecordChoice', description: 'Update your medical or dental record' },
  { iconName: 'folder-open', label: 'My Documents', screen: 'MyDocuments', description: 'View your prescriptions & certificates' },
  { iconName: 'key', label: 'Change Password', screen: 'ChangePassword', description: 'Update your password' },
  { iconName: 'document-text', label: 'Login Activity', screen: 'LoginActivity', description: 'Recent sessions' },
  { iconName: 'megaphone', label: 'Announcements', screen: 'Announcements', description: 'Clinic news and announcements' },
  { iconName: 'help-circle', label: 'FAQs', screen: 'FAQs', description: 'Common questions' },
  { iconName: 'settings', label: 'Settings', screen: 'Settings', description: 'Theme & preferences' },
];

const nonDomainMenuItems: MenuItem[] = [
  { iconName: 'person', label: 'Profile', screen: 'Profile', description: 'View your personal info' },
  { iconName: 'key', label: 'Change Password', screen: 'ChangePassword', description: 'Update your password' },
  { iconName: 'document-text', label: 'Login Activity', screen: 'LoginActivity', description: 'Recent sessions' },
  { iconName: 'megaphone', label: 'Announcements', screen: 'Announcements', description: 'Clinic news and announcements' },
  { iconName: 'help-circle', label: 'FAQs', screen: 'FAQs', description: 'Common questions' },
  { iconName: 'settings', label: 'Settings', screen: 'Settings', description: 'Theme & preferences' },
];

export const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();
  const { recordStatus } = useRecordStatus();
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  const isInactiveCredential = recordStatus?.credentialStatus === 'Inactive';
  const isDomainAccessRestricted = Boolean(recordStatus?.needsInitialRecord) || isInactiveCredential;
  const recordActionItem: MenuItem = isInactiveCredential
    ? {
        iconName: 'create',
        label: 'Update Record',
        screen: 'UpdateRecordChoice',
        description: 'Update your medical and dental record',
      }
    : {
        iconName: 'clipboard',
        label: 'Complete Record',
        screen: 'InitialRecordForm',
        description: 'Complete or revise your initial record',
      };

  const visibleMenuItems = isDomainAccessRestricted
    ? [recordActionItem, ...nonDomainMenuItems]
    : menuItems;

  useEffect(() => {
    getPatientProfile()
      .then((profile) => {
        if (profile) {
          setUserEmail(profile.email || '');
          setUserName(profile.name || profile.firstName || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      // Unregister push token before clearing auth tokens
      await unregisterPushToken(axiosRequest);
      await logout();
    } catch {}
    setAuthenticated(false);
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.menuButton,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
            onPress={() => toggleAppDrawer(navigation)}
            accessibilityRole="button"
            accessibilityLabel="Open sidebar"
          >
            <Ionicons
              name="menu"
              size={22}
              color={isDark ? colors.neutral[100] : colors.secondary[900]}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] },
            ]}
          >
            More
          </Text>
        </View>

        {/* User card */}
        <View
          style={[
            styles.userCard,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] },
            ]}
          >
            <Text style={styles.avatarText}>
              {(userName || userEmail || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text
              style={[
                styles.userName,
                { color: isDark ? colors.neutral[100] : colors.secondary[900] },
              ]}
            >
              {userName || userEmail?.split('@')[0] || 'Patient'}
            </Text>
            <Text
              style={[
                styles.userEmailText,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              {userEmail || 'No email'}
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <View
          style={[
            styles.menuCard,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          {visibleMenuItems.map((item, index) => (
            <TouchableOpacity
              key={item.screen}
              style={[
                styles.menuItem,
                index < visibleMenuItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[100],
                },
              ]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.6}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
                {item.iconLib === 'MCI' ? (
                  <MaterialCommunityIcons name={item.iconName as any} size={20} color={isDark ? colors.neutral[300] : colors.secondary[700]} />
                ) : (
                  <Ionicons name={item.iconName as any} size={20} color={isDark ? colors.neutral[300] : colors.secondary[700]} />
                )}
              </View>
              <View style={styles.menuTextContainer}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                >
                  {item.label}
                </Text>
                {item.description && (
                  <Text
                    style={[
                      styles.menuDescription,
                      { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                    ]}
                  >
                    {item.description}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.chevron,
                  { color: isDark ? colors.neutral[600] : colors.neutral[300] },
                ]}
              >
                ›
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[
            styles.signOutBtn,
            {
              backgroundColor: isDark
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(239,68,68,0.06)',
              borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out" size={20} color={colors.error[500]} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: isDark ? colors.neutral[600] : colors.neutral[300] },
            ]}
          >
            MDSystem Mobile {process.env.EXPO_PUBLIC_APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: { fontSize: 22 },
  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '600', color: colors.primary[500] },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600' },
  userEmailText: { fontSize: 13, marginTop: 2 },
  // Menu
  menuCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContainer: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '500' },
  menuDescription: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 22, fontWeight: '300' },
  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error[500],
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: { fontSize: 12 },
});

export default MoreMenuScreen;
