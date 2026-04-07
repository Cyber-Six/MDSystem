/**
 * Forgot Password Screen
 * Mirrors mds-patient/src/modules/auth/forget-password.jsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Alert, LinkButton } from '../../components/ui/FormComponents';
import { axiosRequest } from '../../core';

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
}) => {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axiosRequest.post('/auth/password/forget-password', {
        email: email.trim(),
        recaptchaToken: 'RECAPTCHA_TOKEN_HERE',
      });

      setSuccess('Password reset link sent! Please check your email.');
      setEmail('');
      setTimeout(() => onBackToLogin(), 3000);
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format (@tip.edu.ph).');
      } else if (errorCode === 'EMAIL_COOLDOWN_ACTIVE') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(
          err.response?.data?.message ||
            'Failed to send reset link. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] },
              ]}
            >
              <Ionicons name="key" size={30} color={colors.primary[500]} />
            </View>
            <Text
              style={[
                styles.title,
                { color: isDark ? colors.neutral[100] : colors.secondary[900] },
              ]}
            >
              Forgot Password?
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? colors.neutral[400] : colors.neutral[500] },
              ]}
            >
              Enter your email to receive a password reset link
            </Text>
          </View>

          {/* Alerts */}
          {error ? <Alert type="error" message={error} /> : null}
          {success ? <Alert type="success" message={success} /> : null}

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email Address"
              placeholder="your.email@tip.edu.ph"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading && !success}
            />

            <Button
              title={loading ? 'Sending...' : 'Send Reset Link'}
              onPress={handleSubmit}
              disabled={loading || !!success || !email.trim()}
              loading={loading}
            />
          </View>

          <View style={styles.backRow}>
            <LinkButton
              title="← Back to Login"
              onPress={onBackToLogin}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconEmoji: { /* unused */ },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 13, textAlign: 'center' },
  form: { gap: 16, marginBottom: 16 },
  backRow: { alignItems: 'center', marginTop: 8 },
});

export default ForgotPasswordScreen;
