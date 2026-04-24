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
  StyleSheet,
  Image,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignInSection } from '../../components/auth/GoogleSignInSection';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Alert } from '../../components/ui/FormComponents';
import { DataConsent } from '../../components/auth/DataConsent';
import {
  getAuthFeatureNotices,
  mobileAuthFeatureConfig,
  withOptionalRecaptcha,
} from '../../config/authFeatures';
import { axiosRequest, TokenStorage } from '../../core';

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

interface GoogleSignInSectionProps {
  clientId: string;
  isDark: boolean;
  isLoading: boolean;
  onError: (message: string) => void;
  onLoadingChange: (value: boolean) => void;
  onIdToken: (idToken: string) => Promise<void>;
}

const GoogleSignInSection: React.FC<GoogleSignInSectionProps> = ({
  clientId,
  isDark,
  isLoading,
  onError,
  onLoadingChange,
  onIdToken,
}) => {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const nonceRef = useRef(Math.random().toString(36).substring(2));

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: AUTH_REDIRECT_SCHEME,
      }),
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: {
        hd: 'tip.edu.ph',
        nonce: nonceRef.current,
      },
    },
    discovery
  );

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        void onIdToken(idToken);
        return;
      }

      onError('Google sign-in did not return an ID token.');
      onLoadingChange(false);
      return;
    }

    if (response.type === 'error') {
      onError('Google sign-in was cancelled or failed.');
      onLoadingChange(false);
      return;
    }

    if (response.type === 'cancel' || response.type === 'dismiss' || response.type === 'locked') {
      onLoadingChange(false);
    }
  }, [response, onError, onIdToken, onLoadingChange]);

  const handlePress = async () => {
    try {
      onError('');
      onLoadingChange(true);
      await promptAsync();
    } catch {
      onError('Google sign-in was cancelled or failed.');
      onLoadingChange(false);
    }
  };

  return (
    <>
      <View style={styles.oauthDivider}>
        <View style={[styles.oauthDividerLine, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300] }]} />
        <Text style={[styles.oauthDividerText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>or</Text>
        <View style={[styles.oauthDividerLine, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300] }]} />
      </View>

      <TouchableOpacity
        style={[
          styles.googleButton,
          {
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          }
        ]}
        onPress={handlePress}
        disabled={isLoading || !request}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
          style={styles.googleIcon}
        />
        <Text style={[
          styles.googleButtonText,
          { color: isDark ? colors.neutral[100] : colors.secondary[900] }
        ]}>
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </Text>
      </TouchableOpacity>
    </>
  );
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess 
}) => {
  const { isDark } = useTheme();
  const { setAuthenticated } = useAuth();
  const isIOS = Platform.OS === 'ios';
  const authFeatureNotices = getAuthFeatureNotices({
    includeGoogleOAuth: true,
    includeRecaptcha: true,
  });
  
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async (idToken: string) => {
    setError('');
    setIsGoogleLoading(true);

    try {
      const res = await axiosRequest.post(
        '/auth/oauth/google',
        withOptionalRecaptcha({
          credential: idToken,
        })
      );

      if (res.data.ok) {
        setVerificationKey(res.data.LoginKey);
        let googleEmail = String(res.data.email || '').trim();
        // Extract email from ID token for 2FA flow
        try {
          const payload = JSON.parse(atob(idToken.split('.')[1]));
          googleEmail = String(payload.email || googleEmail).trim();
        } catch { /* non-critical */ }
        setEmail(googleEmail);

        if (res.data.requires2FA) {
          await handleSend2FA(googleEmail);
          setCurrentStep('2fa');
        } else {
          await completeLoginWithKey(res.data.LoginKey, { promptConsentIfRequired: true });
        }
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Google sign-in failed.';
      switch (errorCode) {
        case 'INVALID_GOOGLE_TOKEN':
          setError('Google authentication failed. Ensure you are using a @tip.edu.ph account.');
          break;
        case 'ACCOUNT_NOT_FOUND':
          setError('No account found for this email. Please register first.');
          break;
        case 'ACCOUNT_LOCKED':
          setError(errorMsg);
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Send 2FA code
  const handleSend2FA = async (targetEmail = email) => {
    try {
      await axiosRequest.post('/auth/email/2fa', { email: targetEmail });
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
      const response = await axiosRequest.post(
        '/auth/login',
        withOptionalRecaptcha({
          email,
          password,
        })
      );
      
      if (response.data.ok) {
        setVerificationKey(response.data.LoginKey);
        
        if (response.data.requires2FA) {
          await handleSend2FA(email);
          setCurrentStep('2fa');
        } else {
          await completeLoginWithKey(response.data.LoginKey, { promptConsentIfRequired: true });
        }
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      
      switch (errorCode) {
        case 'MISSING_FIELDS':
          setError('Please fill in all required fields.');
          break;
        case 'RECAPTCHA_REQUIRED':
        case 'INVALID_RECAPTCHA':
          setError(
            mobileAuthFeatureConfig.recaptchaAvailable
              ? errorMsg
              : `${mobileAuthFeatureConfig.recaptchaStatusMessage ?? 'reCAPTCHA is unavailable for this build.'} Password login can continue only while the server does not require extra verification.`
          );
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
        setCurrentStep('credentials');
        await completeLoginWithKey(newKey, { promptConsentIfRequired: true });
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
      await axiosRequest.post('/auth/email/2fa', { email });
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
  const completeLoginWithKey = async (
    key: string,
    { promptConsentIfRequired = false }: { promptConsentIfRequired?: boolean } = {}
  ) => {
    setError('');
    setIsLoading(true);
    let shouldOpenConsent = false;

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
          if (promptConsentIfRequired) {
            shouldOpenConsent = true;
          } else {
            setError('You must agree to the data consent policy to login.');
          }
          break;
        case 'OUTDATED_CONSENT':
          if (promptConsentIfRequired) {
            shouldOpenConsent = true;
          } else {
            setError('You must agree to the latest data consent policy.');
          }
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setShowConsent(shouldOpenConsent);
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
      {authFeatureNotices.map((notice) => (
        <Alert key={notice} message={notice} type="info" />
      ))}
      
      <Input
        label="Email Address"
        placeholder="your.email@tip.edu.ph"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete={isIOS ? 'off' : 'email'}
        textContentType={isIOS ? 'none' : 'emailAddress'}
        importantForAutofill={isIOS ? 'no' : 'auto'}
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
        showPasswordToggle
        autoComplete={isIOS ? 'off' : 'password'}
        textContentType={isIOS ? 'none' : 'password'}
        importantForAutofill={isIOS ? 'no' : 'auto'}
        autoCorrect={false}
        editable={!isLoading}
      />

      <View style={styles.forgotInlineRow}>
        <TouchableOpacity
          onPress={() => onNavigateToForgotPassword?.()}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.inlineActionLink,
            { color: isDark ? colors.accent[400] : colors.accent[600] }
          ]}>
            Forgot password?
          </Text>
        </TouchableOpacity>
      </View>

      <Button
        title={isLoading ? 'Signing in...' : 'Sign In'}
        onPress={handleInitialLogin}
        loading={isLoading}
        disabled={isLoading}
      />

      {/* Google Sign-In */}
      {mobileAuthFeatureConfig.googleOAuthAvailable ? (
        <GoogleSignInSection
          clientId={mobileAuthFeatureConfig.googleOAuthClientId}
          isDark={isDark}
          isLoading={isGoogleLoading}
          onError={setError}
          onLoadingChange={setIsGoogleLoading}
          onIdToken={handleGoogleLogin}
        />
      ) : null}

      <View style={[
        styles.divider,
        { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }
      ]}>
        <View style={styles.inlinePromptRow}>
          <Text style={[
            styles.inlinePromptText,
            { color: isDark ? colors.neutral[400] : colors.neutral[500] }
          ]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.8}>
            <Text style={[
              styles.inlineActionLink,
              { color: isDark ? colors.accent[400] : colors.accent[600] }
            ]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>
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
          <View style={[
            styles.formCard,
            {
              backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
              borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
            }
          ]}>
            {/* Header */}
            {currentStep === 'credentials' && (
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
  iconEmoji: {
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
  forgotInlineRow: {
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: 14,
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
  oauthDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  oauthDividerLine: {
    flex: 1,
    height: 1,
  },
  oauthDividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
  },
});

export default LoginScreen;
