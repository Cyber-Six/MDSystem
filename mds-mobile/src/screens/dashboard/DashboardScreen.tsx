/**
 * Dashboard Screen - Main screen after authentication
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { TokenStorage, logout, bannerService } from '../../core';

interface DashboardScreenProps {
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout }) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    // Get user info from token or storage
    const getUserInfo = async () => {
      try {
        const token = await TokenStorage.getAccessToken();
        if (token) {
          // Decode JWT to get email (simple base64 decode of payload)
          const payload = token.split('.')[1];
          const decoded = JSON.parse(atob(payload));
          setUserEmail(decoded.email || null);
        }
      } catch (error) {
        console.error('Error getting user info:', error);
      }
    };
    getUserInfo();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Add refresh logic here
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthenticated(false);
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout anyway
      setAuthenticated(false);
      onLogout();
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }
    ]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
            progressBackgroundColor={colors.secondary[900]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[
              styles.headerTitle,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] }
            ]}>
              Dashboard
            </Text>
            <Text style={[
              styles.headerSubtitle,
              { color: isDark ? colors.neutral[400] : colors.neutral[600] }
            ]}>
              Welcome back{userEmail ? `, ${userEmail}` : ''}
            </Text>
          </View>
          
        </View>

        {/* Quick Actions */}
        <View style={[
          styles.card,
          { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.cardTitle,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>
            Quick Actions
          </Text>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary[500] }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}><Ionicons name="clipboard" size={24} color="#FFFFFF" /></Text>
              <Text style={styles.actionText}>Medical Records</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.accent[500] }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}><Ionicons name="calendar" size={24} color="#FFFFFF" /></Text>
              <Text style={styles.actionText}>Appointments</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.success[500] }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}><MaterialCommunityIcons name="pill" size={24} color="#FFFFFF" /></Text>
              <Text style={styles.actionText}>Prescriptions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}><Ionicons name="bar-chart" size={24} color="#FFFFFF" /></Text>
              <Text style={styles.actionText}>Health Stats</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={[
          styles.card,
          { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.cardTitle,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>
            Recent Activity
          </Text>
          
          <View style={[
            styles.emptyState,
            { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }
          ]}>
            <Text style={[
              styles.emptyText,
              { color: isDark ? colors.neutral[400] : colors.neutral[600] }
            ]}>
              No recent activity
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={[
          styles.card,
          { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.cardTitle,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>
            Account
          </Text>
          
          <TouchableOpacity style={[
            styles.menuItem,
            { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }
          ]}>
            <Text style={styles.menuIcon}><Ionicons name="person" size={22} color={isDark ? colors.neutral[400] : colors.neutral[500]} /></Text>
            <Text style={[
              styles.menuText,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] }
            ]}>Profile Settings</Text>
            <Text style={[
              styles.menuArrow,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] }
            ]}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[
            styles.menuItem,
            { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }
          ]}>
            <Text style={styles.menuIcon}><Ionicons name="notifications" size={22} color={isDark ? colors.neutral[400] : colors.neutral[500]} /></Text>
            <Text style={[
              styles.menuText,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] }
            ]}>Notifications</Text>
            <Text style={[
              styles.menuArrow,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] }
            ]}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[
            styles.menuItem,
            { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }
          ]}>
            <Text style={styles.menuIcon}><Ionicons name="lock-closed" size={22} color={isDark ? colors.neutral[400] : colors.neutral[500]} /></Text>
            <Text style={[
              styles.menuText,
              { color: isDark ? colors.neutral[100] : colors.secondary[900] }
            ]}>Security</Text>
            <Text style={[
              styles.menuArrow,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] }
            ]}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.logoutItem}
            onPress={handleLogout}
          >
            <Text style={styles.menuIcon}><Ionicons name="log-out" size={22} color={colors.error[500]} /></Text>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={[
            styles.footerText,
            { color: isDark ? colors.neutral[500] : colors.neutral[400] }
          ]}>
            MDSystem Mobile {process.env.EXPO_PUBLIC_APP_VERSION}
          </Text>
          <Text style={[
            styles.footerCopyright,
            { color: isDark ? colors.neutral[600] : colors.neutral[300] }
          ]}>
            © {currentYear} @ mdsystem
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============ Styles ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: {
    fontSize: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    padding: 16,
    borderRadius: 12,
  },
  emptyText: {
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
  },
  menuArrow: {
    fontSize: 18,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    flex: 1,
    color: colors.error[500],
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
  },
  footerCopyright: {
    fontSize: 12,
  },
});

export default DashboardScreen;
