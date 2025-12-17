import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';

const TOTAL_STEPS = 5;

const Register = ({ onBackToLogin }) => {
  const navigate = useNavigate();

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
  const [consentData, setConsentData] = useState(null);
  const [consentVersion, setConsentVersion] = useState(null);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
            setConsentVersion(response.data.data_consent_version);
          }
        } catch (err) {
          console.error('Failed to fetch consent data:', err);
          // Use fallback static content if GET fails
        }
      }
    };
    fetchConsentData();
  }, [currentStep, consentData, verificationKey]);

  // Step 1: Initial Registration
  const handleInitialRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/auth/register', {
        email: formData.email,
        password: formData.password
      });

      if (response.data.ok) {
        goToNextStep();
      }
    } catch (err) {
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
      const recaptchaToken = 'RECAPTCHA_TOKEN_PLACEHOLDER';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('Verification code sent to your email!');
        goToNextStep();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message;
      setError(errorMessage || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/auth/email/verification/verify', {
        email: formData.email,
        otp: otp
      });

      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        goToNextStep();
      }
    } catch (err) {
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
      const recaptchaToken = 'RECAPTCHA_TOKEN_PLACEHOLDER';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('A new verification code has been sent!');
        setOtp('');
      }
    } catch (err) {
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
  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!consentAccepted) {
      setError('You must accept the data consent agreement to continue.');
      setLoading(false);
      return;
    }

    try {
      // Record consent with verificationKey
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
          // Store tokens
          console.log("📦 Registration response:", { 
            hasAccessToken: !!response.data.accessToken, 
            hasRefreshToken: !!response.data.refreshToken,
            message: response.data.message 
          });
          
          if (response.data.accessToken && response.data.refreshToken) {
            TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
            console.log("✅ Tokens stored successfully");
            
            goToNextStep();
            
            // Redirect after showing success
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 2000);
          } else {
            // Account already exists - redirect to login
            console.warn("⚠️ Account already exists, redirecting to login");
            setError('Account already exists. Redirecting to login...');
            setTimeout(() => {
              navigate('/auth/login', { replace: true });
            }, 2000);
          }
        }
      }
    } catch (err) {
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

  // Step 1: Account Creation Form
  const renderAccountStep = () => (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <img 
          src="/MDSystem.png" 
          alt="MDSystem Logo" 
          className="h-24 w-24 mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary font-heading mb-1">
          Create Account
        </h1>
        <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
          Fill in your details to get started
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
          <p className="text-error-600 dark:text-error-400 text-xs text-center">{error}</p>
        </div>
      )}

      <form onSubmit={handleInitialRegistration} className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-secondary-700 dark:text-dark-text-primary mb-1.5">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="your.email@tip.edu.ph"
            value={formData.email}
            onChange={handleInputChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-dark-bg-tertiary 
                     text-secondary-900 dark:text-dark-text-primary 
                     border border-neutral-300 dark:border-dark-border-primary 
                     rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-secondary-700 dark:text-dark-text-primary mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleInputChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-dark-bg-tertiary 
                     text-secondary-900 dark:text-dark-text-primary 
                     border border-neutral-300 dark:border-dark-border-primary 
                     rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-secondary-700 dark:text-dark-text-primary mb-1.5">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-dark-bg-tertiary 
                     text-secondary-900 dark:text-dark-text-primary 
                     border border-neutral-300 dark:border-dark-border-primary 
                     rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                   dark:bg-primary-600 dark:hover:bg-primary-700
                   text-white font-semibold py-2.5 rounded-md text-sm
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center shadow-md hover:shadow-lg mt-4"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {onBackToLogin && (
        <div className="text-center mt-4">
          <button
            onClick={onBackToLogin}
            className="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 
                     font-medium text-xs transition-colors hover:underline"
          >
            ← Back to Login
          </button>
        </div>
      )}
    </div>
  );

  // Step 2: Send OTP
  const renderSendOtpStep = () => (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="bg-primary-100 dark:bg-primary-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
        <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary mb-3">
        Verify Your Email
      </h2>
      <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-2">
        We'll send a verification code to
      </p>
      <p className="font-semibold text-secondary-900 dark:text-dark-text-primary mb-6">
        {formData.email}
      </p>

      {error && (
        <div className="mb-5 p-3 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
          <p className="text-error-600 dark:text-error-400 text-xs text-center">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3 bg-success-50 dark:bg-success-900/20 border border-success-300 dark:border-success-700 rounded-lg">
          <p className="text-success-600 dark:text-success-400 text-xs text-center">{successMessage}</p>
        </div>
      )}

      <button
        onClick={handleSendOTP}
        disabled={loading}
        className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                 dark:bg-primary-600 dark:hover:bg-primary-700
                 text-white font-semibold py-2.5 rounded-md text-sm
                 transition-all duration-200 
                 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-center shadow-md hover:shadow-lg"
      >
        {loading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </div>
  );

  // Step 3: Verify OTP
  const renderVerifyOtpStep = () => (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="bg-primary-100 dark:bg-primary-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary mb-3">
          Enter Verification Code
        </h2>
        <p className="text-sm text-neutral-600 dark:text-dark-text-secondary leading-relaxed">
          We've sent a code to<br />
          <span className="font-semibold text-secondary-900 dark:text-dark-text-primary">{formData.email}</span>
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
          <p className="text-error-600 dark:text-error-400 text-xs text-center">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3 bg-success-50 dark:bg-success-900/20 border border-success-300 dark:border-success-700 rounded-lg">
          <p className="text-success-600 dark:text-success-400 text-xs text-center">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleVerifyOTP} className="space-y-5">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2 text-center">
            Verification Code
          </label>
          <input
            id="otp"
            type="text"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            required
            disabled={loading}
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
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                   dark:bg-primary-600 dark:hover:bg-primary-700
                   text-white font-semibold py-2.5 rounded-md text-sm
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center shadow-md hover:shadow-lg"
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        <button
          type="button"
          onClick={handleResendOTP}
          disabled={loading}
          className="w-full bg-neutral-100 dark:bg-dark-bg-tertiary hover:bg-neutral-200 dark:hover:bg-secondary-700
                   text-secondary-700 dark:text-dark-text-primary font-medium py-2.5 rounded-md 
                   border border-neutral-300 dark:border-dark-border-primary
                   transition-all duration-200 disabled:opacity-50 text-sm"
        >
          Resend Code
        </button>
      </form>
    </div>
  );

  // Step 4: Consent
  const renderConsentStep = () => (
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
        <div className="mb-5 p-3 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
          <p className="text-error-600 dark:text-error-400 text-xs text-center">{error}</p>
        </div>
      )}

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

      <form onSubmit={handleConsentSubmit}>
        <label className="flex items-start space-x-3 mb-6 cursor-pointer group">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
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

        <button
          type="submit"
          disabled={loading || !consentAccepted}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                   dark:bg-primary-600 dark:hover:bg-primary-700
                   text-white font-semibold py-2.5 rounded-md text-sm
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center shadow-md hover:shadow-lg"
        >
          {loading ? 'Completing Registration...' : 'Accept & Complete Registration'}
        </button>
      </form>
    </div>
  );

  // Step 5: Success
  const renderSuccessStep = () => (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="bg-success-100 dark:bg-success-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h2 className="text-3xl font-bold text-secondary-900 dark:text-dark-text-primary mb-4">
        Account Created!
      </h2>
      <p className="text-neutral-600 dark:text-dark-text-secondary mb-6">
        Your account has been created successfully.<br />
        Redirecting to dashboard...
      </p>

      <div className="flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
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
  <div className="w-full">
    {/* Step Progress Bar */}
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-neutral-600 dark:text-dark-text-secondary">
          Step {currentStep} of {TOTAL_STEPS}
        </span>
        <span className="text-xs font-medium text-neutral-600 dark:text-dark-text-secondary">
          {Math.round((currentStep / TOTAL_STEPS) * 100)}%
        </span>
      </div>

      <div className="w-full bg-neutral-200 dark:bg-dark-bg-tertiary rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary-500 dark:bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>

    {/* Step Content */}
    <div className="transition-opacity duration-300">
      {renderStep()}
    </div>
  </div>
);

};

export default Register;
