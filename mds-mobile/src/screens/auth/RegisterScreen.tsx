/**
 * Register Screen for MDSystem Mobile
 * Multi-step registration flow matching the frontend
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Alert, LinkButton, Checkbox } from '../../components/ui/FormComponents';
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

const TOTAL_STEPS = 5;

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
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentData, setConsentData] = useState<string | null>(null);

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

  // Fetch consent data when reaching consent step
  useEffect(() => {
    const fetchConsentData = async () => {
      if (currentStep === 4 && !consentData && verificationKey) {
        try {
          const response = await axiosRequest.get(`/info/consent/register?verificationKey=${verificationKey}`);
          if (response.data.ok) {
            setConsentData(response.data.consent_text);
          }
        } catch (err) {
          console.error('Failed to fetch consent data:', err);
        }
      }
    };
    fetchConsentData();
  }, [currentStep, consentData, verificationKey]);

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
        goToNextStep();
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'EMAIL_EXISTS') {
        setError('This email is already registered. Please login instead.');
      } else if (errorCode === 'INVALID_EMAIL_FORMAT') {
        setError('Please enter a valid email address.');
      } else if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format.');
      } else {
        setError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Send Email Verification OTP
  const handleSendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      const recaptchaToken = 'MOBILE_APP_TOKEN';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('Verification code sent to your email!');
        goToNextStep();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message;
      setError(errorMessage || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP
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
      const recaptchaToken = 'MOBILE_APP_TOKEN';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('A new verification code has been sent!');
        setOtp('');
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;

      if (errorCode === 'EMAIL_COOLDOWN_ACTIVE') {
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

  // Step 4: Submit Consent and Complete Registration
  const handleConsentSubmit = async () => {
    setError('');

    if (!consentAccepted) {
      setError('You must accept the data consent agreement to continue.');
      return;
    }

    setLoading(true);

    try {
      // Record consent
      const consentResponse = await axiosRequest.post('/info/consent/register', {
        verificationKey
      });

      if (consentResponse.data.ok) {
        // Complete registration
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
            setError('Account already exists. Redirecting to login...');
            setTimeout(() => {
              onNavigateToLogin();
            }, 2000);
          }
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
        setError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
        editable={!loading}
      />

      <Input
        label="Confirm Password"
        placeholder="Re-enter your password"
        value={formData.confirmPassword}
        onChangeText={(value) => handleInputChange('confirmPassword', value)}
        secureTextEntry
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
        <Text style={[
          styles.dividerText,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          Already have an account?
        </Text>
        <Button
          title="Sign In"
          onPress={onNavigateToLogin}
          variant="outline"
        />
      </View>
    </View>
  );

  // Step 2: Send OTP
  const renderSendOtpStep = () => (
    <View style={styles.centeredStep}>
      <View style={[
        styles.iconCircle,
        { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.2)' : colors.primary[100] }
      ]}>
        <Text style={styles.iconEmoji}>📧</Text>
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
        We'll send a verification code to
      </Text>
      <Text style={[
        styles.emailText,
        { color: isDark ? colors.neutral[100] : colors.secondary[900] }
      ]}>
        {formData.email}
      </Text>

      <Alert message={error} type="error" />
      {successMessage && <Alert message={successMessage} type="success" />}

      <Button
        title={loading ? 'Sending...' : 'Send Verification Code'}
        onPress={handleSendOTP}
        loading={loading}
      />
    </View>
  );

  // Step 3: Verify OTP
  const renderVerifyOtpStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.centeredHeader}>
        <View style={[
          styles.iconCircle,
          { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.2)' : colors.primary[100] }
        ]}>
          <Text style={styles.iconEmoji}>✅</Text>
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

  // Step 4: Consent
  const renderConsentStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.centeredHeader}>
        <View style={[
          styles.iconCircle,
          { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : colors.accent[100] }
        ]}>
          <Text style={styles.iconEmoji}>🛡️</Text>
        </View>

        <Text style={[
          styles.stepTitle,
          { color: isDark ? colors.neutral[100] : colors.secondary[900] }
        ]}>
          Data Consent Policy
        </Text>
        
        <Text style={[
          styles.stepSubtitle,
          { color: isDark ? colors.neutral[400] : colors.neutral[600] }
        ]}>
          Please review and agree to continue
        </Text>
      </View>

      <Alert message={error} type="error" />

      {/* Consent Content */}
      <View style={[
        styles.consentBox,
        { 
          backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
          borderColor: isDark ? colors.neutral[700] : colors.neutral[300]
        }
      ]}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
          <Text style={[
            styles.consentText,
            { color: isDark ? colors.neutral[300] : colors.neutral[700] }
          ]}>
            By using the TIP Medical System, you agree to the collection and processing of your personal and medical data in accordance with our privacy policy and the Data Privacy Act of 2012.
          </Text>
          
          <Text style={[
            styles.consentHeading,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>Data Collection</Text>
          <Text style={[
            styles.consentText,
            { color: isDark ? colors.neutral[300] : colors.neutral[700] }
          ]}>
            We collect personal information including your name, email, contact details, medical history, and health records.
          </Text>

          <Text style={[
            styles.consentHeading,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>Data Usage</Text>
          <Text style={[
            styles.consentText,
            { color: isDark ? colors.neutral[300] : colors.neutral[700] }
          ]}>
            Your data will be used solely for medical purposes including diagnosis, treatment, and health monitoring.
          </Text>

          <Text style={[
            styles.consentHeading,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>Data Protection</Text>
          <Text style={[
            styles.consentText,
            { color: isDark ? colors.neutral[300] : colors.neutral[700] }
          ]}>
            All data is encrypted and access is restricted to authorized medical personnel only.
          </Text>

          <Text style={[
            styles.consentHeading,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] }
          ]}>Your Rights</Text>
          <Text style={[
            styles.consentText,
            { color: isDark ? colors.neutral[300] : colors.neutral[700] }
          ]}>
            You have the right to access, rectify, and request deletion of your personal data.
          </Text>
        </ScrollView>
      </View>

      <Checkbox
        checked={consentAccepted}
        onPress={() => setConsentAccepted(!consentAccepted)}
        label="I agree to the data consent policy and terms of service"
      />

      <Button
        title={loading ? 'Completing Registration...' : 'Accept & Complete Registration'}
        onPress={handleConsentSubmit}
        loading={loading}
        disabled={!consentAccepted}
      />
    </View>
  );

  // Step 5: Success
  const renderSuccessStep = () => (
    <View style={styles.centeredStep}>
      <View style={[
        styles.successCircle,
        { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : colors.success[100] }
      ]}>
        <Text style={styles.successCheckmark}>✓</Text>
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
        return renderSendOtpStep();
      case 3:
        return renderVerifyOtpStep();
      case 4:
        return renderConsentStep();
      case 5:
        return renderSuccessStep();
      default:
        return null;
    }
  };

  return (
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
          {currentStep === 1 && (
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoEmoji}>🏥</Text>
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
                Join MDSystem today
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          {currentStep > 1 && renderProgressBar()}

          {/* Step Content */}
          {renderStep()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 40,
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
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 40,
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
  consentBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  consentHeading: {
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 48,
    color: colors.success[500],
    fontWeight: 'bold',
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
