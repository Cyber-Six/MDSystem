/**
 * Dashboard Home Screen - Main screen after authentication
 * Mirrors mds-patient dashboard-home.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { TokenStorage } from '../../core';

interface DashboardHomeScreenProps {
  navigation: any;
}

// Decode JWT payload (base64)
const decodeJWT = (token: string) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const StatCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  isDark: boolean;
}> = ({ icon, label, value, color, isDark }) => (
  <View
    style={[
      styles.statCard,
      { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
    ]}
  >
    <View style={[styles.statIcon, { backgroundColor: color }]}>
      <Text style={styles.statIconText}>{icon}</Text>
    </View>
    <Text
      style={[
        styles.statValue,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] },
      ]}
    >
      {value}
    </Text>
    <Text
      style={[
        styles.statLabel,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] },
      ]}
    >
      {label}
    </Text>
  </View>
);

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.quickAction, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.quickActionIcon}>{icon}</Text>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({
  navigation,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const token = await TokenStorage.getAccessToken();
        if (token) {
          const decoded = decodeJWT(token);
          setUserName(decoded?.email?.split('@')[0] || null);
        }
      } catch {}
    };
    getUserInfo();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
        },
      ]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.greeting,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              Welcome back
            </Text>
            <Text
              style={[
                styles.userName,
                {
                  color: isDark ? colors.neutral[100] : colors.secondary[900],
                },
              ]}
            >
              {userName || 'Patient'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeToggle,
              {
                backgroundColor: isDark
                  ? colors.neutral[800]
                  : colors.neutral[200],
              },
            ]}
          >
            <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="📅"
            label="Appointments"
            value="0"
            color={colors.accent[500]}
            isDark={isDark}
          />
          <StatCard
            icon="💊"
            label="Requests"
            value="0"
            color={colors.success[500]}
            isDark={isDark}
          />
          <StatCard
            icon="📋"
            label="Records"
            value="—"
            color={colors.primary[500]}
            isDark={isDark}
          />
        </View>

        {/* Quick Actions */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color: isDark ? colors.neutral[100] : colors.secondary[900],
              },
            ]}
          >
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              icon="📅"
              label="Book Appointment"
              color={colors.accent[500]}
              onPress={() => navigation.navigate('Appointments')}
            />
            <QuickActionButton
              icon="💬"
              label="Health Chat"
              color={colors.primary[500]}
              onPress={() => navigation.navigate('HealthChat')}
            />
            <QuickActionButton
              icon="💊"
              label="Medicine Request"
              color={colors.success[500]}
              onPress={() => navigation.navigate('Medicine')}
            />
            <QuickActionButton
              icon="👤"
              label="My Profile"
              color={colors.secondary[600]}
              onPress={() =>
                navigation.navigate('More', { screen: 'Profile' })
              }
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color: isDark ? colors.neutral[100] : colors.secondary[900],
              },
            ]}
          >
            Recent Activity
          </Text>
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: isDark
                  ? colors.neutral[700]
                  : colors.neutral[50],
              },
            ]}
          >
            <Text style={styles.emptyIcon}>📭</Text>
            <Text
              style={[
                styles.emptyText,
                {
                  color: isDark ? colors.neutral[400] : colors.neutral[600],
                },
              ]}
            >
              No recent activity
            </Text>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              {
                color: isDark ? colors.neutral[500] : colors.neutral[400],
              },
            ]}
          >
            MDSystem Mobile v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: { fontSize: 22 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: { fontSize: 20 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
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
  quickAction: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  quickActionIcon: { fontSize: 28, marginBottom: 8 },
  quickActionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14 },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: { fontSize: 12 },
});

export default DashboardHomeScreen;
