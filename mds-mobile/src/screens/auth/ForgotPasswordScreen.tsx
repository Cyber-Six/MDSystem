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
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { Input, Button, Alert } from '../../components/ui/FormComponents';
import {
  getAuthFeatureNotices,
  mobileAuthFeatureConfig,
  withOptionalRecaptcha,
} from '../../config/authFeatures';
import { axiosRequest } from '../../core';

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
}) => {
  const { isDark } = useTheme();
  const authFeatureNotices = getAuthFeatureNotices({
    includeRecaptcha: true,
  });
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
      await axiosRequest.post(
        '/auth/password/forget-password',
        withOptionalRecaptcha({
          email: email.trim(),
        })
      );

      setSuccess('Password reset link sent! Please check your email.');
      setEmail('');
      setTimeout(() => onBackToLogin(), 3000);
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      if (
        !mobileAuthFeatureConfig.recaptchaAvailable &&
        (errorCode === 'MISSING_FIELDS' || errorCode === 'INVALID_RECAPTCHA')
      ) {
        setError(
          `${mobileAuthFeatureConfig.recaptchaStatusMessage ?? 'reCAPTCHA is unavailable for this build.'} Password reset cannot continue until reCAPTCHA is enabled again.`
        );
      } else if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
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
          <View style={styles.contentWrap}>
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
                  borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.headerSection}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/MDSystem.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
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
              {authFeatureNotices.map((notice) => (
                <Alert key={notice} type="info" message={notice} />
              ))}

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

              <View
                style={[
                  styles.backRowInline,
                  { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                ]}
              >
                <Text
                  style={[
                    styles.inlinePromptText,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  Remembered your password?{' '}
                </Text>
                <TouchableOpacity onPress={onBackToLogin} activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.inlineActionLink,
                      { color: isDark ? colors.accent[400] : colors.accent[600] },
                    ]}
                  >
                    Sign in
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.helperText,
                  { color: isDark ? colors.neutral[500] : colors.neutral[500] },
                ]}
              >
                Check your spam folder if you don't receive the email
              </Text>
            </View>
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
  contentWrap: {
    width: '100%',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoContainer: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#1c1a17',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  form: {
    gap: 16,
    marginBottom: 18,
  },
  backRowInline: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 4,
  },
  inlinePromptText: {
    fontSize: 14,
  },
  inlineActionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
  },
});

export default ForgotPasswordScreen;
