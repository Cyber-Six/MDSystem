/**
 * Login Screen for MDSystem Mobile
 * Matches the frontend login flow with dark mode support
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Alert, LinkButton, Checkbox } from '../../components/ui/FormComponents';
import { DataConsent } from '../../components/auth/DataConsent';
import { axiosRequest, TokenStorage } from '../../core';

// Import validation functions from core package
const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

const isValidTipEmail = (email: string): boolean => {
  const tipDomains = ['@tip.edu.ph'];
  return tipDomains.some(domain => email.toLowerCase().endsWith(domain));
};

type LoginStep = 'credentials' | '2fa';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword?: () => void;
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess 
}) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  // Flow state
  const [currentStep, setCurrentStep] = useState<LoginStep>('credentials');
  const [verificationKey, setVerificationKey] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  
  // UI state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Send 2FA code
  const handleSend2FA = async () => {
    try {
      const recaptchaToken = 'MOBILE_APP_TOKEN';
      await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
    } catch (err) {
      console.error('Failed to send 2FA code:', err);
    }
  };

  // Initial login
  const handleInitialLogin = async () => {
    setError('');
    
    // Validation
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isValidTipEmail(email)) {
      setError('Email must follow TIP institutional format.');
      return;
    }

    setIsLoading(true);

    try {
      const recaptchaToken = 'MOBILE_APP_TOKEN';
      
      const response = await axiosRequest.post('/auth/login', { 
        email, 
        password, 
        recaptchaToken 
      });
      
      if (response.data.ok) {
        setVerificationKey(response.data.LoginKey);
        
        if (response.data.requires2FA) {
          await handleSend2FA();
          setCurrentStep('2fa');
        } else {
          setShowConsent(true);
        }
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      
      switch (errorCode) {
        case 'MISSING_FIELDS':
          setError('Please fill in all required fields.');
          break;
        case 'INVALID_EMAIL_FORMAT':
          setError('Invalid email format.');
          break;
        case 'INVALID_INSTITUTION_EMAIL':
          setError('Email must follow TIP institutional format.');
          break;
        case 'INVALID_CREDENTIALS':
          setError('Email or password is incorrect.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2FA verification
  const handleTwoFactorVerification = async () => {
    setError('');
    
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/email/2fa/verify', { 
        email,
        otp: twoFactorCode,
        verificationKey
      });
      
      if (response.data.ok) {
        const newKey = response.data.verificationKey;
        setVerificationKey(newKey);
        setShowConsent(true);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || '2FA verification failed.';
      const attempts = err.response?.data?.attempts;
      const attemptLimit = err.response?.data?.attemptLimit;
      const retryAfter = err.response?.data?.retryAfterSeconds;
      
      switch (errorCode) {
        case 'INVALID_OTP':
          setError(`Invalid OTP code. Attempts: ${attempts}/${attemptLimit}`);
          break;
        case 'OTP_LOCKED_OUT':
          setError(`Too many invalid attempts. Please try again after ${retryAfter} seconds.`);
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend 2FA
  const handleResend2FA = async () => {
    setError('');
    setIsLoading(true);

    try {
      const recaptchaToken = 'MOBILE_APP_TOKEN';
      await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'EMAIL_COOLDOWN_ACTIVE':
          setError('Please wait before requesting another code.');
          break;
        case 'EMAIL_ATTEMPT_LIMIT_REACHED':
          setError('Too many attempts. Please try again later.');
          break;
        default:
          setError('Failed to resend code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Complete login after consent is accepted (DataConsent handles POST consent)
  const completeLoginWithKey = async (key: string) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/login/complete', { 
        LoginKey: key 
      });
      
      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          await TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          setAuthenticated(true);
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Login completion failed.';
      
      switch (errorCode) {
        case 'INVALID_LOGIN_SESSION':
          setError('Login session is invalid or expired. Please try again.');
          resetForm();
          break;
        case '2FA_NOT_VERIFIED':
          setError('Email 2FA has not been verified.');
          setCurrentStep('2fa');
          break;
        case 'DATA_CONSENT_REQUIRED':
          setError('You must agree to the data consent policy to login.');
          break;
        case 'OUTDATED_CONSENT':
          setError('You must agree to the latest data consent policy.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setShowConsent(false);
    }
  };

  // Called when user accepts consent in the DataConsent modal
  const handleConsentAccept = () => completeLoginWithKey(verificationKey);

  // Called when user cancels consent in the DataConsent modal
  const handleConsentCancel = () => {
    setShowConsent(false);
    setVerificationKey('');
    setError('');
  };

  const resetForm = () => {
    setCurrentStep('credentials');
    setVerificationKey('');
    setTwoFactorCode('');
    setShowConsent(false);
  };

  // Credentials step
  const renderCredentialsStep = () => (
    <View style={styles.stepContainer}>
      <Alert message={error} type="error" />
      
      <Input
        label="Email Address"
        placeholder="your.email@tip.edu.ph"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <Input
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      <Button
        title={isLoading ? 'Signing in...' : 'Sign In'}
        onPress={handleInitialLogin}
        loading={isLoading}
        disabled={isLoading}
      />

      <View style={styles.linkContainer}>
        <LinkButton 
          title="Forgot your password?" 
          onPress={() => onNavigateToForgotPassword?.()} 
        />
      </View>

      <View style={[
        styles.divider,
        { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }
      ]}>
        <Text style={[
          styles.dividerText,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          Don't have an account?
        </Text>
        <Button
          title="Create Account"
          onPress={onNavigateToRegister}
          variant="outline"
        />
      </View>
    </View>
  );

  // 2FA step
  const renderTwoFactorStep = () => (
    <View style={styles.stepContainer}>
      {/* Icon */}
      <View style={[
        styles.iconCircle,
        { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.2)' : colors.primary[100] }
      ]}>
        <Ionicons name="mail" size={40} color={colors.primary[500]} />
      </View>

      <Text style={[
        styles.stepTitle,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] }
      ]}>
        Verify Your Email
      </Text>
      
      <Text style={[
        styles.stepSubtitle,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] }
      ]}>
        We've sent a 6-digit code to
      </Text>
      <Text style={[
        styles.emailText,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] }
      ]}>
        {email}
      </Text>

      <Alert message={error} type="error" />

      <Input
        label="Verification Code"
        placeholder="000000"
        value={twoFactorCode}
        onChangeText={setTwoFactorCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isLoading}
      />

      <Button
        title={isLoading ? 'Verifying...' : 'Verify Code'}
        onPress={handleTwoFactorVerification}
        loading={isLoading}
        style={styles.marginBottom}
      />

      <View style={styles.buttonRow}>
        <View style={styles.flexOne}>
          <Button
            title="Resend Code"
            onPress={handleResend2FA}
            variant="secondary"
            disabled={isLoading}
          />
        </View>
        <View style={styles.buttonSpacer} />
        <View style={styles.flexOne}>
          <Button
            title="Go Back"
            onPress={resetForm}
            variant="outline"
          />
        </View>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'credentials':
        return renderCredentialsStep();
      case '2fa':
        return renderTwoFactorStep();
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
          { backgroundColor: isDark ? colors.neutral[900] : '#FFFFFF' }
        ]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Header */}
          {currentStep === 'credentials' && (
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="medkit" size={40} color="#FFFFFF" />
              </View>
              <Text style={[
                styles.title,
                { color: isDark ? colors.neutral[100] : colors.secondary[900] }
              ]}>
                Welcome Back
              </Text>
              <Text style={[
                styles.subtitle,
                { color: isDark ? colors.neutral[400] : colors.neutral[600] }
              ]}>
                Sign in to your MDSystem account
              </Text>
            </View>
          )}

          {renderStep()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Data Consent Modal */}
    <DataConsent
      isOpen={showConsent}
      verificationKey={verificationKey}
      purpose="login"
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
    paddingVertical: 48,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: colors.primary[500],
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    // unused
  },
  iconEmoji: {
    // unused
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  stepContainer: {
    width: '100%',
  },
  linkContainer: {
    marginTop: 16,
  },
  divider: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  dividerText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
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
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  marginBottom: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  flexOne: {
    flex: 1,
  },
  buttonSpacer: {
    width: 12,
  },
});

export default LoginScreen;
