/**
 * Change Password Screen
 * Mirrors mds-patient change-password-modal.jsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest } from '../../core';

export const ChangePasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { isDark } = useTheme();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!current || !newPw || !confirm) {
      setError('All fields are required.');
      return;
    }
    if (newPw.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosRequest.post('/auth/user/change-password', {
        currentPassword: current,
        newPassword: newPw,
      });
      if (res.data.ok) {
        setSuccess('Password changed successfully.');
        setCurrent('');
        setNewPw('');
        setConfirm('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (isDark: boolean) => [
    styles.input,
    {
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
      color: isDark ? colors.neutral[100] : colors.neutral[900],
      borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
            Change Password
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
            Enter your current password and choose a new one.
          </Text>

          {error && (
            <View style={[styles.alert, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50] }]}>
              <Text style={{ color: colors.error[500], fontSize: 14 }}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={[styles.alert, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : colors.success[50] }]}>
              <Text style={{ color: colors.success[500], fontSize: 14 }}>{success}</Text>
            </View>
          )}

          {/* Current Password */}
          <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[...inputStyle(isDark), { flex: 1 }]}
              secureTextEntry={!showCurrent}
              value={current}
              onChangeText={setCurrent}
              placeholder="Enter current password"
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
              <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500] }}>{showCurrent ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[...inputStyle(isDark), { flex: 1 }]}
              secureTextEntry={!showNew}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="Enter new password"
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
              <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500] }}>{showNew ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm */}
          <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[...inputStyle(isDark), { flex: 1 }]}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
              <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500] }}>{showConfirm ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { opacity: loading ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
            <Text style={styles.submitText}>{loading ? 'Updating...' : 'Change Password'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 10 },
  alert: { padding: 12, borderRadius: 10, marginBottom: 8 },
  submitBtn: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});

export default ChangePasswordScreen;
