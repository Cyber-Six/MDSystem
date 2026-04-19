import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosRequest, TokenStorage } from '../../packages-core-adapter';
import { validatePassword, passwordsMatch } from '@mdsystem/core/validation/password-validation';
import DataConsent from './data-consent';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const OtpInput = ({ value, onChange, disabled }) => {
  const inputsRef = useRef([]);
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = val;
    onChange(next.join('').replace(/ /g, ''));
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        onChange(next.join('').replace(/ /g, ''));
        if (i > 0) inputsRef.current[i - 1]?.focus();
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = '';
        onChange(next.join('').replace(/ /g, ''));
        inputsRef.current[i - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputsRef.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex items-center w-full" style={{ justifyContent: 'space-between' }} onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          autoFocus={i === 0}
          className={`w-11 sm:w-12 h-12 sm:h-14 text-center text-lg font-semibold font-mono
            bg-neutral-50 text-secondary-900
            border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-all duration-150 disabled:opacity-50
            ${d.trim() ? 'border-primary-400' : 'border-neutral-300'}`}
        />
      ))}
    </div>
  );
};

const Register = ({ onBackToLogin, onStepChange }) => {
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

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // reCAPTCHA state
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState(null);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // ── reCAPTCHA v2 setup ────────────────────────────────────────────────
  const renderRecaptcha = useCallback(() => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha || !recaptchaRef.current) return;
    if (recaptchaWidgetId !== null) return;

    window.grecaptcha.ready(() => {
      const id = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token) => setRecaptchaToken(token),
        'expired-callback': () => setRecaptchaToken(''),
        'error-callback': () => setRecaptchaToken(''),
      });
      setRecaptchaWidgetId(id);
    });
  }, [recaptchaWidgetId]);

  const resetRecaptcha = useCallback(() => {
    setRecaptchaToken('');
    if (recaptchaWidgetId !== null && window.grecaptcha) {
      try { window.grecaptcha.reset(recaptchaWidgetId); } catch { /* noop */ }
    }
  }, [recaptchaWidgetId]);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    // Re-render reCAPTCHA widget when switching steps that need it
    if (currentStep !== 1 && currentStep !== 2) return;
    // Reset widget ID so it can be re-rendered on the new DOM element
    setRecaptchaWidgetId(null);
    setRecaptchaToken('');
    const timer = setInterval(() => {
      if (window.grecaptcha && recaptchaRef.current && recaptchaWidgetId === null) {
        renderRecaptcha();
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [currentStep, renderRecaptcha, recaptchaWidgetId]);

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

    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setError('Please complete the reCAPTCHA check.');
      setLoading(false);
      return;
    }

    if (!passwordsMatch(formData.password, formData.confirmPassword)) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
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
        // Account already exists — redirect to login
        if (response.data.userExists) {
          setError('Account already exists. Redirecting to login...');
          setTimeout(() => {
            onBackToLogin();
          }, 2000);
          return;
        }
        // Auto-send OTP immediately after successful registration
        try {
          await axiosRequest.post('/auth/email/verification', {
            email: formData.email,
            recaptchaToken
          });
          setSuccessMessage('Verification code sent to your email!');
        } catch (otpErr) {
          // OTP send failed but registration succeeded — show warning, still advance
          setError(otpErr.response?.data?.message || 'Account created but failed to send verification code. Use resend below.');
        }
        setCurrentStep(2);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;
      
      if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format.');
      } else {
        setError(errorMessage || 'Registration failed. Please try again.');
      }
      resetRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
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
      if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
        setError('Please complete the reCAPTCHA check to resend.');
        setLoading(false);
        return;
      }

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

  // Step 3: Handle consent acceptance from DataConsent modal
  const handleConsentAccept = async () => {
    setError('');
    setLoading(true);

    try {
      // Complete registration after consent has been recorded by DataConsent component
      const response = await axiosRequest.post('/auth/register/complete', {
        verificationKey,
        email: formData.email,
        password: formData.password
      });

      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          
          goToNextStep();
          
          // Redirect after showing success
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        } else {
          // Account already exists - redirect to login
          setError('Account already exists. Redirecting to login...');
          setTimeout(() => {
            navigate('/auth/login', { replace: true });
          }, 2000);
        }
      }
    } catch (err) {
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

  // Handle consent cancellation - reset registration
  const handleConsentCancel = () => {
    setCurrentStep(1);
    setVerificationKey('');
    setFormData({ email: '', password: '', confirmPassword: '' });
    setOtp('');
    setError('');
    setSuccessMessage('');
  };

  // Step 1: Account Creation Form
  const renderAccountStep = () => (
    <div className="w-full max-w-md mx-auto">
      {error && (
        <div className="mb-2 p-2 bg-error-50 border border-error-300 rounded-lg">
          <p className="text-error-600 text-xs text-center mb-0">{error}</p>
        </div>
      )}

      <form onSubmit={handleInitialRegistration} className="space-y-2.5 sm:space-y-3">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-secondary-700 mb-1.5">
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
            className="w-full px-3 py-2 text-sm bg-neutral-50
                     text-secondary-900
                     border border-neutral-300
                     rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     placeholder:text-neutral-400
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-secondary-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="w-full px-3 py-2 text-sm bg-neutral-50
                       text-secondary-900
                       border border-neutral-300
                       rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       pr-8"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700 transition-colors disabled:opacity-50"
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-secondary-700 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="w-full px-3 py-2 text-sm bg-neutral-50
                       text-secondary-900
                       border border-neutral-300
                       rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       pr-8"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700 transition-colors disabled:opacity-50"
              disabled={loading}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* reCAPTCHA widget */}
        {RECAPTCHA_SITE_KEY && (
          <div className="flex justify-center mt-2">
            <div ref={recaptchaRef} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                  
                   text-white font-semibold py-2.5 rounded-md text-sm
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center shadow-md hover:shadow-lg mt-3 sm:mt-4"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {onBackToLogin && (
        <div className="text-center mt-4 sm:mt-6">
          <span className="text-xs text-secondary-500">Already have an account? </span>
          <button
            onClick={onBackToLogin}
            className="text-xs font-medium text-accent-600
                     hover:text-accent-700
                     transition-colors hover:underline"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );

  // Step 2: Verify OTP
  const renderVerifyOtpStep = () => (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-5 sm:mb-6">
        <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 mb-1">
          Verify your email
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          We've sent a 6-digit code to<br />
          <span className="font-semibold text-secondary-900 break-all">{formData.email}</span>
        </p>
      </div>

      {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-300 rounded-lg">
          <p className="text-error-600 text-sm sm:text-xs text-center mb-0">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-success-50 border border-success-300 rounded-lg">
          <p className="text-success-600 text-sm sm:text-xs text-center mb-0">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleVerifyOTP} className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <label className="block text-sm sm:text-xs font-medium text-secondary-700 text-left">
            Verification code
          </label>
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                  
                   text-white font-semibold py-3 sm:py-2.5 rounded-md text-base sm:text-sm
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center shadow-md hover:shadow-lg"
        >
          {loading ? 'Verifying...' : 'Verify code'}
        </button>

        {/* reCAPTCHA widget for resend */}
        {RECAPTCHA_SITE_KEY && (
          <div className="flex justify-center">
            <div ref={recaptchaRef} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={loading}
            className="w-full bg-neutral-100 hover:bg-neutral-200
                   text-secondary-700 font-medium py-3 sm:py-2.5 rounded-md
                   border border-neutral-300
                   transition-all duration-200 disabled:opacity-50 text-base sm:text-sm"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => { setCurrentStep(1); setOtp(''); setError(''); setSuccessMessage(''); }}
            disabled={loading}
            className="w-full bg-white hover:bg-neutral-50
                   text-secondary-700 font-medium py-3 sm:py-2.5 rounded-md
                   border border-neutral-300
                   transition-all duration-200 disabled:opacity-50 text-base sm:text-sm"
          >
            Go back
          </button>
        </div>
      </form>
    </div>
  );

  // Step 3: Consent - Now uses the DataConsent modal
  const renderConsentStep = () => (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="bg-accent-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 mb-2">
          Data Consent Required
        </h2>
        <p className="text-sm text-neutral-600">
          Please review and accept the data consent policy to complete your registration
        </p>
      </div>

      {error && (
          <div className="mb-5 p-3 bg-error-50 border border-error-300 rounded-lg">
          <p className="text-error-600 text-xs text-center mb-0">{error}</p>
        </div>
      )}

      {/* DataConsent modal is rendered at the bottom of the component */}
      <p className="text-center text-neutral-500 text-sm">
        Opening consent agreement...
      </p>
    </div>
  );

  // Step 4: Success
  const renderSuccessStep = () => (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="bg-success-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h2 className="text-3xl font-bold text-secondary-900 mb-4">
        Account Created!
      </h2>
      <p className="text-neutral-600 mb-6">
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
  <div className="w-full">
    {/* Step Content */}
    <div className="transition-opacity duration-300">
      {renderStep()}
    </div>

    {/* Data Consent Modal - Rendered when on consent step */}
    <DataConsent
      isOpen={currentStep === 3}
      verificationKey={verificationKey}
      purpose="register"
      onAccept={handleConsentAccept}
      onCancel={handleConsentCancel}
    />
  </div>
);

};

export default Register;
