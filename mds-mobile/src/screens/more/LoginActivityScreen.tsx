/**
 * Login Activity Screen
 * Mirrors mds-patient login-activity-modal.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';

import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest } from '../../core';

interface LoginRecord {
  id: string;
  wasSuccessful: boolean;
  timestamp: string;
}

export const LoginActivityScreen: React.FC = () => {
  const { isDark } = useTheme();
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivity = async () => {
    try {
      const res = await axiosRequest.get('/auth/user/login-activity');
      if (res.data.ok) {
        setRecords(res.data.sessions || []);
      }
    } catch {
      // Use empty if not available
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadActivity(); }}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
            progressBackgroundColor={colors.secondary[900]}
          />
        }
      >
        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : colors.accent[50] }]}>
          <Text style={{ color: colors.accent[500], fontSize: 14 }}>
            ℹ️ Review your recent login sessions. If you see unfamiliar activity, change your password immediately.
          </Text>
        </View>

        {records.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
              No login activity found.
            </Text>
          </View>
        ) : (
          records.map((record) => (
            <View
              key={record.id}
              style={[
                styles.recordCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: record.wasSuccessful
                    ? isDark ? colors.neutral[700] : colors.neutral[200]
                    : colors.error[300],
                },
              ]}
            >
              <View style={styles.recordHeader}>
                <Text style={{ fontSize: 20 }}>
                  {record.wasSuccessful ? '✅' : '❌'}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.deviceRow}>
                    <Text style={[styles.deviceText, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      {record.wasSuccessful ? 'Successful Login' : 'Failed Login Attempt'}
                    </Text>
                  </View>
                  <Text style={[styles.browserText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                    {formatDate(record.timestamp)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  infoBanner: { padding: 14, borderRadius: 12, marginBottom: 16 },
  emptyState: { padding: 40, borderRadius: 16, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 14 },
  recordCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceText: { fontSize: 15, fontWeight: '500' },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  browserText: { fontSize: 12, marginTop: 2 },
  recordFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  locationText: { fontSize: 12 },
  timeText: { fontSize: 12 },
});

export default LoginActivityScreen;
