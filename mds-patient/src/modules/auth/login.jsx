import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosRequest, TokenStorage } from '../../packages-core-adapter.js';
import { detectRoleFromEmail } from '@mdsystem/core/validation/email-validation';
import ForgetPassword from './forget-password.jsx';
import DataConsent from './data-consent/data-consent.jsx';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showTotpVerify, setShowTotpVerify] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [verificationKey, setVerificationKey] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pendingEmail2FA, setPendingEmail2FA] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleSend2FA = async () => {
    try {
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';
      await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
    } catch (err) {
      console.error('Failed to send 2FA code:', err);
    }
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';
      
      const response = await axiosRequest.post('/auth/login', { 
        email, 
        password, 
        recaptchaToken 
      });
      
      if (response.data.ok) {
        const loginKey = response.data.LoginKey;
        setVerificationKey(loginKey);
        
        const needsTotp = response.data.requiresTotp;
        const needsEmail2FA = response.data.requires2FA;

        if (needsTotp) {
          setPendingEmail2FA(needsEmail2FA);
          setShowTotpVerify(true);
        } else if (needsEmail2FA) {
          await handleSend2FA();
          setShowTwoFactor(true);
        } else {
          setShowConsent(true);
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      const errorCode = err.response?.data?.error;
      
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
        case 'INVALID_RECAPTCHA':
          setError('reCAPTCHA verification failed. Please try again.');
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

  // TOTP verification handler
  const handleTotpVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/settings/totp/validate', {
        token: totpCode,
        verificationKey,
        email,
      });

      if (response.data.ok) {
        setShowTotpVerify(false);
        setTotpCode('');

        if (pendingEmail2FA) {
          await handleSend2FA();
          setShowTwoFactor(true);
        } else {
          setShowConsent(true);
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'TOTP verification failed.';
      const errorCode = err.response?.data?.error;

      switch (errorCode) {
        case 'INVALID_TOTP_CODE':
          setError('Invalid authenticator code. Please try again.');
          break;
        case 'INVALID_SESSION':
          setError('Login session expired. Please start over.');
          setShowTotpVerify(false);
          setVerificationKey('');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorVerification = async (e) => {
    e.preventDefault();
    setError('');
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
        setShowTwoFactor(false);
        setShowConsent(true);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || '2FA verification failed.';
      const errorCode = err.response?.data?.error;
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

  const handleResend2FA = async () => {
    setError('');
    setIsLoading(true);

    try {
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';
      const response = await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
      
      if (response.data.ok) {
        setError('');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to resend code.';
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'EMAIL_COOLDOWN_ACTIVE':
          setError('Please wait before requesting another code.');
          break;
        case 'EMAIL_ATTEMPT_LIMIT_REACHED':
          setError('Too many attempts. Please try again later.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Core login-complete call, accepts key directly to avoid stale-state issues
  const completeLoginWithKey = async (key) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/login/complete', { 
        LoginKey: key 
      });
      
      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          // MUST await — setTokens is async and stores both tokens in separate microtasks.
          // Navigation must happen only after both tokens are written to localStorage.
          await TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          // Pass userId in the event detail so SettingsProvider can build the settings
          // key directly without reading from localStorage (avoids any residual race).
          const userId = response.data.refreshToken.split(':')[0];
          window.dispatchEvent(new CustomEvent('mds:auth-changed', { detail: { userId } }));
          // Store detected role for routing (employee vs student) — avoids exposing email
          if (email) {
            const role = detectRoleFromEmail(email.toLowerCase().trim()) || 'Student';
            localStorage.setItem('patient_role', role);
          }
        }
        navigate('/');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login completion failed.';
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'INVALID_LOGIN_SESSION':
          setError('Login session is invalid or expired. Please try again.');
          setShowConsent(false);
          setShowTwoFactor(false);
          setShowTotpVerify(false);
          setVerificationKey('');
          break;
        case '2FA_NOT_VERIFIED':
          setError('Email 2FA has not been verified.');
          setShowConsent(false);
          setShowTwoFactor(true);
          break;
        case 'TOTP_NOT_VERIFIED':
          setError('Authenticator 2FA has not been verified.');
          setShowConsent(false);
          setShowTotpVerify(true);
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

  // Initial login form
  if (!showTwoFactor && !showTotpVerify) {
    return (
      <>
        <div className="w-full max-w-md mx-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-error-50 dark:bg-red-900/30 border border-error-300 dark:border-red-700 rounded-lg">
              <p className="text-error-600 dark:text-red-400 text-sm text-center">
                {error}
              </p>
            </div>
          )}
          
          <form onSubmit={handleInitialLogin} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2">
              Email Address
            </label>
            <input 
              id="email"
              type="email" 
              placeholder="your.email@tip.edu.ph" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900
                       text-secondary-900 dark:text-white
                       border border-neutral-300 dark:border-neutral-600
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input 
                id="password"
                type={showPassword ? "text" : "password"} 
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900
                         text-secondary-900 dark:text-white
                         border border-neutral-300 dark:border-neutral-600
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Login Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                    
                     text-white font-semibold py-3.5 rounded-lg
                     transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
          
          {/* Forgot Password */}
          <div className="text-center pt-2">
            <button 
              type="button" 
              onClick={() => setShowForgotPassword(true)}
              className="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300
                       font-medium text-sm transition-colors hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        </form>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 flex items-center justify-center z-20 px-4 py-8">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowForgotPassword(false)}
            />
            
            {/* Modal Card */}
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl">
              <div className="px-8 md:px-6 sm:px-5 py-8 md:py-6">
                {/* Forgot Password Component */}
                <ForgetPassword
                  onBackToLogin={() => setShowForgotPassword(false)}
                />
              </div>
            </div>
          </div>
        )}

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
  }

  // TOTP authenticator verification form
  if (showTotpVerify) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-100 dark:bg-primary-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-3">
            Authenticator Verification
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Enter the 6-digit code from your<br />
            authenticator app
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-red-900/30 border border-error-300 dark:border-red-700 rounded-lg">
            <p className="text-error-600 dark:text-red-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleTotpVerification} className="space-y-5">
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2 text-center">
              Authenticator Code
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              required
              disabled={isLoading}
              autoFocus
              className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-900
                       text-secondary-900 dark:text-white text-center text-2xl font-mono tracking-widest
                       border-2 border-neutral-300 dark:border-neutral-600
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:text-xl
                       transition-all duration-200 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || totpCode.length !== 6}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                     text-white font-semibold py-3.5 rounded-lg
                     transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </>
            ) : 'Verify Code'}
          </button>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setShowTotpVerify(false);
                setVerificationKey('');
                setTotpCode('');
                setPendingEmail2FA(false);
                setError('');
              }}
              className="w-full bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700
                       text-secondary-700 dark:text-neutral-300 font-medium py-3 rounded-lg
                       border border-neutral-300 dark:border-neutral-600
                       transition-all duration-200 text-sm"
            >
              Go Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Two-factor authentication form
  if (showTwoFactor) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-100 dark:bg-primary-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-3">
            Verify Your Email
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            We've sent a 6-digit code to<br />
            <span className="font-semibold text-secondary-900 dark:text-white">{email}</span>
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-red-900/30 border border-error-300 dark:border-red-700 rounded-lg">
            <p className="text-error-600 dark:text-red-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}
        
        <form onSubmit={handleTwoFactorVerification} className="space-y-5">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2 text-center">
              Verification Code
            </label>
            <input 
              id="otp"
              type="text" 
              placeholder="000000" 
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              maxLength={6}
              required
              disabled={isLoading}
              className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-900
                       text-secondary-900 dark:text-white text-center text-2xl font-mono tracking-widest
                       border-2 border-neutral-300 dark:border-neutral-600
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:text-xl
                       transition-all duration-200 disabled:opacity-50"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                    
                     text-white font-semibold py-3.5 rounded-lg
                     transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center shadow-md hover:shadow-lg"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
          
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={handleResend2FA}
              disabled={isLoading}
              className="flex-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700
                       text-secondary-700 dark:text-neutral-300 font-medium py-3 rounded-lg 
                       border border-neutral-300 dark:border-neutral-600
                       transition-all duration-200 disabled:opacity-50 text-sm"
            >
              Resend Code
            </button>
            
            <button 
              type="button" 
              onClick={() => {
                setShowTwoFactor(false);
                setVerificationKey('');
                setTwoFactorCode('');
              }}
              className="flex-1 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700
                       text-secondary-700 dark:text-neutral-300 font-medium py-3 rounded-lg 
                       border border-neutral-300 dark:border-neutral-600
                       transition-all duration-200 text-sm"
            >
              Go Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
};

export default Login;
