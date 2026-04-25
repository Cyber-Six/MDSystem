/**
 * Register Screen for MDSystem Mobile
 * Multi-step registration flow matching the frontend
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Alert } from '../../components/ui/FormComponents';
import { DataConsent } from '../../components/auth/DataConsent';
import {
  mobileAuthFeatureConfig,
  withOptionalRecaptcha,
} from '../../config/authFeatures';
import { axiosRequest, TokenStorage } from '../../core';

// Import validation functions - inline for now to avoid module resolution issues
const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

const passwordsMatch = (password: string, confirmPassword: string): boolean => {
  return password === confirmPassword;
};

const isValidTipEmail = (email: string): boolean => {
  const tipDomains = ['@tip.edu.ph'];
  return tipDomains.some(domain => email.toLowerCase().endsWith(domain));
};

// Sanitize error messages to remove reCAPTCHA references
const sanitizeErrorMessage = (message: string): string => {
  if (!message) return 'An error occurred. Please try again.';
  const sanitized = message
    .replace(/recaptcha/gi, '')
    .replace(/reCAPTCHA/g, '')
    .replace(/verification failed/gi, 'request failed')
    .replace(/verify/gi, 'process')
    .replace(/  +/g, ' ')
    .trim();
  return sanitized || 'An error occurred. Please try again.';
};

const TOTAL_STEPS = 4;

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onRegisterSuccess
}) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Step-specific state
  const [otp, setOtp] = useState('');
  const [verificationKey, setVerificationKey] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const goToNextStep = () => {
    setError('');
    setSuccessMessage('');
    setCurrentStep(prev => prev + 1);
  };

  // Step 1: Initial Registration
  const handleInitialRegistration = async () => {
    setError('');

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (!isValidTipEmail(formData.email)) {
      setError('Email must follow TIP institutional format.');
      return;
    }

    if (!passwordsMatch(formData.password, formData.confirmPassword)) {
      setError('Passwords do not match.');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosRequest.post('/auth/register', {
        email: formData.email,
        password: formData.password
      });

      if (response.data.ok) {
        // Account already exists — redirect to login
        if (response.data.userExists) {
          setError('Account already exists. Please login instead.');
          setTimeout(() => {
            onNavigateToLogin();
          }, 2000);
          return;
        }
        // Auto-send OTP immediately after successful registration
        try {
          await axiosRequest.post(
            '/auth/email/verification',
            withOptionalRecaptcha({
              email: formData.email,
            })
          );
          setSuccessMessage('Verification code sent to your email!');
        } catch (otpErr: any) {
          const otpErrorCode = otpErr.response?.data?.error;
          if (otpErrorCode === 'RECAPTCHA_REQUIRED' || otpErrorCode === 'INVALID_RECAPTCHA') {
            setError('Account created but failed to send verification code. Use resend below.');
          } else {
            setError(
              sanitizeErrorMessage(
                otpErr.response?.data?.message ||
                  'Account created but failed to send verification code. Use resend below.'
              )
            );
          }
        }
        setCurrentStep(2);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format.');
      } else if (errorCode === 'RECAPTCHA_REQUIRED' || errorCode === 'INVALID_RECAPTCHA') {
        setError('Registration failed. Please try again.');
      } else {
        setError(sanitizeErrorMessage(errorMessage || 'Registration failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosRequest.post('/auth/email/verification/verify', {
        email: formData.email,
        otp: otp
      });

      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        goToNextStep();
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'INVALID_OTP') {
        setError('Invalid verification code. Please try again.');
      } else if (errorCode === 'OTP_EXPIRED') {
        setError('Verification code expired. Please request a new one.');
      } else if (errorCode === 'OTP_LOCKED_OUT') {
        const retryAfter = err.response?.data?.retryAfterSeconds;
        setError(`Too many invalid attempts. Please try again after ${retryAfter} seconds.`);
      } else {
        setError(errorMessage || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await axiosRequest.post(
        '/auth/email/verification',
        withOptionalRecaptcha({
          email: formData.email,
        })
      );

      if (response.data.ok) {
        setSuccessMessage('A new verification code has been sent!');
        setOtp('');
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;

      if (errorCode === 'RECAPTCHA_REQUIRED' || errorCode === 'INVALID_RECAPTCHA') {
        setError('Failed to resend code. Please try again.');
      } else if (errorCode === 'EMAIL_COOLDOWN_ACTIVE') {
        setError('Please wait before requesting another code.');
      } else if (errorCode === 'EMAIL_ATTEMPT_LIMIT_REACHED') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Handle consent acceptance from DataConsent modal
  const handleConsentAccept = async () => {
    setError('');
    setLoading(true);

    try {
      // Complete registration after consent has been recorded by DataConsent
      const response = await axiosRequest.post('/auth/register/complete', {
        verificationKey,
        email: formData.email,
        password: formData.password
      });

      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          await TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          setAuthenticated(true);
          goToNextStep();

          // Redirect after showing success
          setTimeout(() => {
            onRegisterSuccess();
          }, 2000);
        } else {
          // Account already exists
          setError('Account already exists. Redirecting to login...');
          setTimeout(() => {
            onNavigateToLogin();
          }, 2000);
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'INVALID_VERIFICATION_SESSION' || errorCode === 'INVALID_OR_EXPIRED_SESSION') {
        setError('Session expired. Please start over.');
        setCurrentStep(1);
      } else if (errorCode === 'DATA_CONSENT_REQUIRED') {
        setError('You must agree to the data consent policy.');
      } else {
        setError(sanitizeErrorMessage(errorMessage || 'Registration failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle consent cancellation
  const handleConsentCancel = () => {
    setCurrentStep(1);
    setVerificationKey('');
    setFormData({ email: '', password: '', confirmPassword: '' });
    setOtp('');
    setError('');
    setSuccessMessage('');
  };

  // Progress Bar
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressLabels}>
        <Text style={[
          styles.progressText,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          Step {currentStep} of {TOTAL_STEPS}
        </Text>
        <Text style={[
          styles.progressText,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          {Math.round((currentStep / TOTAL_STEPS) * 100)}%
        </Text>
      </View>
      <View style={[
        styles.progressTrack,
        { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }
      ]}>
        <View 
          style={[
            styles.progressFill,
            { width: `${(currentStep / TOTAL_STEPS) * 100}%` }
          ]}
        />
      </View>
    </View>
  );

  // Step 1: Account Creation Form
  const renderAccountStep = () => (
    <View style={styles.stepContainer}>
      <Alert message={error} type="error" />

      <Input
        label="Email Address"
        placeholder="your.email@tip.edu.ph"
        value={formData.email}
        onChangeText={(value) => handleInputChange('email', value)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <Input
        label="Password"
        placeholder="At least 8 characters"
        value={formData.password}
        onChangeText={(value) => handleInputChange('password', value)}
        secureTextEntry
        showPasswordToggle
        editable={!loading}
      />

      <Input
        label="Confirm Password"
        placeholder="Re-enter your password"
        value={formData.confirmPassword}
        onChangeText={(value) => handleInputChange('confirmPassword', value)}
        secureTextEntry
        showPasswordToggle
        editable={!loading}
      />

      <Button
        title={loading ? 'Creating Account...' : 'Create Account'}
        onPress={handleInitialRegistration}
        loading={loading}
      />

      <View style={[
        styles.divider,
        { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }
      ]}>
        <View style={styles.inlinePromptRow}>
          <Text style={[
            styles.inlinePromptText,
            { color: isDark ? colors.neutral[400] : colors.neutral[500] }
          ]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.8}>
            <Text style={[
              styles.inlineActionLink,
              { color: isDark ? colors.accent[400] : colors.accent[600] }
            ]}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Step 2: Verify OTP
  const renderVerifyOtpStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.centeredHeader}>
        <View style={[
          styles.iconCircle,
          { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.2)' : colors.primary[100] }
        ]}>
          <Ionicons name="checkmark-circle" size={40} color={colors.primary[500]} />
        </View>

        <Text style={[
          styles.stepTitle,
          { color: isDark ? colors.neutral[100] : colors.secondary[900] }
        ]}>
          Enter Verification Code
        </Text>
        
        <Text style={[
          styles.stepSubtitle,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          We've sent a code to{'\n'}
          <Text style={[
            styles.emailHighlight,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>
            {formData.email}
          </Text>
        </Text>
      </View>

      <Alert message={error} type="error" />
      {successMessage && <Alert message={successMessage} type="success" />}

      <Input
        label="Verification Code"
        placeholder="000000"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        editable={!loading}
      />

      <Button
        title={loading ? 'Verifying...' : 'Verify Code'}
        onPress={handleVerifyOTP}
        loading={loading}
        style={styles.marginBottom}
      />

      <Button
        title="Resend Code"
        onPress={handleResendOTP}
        variant="secondary"
        disabled={loading}
      />
    </View>
  );

  // Step 3: Consent (UI placeholder — DataConsent modal handles rendering)
  const renderConsentStep = () => (
    <View style={styles.centeredStep}>
      <View style={[
        styles.iconCircle,
        { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : colors.accent[100] }
      ]}>
        <Ionicons name="shield-checkmark" size={40} color={colors.accent[500]} />
      </View>

      <Text style={[
        styles.stepTitle,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] }
      ]}>
        Data Consent Required
      </Text>
      
      <Text style={[
        styles.stepSubtitle,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] }
      ]}>
        Please review and accept the data consent policy to complete your registration
      </Text>

      <Alert message={error} type="error" />

      <Text style={[
        styles.stepSubtitle,
        { color: isDark ? colors.neutral[400] : colors.neutral[500] }
      ]}>
        Opening consent agreement...
      </Text>
    </View>
  );

  // Step 4: Success
  const renderSuccessStep = () => (
    <View style={styles.centeredStep}>
      <View style={[
        styles.successCircle,
        { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : colors.success[100] }
      ]}>
        <Ionicons name="checkmark" size={48} color={colors.success[500]} />
      </View>

      <Text style={[
        styles.successTitle,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] }
      ]}>
        Account Created!
      </Text>
      
      <Text style={[
        styles.successText,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] }
      ]}>
        Your account has been created successfully.{'\n'}
        Redirecting to dashboard...
      </Text>

      {/* Loading spinner */}
      <ActivityIndicator size="large" color={colors.primary[500]} />
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderAccountStep();
      case 2:
        return renderVerifyOtpStep();
      case 3:
        return renderConsentStep();
      case 4:
        return renderSuccessStep();
      default:
        return null;
    }
  };

  return (
    <>
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex1}
    >
      <ScrollView 
        style={[
          styles.flex1,
          { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }
        ]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Progress Bar */}
          {currentStep > 1 && renderProgressBar()}

          {/* Step Content */}
          <View style={[
            styles.formCard,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
              borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
            }
          ]}>
            {/* Header */}
            {currentStep === 1 && (
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/MDSystem.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[
                  styles.title,
                  { color: isDark ? colors.neutral[100] : colors.secondary[900] }
                ]}>
                  Create Account
                </Text>
                <Text style={[
                  styles.subtitle,
                  { color: isDark ? colors.neutral[400] : colors.neutral[600] }
                ]}>
                  Join our healthcare platform
                </Text>
              </View>
            )}

            {renderStep()}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Data Consent Modal - Rendered when on consent step */}
    <DataConsent
      isOpen={currentStep === 3}
      verificationKey={verificationKey}
      purpose="register"
      onAccept={handleConsentAccept}
      onCancel={handleConsentCancel}
    />
    </>
  );
};

// ============ Styles ============
const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    width: '100%',
  },
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
  header: {
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
  logoEmoji: {
    // unused
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  stepContainer: {
    width: '100%',
  },
  centeredStep: {
    width: '100%',
    alignItems: 'center',
  },
  centeredHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  divider: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  inlinePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  inlinePromptText: {
    fontSize: 14,
  },
  inlineActionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    // unused
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  emailHighlight: {
    fontWeight: '600',
  },
  marginBottom: {
    marginBottom: 12,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successCheckmark: {
    // unused
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default RegisterScreen;
