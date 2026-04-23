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
import { logout, axiosRequest } from '../../core';
import { unregisterPushToken } from '../../services/notification-service';
import { getPatientProfile } from '../../services/profile-service';
import { toggleAppDrawer } from '../../navigation/drawer-utils';
import { useRecordStatus } from '../../context/RecordStatusContext';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TopBar } from '../../components/layout/TopBar';
import { UserAvatar } from '../../components/common/UserAvatar';

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

const SHOW_LOGIN_ACTIVITY_IN_MORE = false;

const menuItems: MenuItem[] = [
  { iconName: 'person', label: 'Profile', screen: 'Profile', description: 'View your personal info' },
  { iconName: 'megaphone', label: 'Announcements', screen: 'Announcements', description: 'Clinic news and announcements' },
  { iconName: 'folder-open-outline', label: 'My Documents', screen: 'MyDocuments', description: 'View your uploaded files' },
  ...(SHOW_LOGIN_ACTIVITY_IN_MORE
    ? [{ iconName: 'document-text', label: 'Login Activity', screen: 'LoginActivity', description: 'Recent sessions' }]
    : []),
  { iconName: 'help-circle', label: 'FAQs', screen: 'FAQs', description: 'Common questions' },
  { iconName: 'settings', label: 'Settings', screen: 'Settings', description: 'Theme & preferences' },
];

// Screens hidden when patient credential is inactive (matches mds-patient web lockdown)
const INACTIVE_HIDDEN_SCREENS = new Set(['MyDocuments']);

export const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();
  const { recordStatus } = useRecordStatus();
  const normalizedRecordStatus = String(recordStatus?.status || '').toLowerCase();
  const isAwaitingInitialApproval =
    normalizedRecordStatus === 'pending'
    || normalizedRecordStatus === 'revisionsubmitted'
    || normalizedRecordStatus === 'underreview'
    || normalizedRecordStatus === 'in review';
  const isInitialFormOnlyMode = Boolean(recordStatus?.needsInitialRecord) && !isAwaitingInitialApproval;
  const isInactive = recordStatus?.credentialStatus === 'Inactive';
  const shouldHideMyDocuments = isInactive || isInitialFormOnlyMode;
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

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
      edges={['top', 'left', 'right']}
    >
      <TopBar title="More" onMenuPress={() => toggleAppDrawer(navigation)} />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* User card */}
        <View
          style={[
            styles.userCard,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          <UserAvatar name={userName || userEmail || 'Patient'} size="md" />
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

          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? colors.secondary[500] : colors.secondary[300]}
            />
          </TouchableOpacity>
        </View>

        {/* Menu items */}
        <View
          style={[
            styles.menuCard,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          {menuItems
            .filter((item) => !shouldHideMyDocuments || !INACTIVE_HIDDEN_SCREENS.has(item.screen))
            .map((item, index, filtered) => (
            <TouchableOpacity
              key={item.screen}
              style={[
                styles.menuItem,
                index < filtered.length - 1 && {
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
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
    minHeight: 52,
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
