import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [verificationKey, setVerificationKey] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
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
      const response = await axiosRequest.post('/login', { 
        email, 
        password, 
        role: selectedRole,
        recaptchaToken 
      });
      
      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        
        if (response.data.requires2FA) {
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

  const handleTwoFactorVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/email/2fa/verify', { 
        email,
        otp: twoFactorCode 
      });
      
      if (response.data.ok) {
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

  const handleCompleteLogin = async () => {
    if (!consentAgreed) {
      setError('You must agree to the data consent policy to continue.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/login/complete', { 
        verificationKey 
      });
      
      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
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
          setVerificationKey('');
          break;
        case '2FA_NOT_VERIFIED':
          setError('Email 2FA has not been verified.');
          setShowConsent(false);
          setShowTwoFactor(true);
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
    }
  };

  // Initial login form
  if (!showTwoFactor && !showConsent) {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
            <p className="text-error-600 dark:text-error-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}
        
        <form onSubmit={handleInitialLogin} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2">
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
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary 
                       text-secondary-900 dark:text-dark-text-primary 
                       border border-neutral-300 dark:border-dark-border-primary 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2">
              Password
            </label>
            <input 
              id="password"
              type="password" 
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary 
                       text-secondary-900 dark:text-dark-text-primary 
                       border border-neutral-300 dark:border-dark-border-primary 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Role Select */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2">
              Role
            </label>
            <select 
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary 
                       text-secondary-900 dark:text-dark-text-primary 
                       border border-neutral-300 dark:border-dark-border-primary 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23737373'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundSize: '1.5em',
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="">Select your role</option>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          {/* Login Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                     dark:bg-primary-600 dark:hover:bg-primary-700
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
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary mb-3">
            Verify Your Email
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary leading-relaxed">
            We've sent a 6-digit code to<br />
            <span className="font-semibold text-secondary-900 dark:text-dark-text-primary">{email}</span>
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
            <p className="text-error-600 dark:text-error-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}
        
        <form onSubmit={handleTwoFactorVerification} className="space-y-5">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2 text-center">
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
              className="w-full px-4 py-4 bg-neutral-50 dark:bg-dark-bg-tertiary 
                       text-secondary-900 dark:text-dark-text-primary text-center text-2xl font-mono tracking-widest
                       border-2 border-neutral-300 dark:border-dark-border-primary 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary placeholder:text-xl
                       transition-all duration-200 disabled:opacity-50"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                     dark:bg-primary-600 dark:hover:bg-primary-700
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
              className="flex-1 bg-neutral-100 dark:bg-dark-bg-tertiary hover:bg-neutral-200 dark:hover:bg-secondary-700
                       text-secondary-700 dark:text-dark-text-primary font-medium py-3 rounded-lg 
                       border border-neutral-300 dark:border-dark-border-primary
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
              className="flex-1 bg-white dark:bg-dark-bg-primary hover:bg-neutral-50 dark:hover:bg-secondary-800
                       text-secondary-700 dark:text-dark-text-primary font-medium py-3 rounded-lg 
                       border border-neutral-300 dark:border-dark-border-secondary
                       transition-all duration-200 text-sm"
            >
              Go Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Data consent form
  if (showConsent) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="bg-accent-100 dark:bg-accent-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary mb-2">
            Data Consent Policy
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
            Please review and agree to continue
          </p>
        </div>
        
        {error && (
          <div className="mb-5 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
            <p className="text-error-600 dark:text-error-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}
        
        {/* Consent Content */}
        <div className="bg-neutral-50 dark:bg-dark-bg-tertiary border border-neutral-300 dark:border-dark-border-primary rounded-lg p-6 mb-5 max-h-80 overflow-y-auto">
          <div className="space-y-4 text-neutral-700 dark:text-dark-text-secondary text-sm leading-relaxed">
            <p>
              By using the TIP Medical System, you agree to the collection and processing of your personal and medical data in accordance with our privacy policy and the Data Privacy Act of 2012.
            </p>
            
            <div>
              <h3 className="font-semibold text-secondary-900 dark:text-dark-text-primary mb-1">Data Collection</h3>
              <p>We collect personal information including your name, email, contact details, medical history, and health records.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-secondary-900 dark:text-dark-text-primary mb-1">Data Usage</h3>
              <p>Your data will be used solely for medical purposes including diagnosis, treatment, and health monitoring.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-secondary-900 dark:text-dark-text-primary mb-1">Data Protection</h3>
              <p>All data is encrypted and access is restricted to authorized medical personnel only.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-secondary-900 dark:text-dark-text-primary mb-1">Your Rights</h3>
              <p>You have the right to access, rectify, and request deletion of your personal data.</p>
            </div>
          </div>
        </div>
        
        {/* Consent Checkbox */}
        <label className="flex items-start space-x-3 mb-6 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 border-2 border-neutral-400 dark:border-dark-border-primary 
                     rounded bg-white dark:bg-dark-bg-tertiary
                     checked:bg-primary-500 checked:border-primary-500 
                     focus:ring-2 focus:ring-primary-300
                     transition-all cursor-pointer"
          />
          <span className="text-sm text-secondary-700 dark:text-dark-text-secondary group-hover:text-secondary-900 dark:group-hover:text-dark-text-primary transition-colors">
            I agree to the data consent policy and terms of service
          </span>
        </label>
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={handleCompleteLogin}
            disabled={isLoading || !consentAgreed}
            className="flex-1 bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                     dark:bg-primary-600 dark:hover:bg-primary-700
                     text-white font-semibold py-3.5 rounded-lg
                     transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isLoading ? 'Processing...' : 'Accept & Continue'}
          </button>
          
          <button 
            type="button" 
            onClick={() => {
              setShowConsent(false);
              setVerificationKey('');
              setConsentAgreed(false);
            }}
            disabled={isLoading}
            className="flex-1 bg-white dark:bg-dark-bg-primary hover:bg-neutral-50 dark:hover:bg-secondary-800
                     text-secondary-700 dark:text-dark-text-primary font-medium py-3.5 rounded-lg 
                     border border-neutral-300 dark:border-dark-border-secondary
                     transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Login;