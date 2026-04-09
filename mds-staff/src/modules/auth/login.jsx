import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosRequest, TokenStorage } from '../../packages-core-adapter.js';
import ForgetPassword from './forget-password.jsx';
import DataConsent from './data-consent/data-consent.jsx';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED !== 'false';

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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // reCAPTCHA — shown after successful credential verification, gates access to 2FA
  const [showCaptchaGate, setShowCaptchaGate] = useState(false);
  const [pendingNeedsTotp, setPendingNeedsTotp] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState(null);
  const [mockCaptchaChecked, setMockCaptchaChecked] = useState(false);
  const recaptchaRef = useRef(null);
  const googleBtnRef = useRef(null);
  
  const navigate = useNavigate();

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

  // Render the reCAPTCHA widget when the captcha gate step is shown
  useEffect(() => {
    if (!showCaptchaGate || !RECAPTCHA_SITE_KEY) return;
    const timer = setInterval(() => {
      if (window.grecaptcha && recaptchaRef.current && recaptchaWidgetId === null) {
        renderRecaptcha();
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [showCaptchaGate, renderRecaptcha, recaptchaWidgetId]);

  // ── Google Sign-In setup ──────────────────────────────────────────────
  const handleGoogleCredential = useCallback(async (response) => {
    if (!response.credential) return;
    setError('');
    setIsLoading(true);

    try {
      const res = await axiosRequest.post('/auth/oauth/google', {
        credential: response.credential,
      });

      if (res.data.ok) {
        const loginKey = res.data.LoginKey;
        setVerificationKey(loginKey);
        // Extract email from Google JWT payload for 2FA flow
        try {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          setEmail(payload.email || '');
        } catch { /* email will be empty — non-critical */ }

        setPendingNeedsTotp(res.data.requiresTotp || false);
        setRecaptchaWidgetId(null);
        setRecaptchaToken('');
        setMockCaptchaChecked(false);
        setShowCaptchaGate(true);
      }
    } catch (err) {
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_OAUTH_ENABLED) {
      if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
      return;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          hosted_domain: 'tip.edu.ph',
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: googleBtnRef.current.offsetWidth || 320,
        });
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [handleGoogleCredential]);

  // ── reCAPTCHA token helper for password-based calls ───────────────────
  const getRecaptchaToken = () => recaptchaToken;

  const handleSend2FA = async () => {
    try {
      await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken: getRecaptchaToken()
      });
    } catch (err) {
      console.error('Failed to send 2FA code:', err);
    }
  };

  // Called when user completes reCAPTCHA on the captcha gate:
  // proceeds to TOTP input or sends the email OTP
  const handleProceedAfterCaptcha = async () => {
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setError('Please complete the reCAPTCHA check.');
      return;
    }
    setError('');
    setShowCaptchaGate(false);
    if (pendingNeedsTotp) {
      setShowTotpVerify(true);
    } else {
      setIsLoading(true);
      await handleSend2FA();
      setIsLoading(false);
      setShowTwoFactor(true);
    }
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/login', { email, password });

      if (response.data.ok) {
        setVerificationKey(response.data.LoginKey);
        const needsTotp = response.data.requiresTotp || false;
        setPendingNeedsTotp(needsTotp);

        if (response.data.requiresCaptcha) {
          // ≥3 failed attempts prior — gate through reCAPTCHA before 2FA
          setRecaptchaWidgetId(null);
          setRecaptchaToken('');
          setMockCaptchaChecked(false);
          setShowCaptchaGate(true);
        } else if (needsTotp) {
          setShowTotpVerify(true);
        } else {
          await handleSend2FA();
          setShowTwoFactor(true);
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
        case 'ACCOUNT_LOCKED':
          setError(errorMsg);
          break;
        case 'STAFF_ACCOUNT_SUSPENDED':
          setError(errorMsg);
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
    // If reCAPTCHA token expired, return to captcha gate to re-verify
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setShowTwoFactor(false);
      setRecaptchaWidgetId(null);
      setRecaptchaToken('');
      setMockCaptchaChecked(false);
      setPendingNeedsTotp(false);
      setShowCaptchaGate(true);
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const response = await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken: getRecaptchaToken()
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
        // TOTP verified — proceed to consent (email OTP not needed)
        setShowConsent(true);
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

  // Switch from TOTP to email OTP instead
  const handleUseEmailInstead = async () => {
    setError('');
    setTotpCode('');
    setShowTotpVerify(false);
    // If reCAPTCHA token expired, return to captcha gate to re-verify
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setRecaptchaWidgetId(null);
      setRecaptchaToken('');
      setMockCaptchaChecked(false);
      setPendingNeedsTotp(false);
      setShowCaptchaGate(true);
      return;
    }
    await handleSend2FA();
    setShowTwoFactor(true);
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
          // MUST await — setTokens is async and stores the refresh token in the second
          // microtask. The event must fire only after both tokens are in storage.
          await TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          // Pass userId in the event detail so SettingsProvider can build the settings
          // key directly without reading from localStorage (avoids any residual race).
          const userId = response.data.refreshToken.split(':')[0];
          window.dispatchEvent(new CustomEvent('mds:auth-changed', { detail: { userId } }));
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
          setError('2FA has not been verified.');
          setShowConsent(false);
          setShowTwoFactor(true);
          break;
        case 'DATA_CONSENT_REQUIRED':
          setError('You must agree to the data consent policy to login.');
          break;
        case 'OUTDATED_CONSENT':
          setError('You must agree to the latest data consent policy.');
          break;
        case 'STAFF_ACCOUNT_PENDING':
          setError('Your staff account is not yet activated. Contact your administrator to grant you access.');
          setShowConsent(false);
          break;
        case 'STAFF_ACCOUNT_SUSPENDED':
          setError('Your staff account has been suspended. Contact your administrator.');
          setShowConsent(false);
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

  // Captcha gate — shown after successful credential verification, before 2FA
  if (showCaptchaGate) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-3">Security Check</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Please verify you&apos;re not a robot<br />
            before continuing.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-300 rounded-lg">
            <p className="text-error-600 text-sm text-center mb-0">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* reCAPTCHA v2 widget */}
          {RECAPTCHA_SITE_KEY ? (
            <div ref={recaptchaRef} id="staff-recaptcha-container" className="flex justify-center"></div>
          ) : (
            <button
              type="button"
              onClick={() => setMockCaptchaChecked(v => !v)}
              className="w-full border border-[#d3d3d3] rounded bg-[#f9f9f9] shadow-sm flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#f2f2f2] transition-colors text-left"
            >
              <div className="w-6 h-6 border-2 border-[#c1c1c1] rounded-sm flex-shrink-0 bg-white shadow-inner flex items-center justify-center">
                {mockCaptchaChecked && (
                  <svg viewBox="0 0 12 12" className="w-4 h-4 text-[#1a73e8]" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1.5,6 4.5,9.5 10.5,2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="flex-1 text-[13px] text-[#555] leading-tight">I&apos;m not a robot</span>
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <svg viewBox="0 0 46 52" className="w-8 h-8">
                  <path fill="#4285F4" d="M23 1L2 10.5V26C2 39 11.5 49 23 52 34.5 49 44 39 44 26V10.5L23 1Z"/>
                  <path fill="#34A853" d="M23 1V52C34.5 49 44 39 44 26V10.5L23 1Z"/>
                  <circle cx="23" cy="26" r="10" fill="none" stroke="white" strokeWidth="2.5"/>
                  <path fill="white" d="M23 15L27 21H19Z"/>
                </svg>
                <span className="text-[9px] font-medium leading-none text-[#777]">reCAPTCHA</span>
                <span className="text-[8px] leading-none text-[#aaa]">Privacy · Terms</span>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={handleProceedAfterCaptcha}
            disabled={isLoading || (RECAPTCHA_SITE_KEY ? !recaptchaToken : !mockCaptchaChecked)}
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
                Sending...
              </>
            ) : 'Continue'}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCaptchaGate(false);
              setVerificationKey('');
              setPendingNeedsTotp(false);
              setRecaptchaWidgetId(null);
              setRecaptchaToken('');
              setMockCaptchaChecked(false);
              setError('');
            }}
            className="w-full bg-white hover:bg-neutral-50
                     text-secondary-700 font-medium py-3 rounded-lg
                     border border-neutral-300
                     transition-all duration-200 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Initial login form
  if (!showTwoFactor && !showTotpVerify) {
    return (
      <>
        <div className="w-full max-w-md mx-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-error-50 border border-error-300 rounded-lg">
              <p className="text-error-600 text-sm text-center mb-0">
                {error}
              </p>
            </div>
          )}
          
          <form onSubmit={handleInitialLogin} className="space-y-3 sm:space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
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
              className="w-full px-4 py-3 bg-neutral-50
                       text-secondary-900
                       border border-neutral-300 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
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
                className="w-full px-4 py-3 bg-neutral-50
                         text-secondary-900
                         border border-neutral-300
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder:text-neutral-400
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700 transition-colors disabled:opacity-50"
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
              className="text-accent-600 hover:text-accent-700
                       font-medium text-sm transition-colors hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        </form>

          {/* OAuth Divider */}
          {GOOGLE_OAUTH_ENABLED && (
            <>
              <div className="relative my-3 sm:my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-neutral-500">or</span>
                </div>
              </div>

              {/* Google Sign-In Button — real GIS button when configured, mock for dev/test */}
              {GOOGLE_CLIENT_ID ? (
                <div ref={googleBtnRef} className="flex justify-center w-full [&>div]:!w-full"></div>
              ) : (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setError('Google OAuth is not available.')}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 active:bg-neutral-100 shadow-sm hover:shadow transition-all duration-150 text-sm font-medium text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.09-6.09C34.46 3.09 29.53 1 24 1 14.82 1 7.02 6.7 3.77 14.7l7.08 5.5C12.6 13.48 17.85 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.74H24v8.98h12.67c-.55 2.94-2.21 5.43-4.71 7.1l7.34 5.7C43.43 37.22 46.52 31.32 46.52 24.5z"/>
                    <path fill="#FBBC05" d="M10.85 28.2A14.56 14.56 0 0 1 10 24c0-1.45.25-2.85.85-4.2l-7.08-5.5A23.03 23.03 0 0 0 1 24c0 3.73.9 7.25 2.77 10.3l7.08-6.1z"/>
                    <path fill="#34A853" d="M24 47c5.53 0 10.17-1.84 13.56-4.97l-7.34-5.7c-1.84 1.23-4.18 1.97-6.22 1.97-6.15 0-11.4-3.98-13.15-9.7l-7.08 6.1C7.02 41.3 14.82 47 24 47z"/>
                  </svg>
                  Sign in with Google
                </button>
              )}
            </>
          )}
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
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
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
          <div className="bg-primary-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-3">
            Authenticator Verification
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Enter the 6-digit code from your<br />
            authenticator app
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-300 rounded-lg">
            <p className="text-error-600 text-sm text-center mb-0">
              {error}
            </p>
          </div>
        )}
        
        <form onSubmit={handleTotpVerification} className="space-y-5">
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-secondary-700 mb-2 text-center">
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
              className="w-full px-4 py-4 bg-neutral-50
                       text-secondary-900 text-center text-2xl font-mono tracking-widest
                       border-2 border-neutral-300
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 placeholder:text-xl
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
          
          <div className="pt-2 space-y-2">
            <button 
              type="button" 
              onClick={() => {
                setShowTotpVerify(false);
                setVerificationKey('');
                setTotpCode('');
                setError('');
              }}
              className="w-full bg-white hover:bg-neutral-50
                       text-secondary-700 font-medium py-3 rounded-lg 
                       border border-neutral-300
                       transition-all duration-200 text-sm"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleUseEmailInstead}
              disabled={isLoading}
              className="w-full text-sm text-accent-600 dark:text-accent-400 hover:underline py-1 transition-colors"
            >
              Use email code instead
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Two-factor authentication form (email OTP)
  if (showTwoFactor) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="bg-primary-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-3">
            Verify Your Email
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            We've sent a 6-digit code to<br />
            <span className="font-semibold text-secondary-900">{email}</span>
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-300 rounded-lg">
            <p className="text-error-600 text-sm text-center mb-0">
              {error}
            </p>
          </div>
        )}
        
        <form onSubmit={handleTwoFactorVerification} className="space-y-5">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-secondary-700 mb-2 text-center">
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
              className="w-full px-4 py-4 bg-neutral-50
                       text-secondary-900 text-center text-2xl font-mono tracking-widest
                       border-2 border-neutral-300
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 placeholder:text-xl
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
              className="flex-1 bg-neutral-100 hover:bg-neutral-200
                       text-secondary-700 font-medium py-3 rounded-lg 
                       border border-neutral-300
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
              className="flex-1 bg-white hover:bg-neutral-50
                       text-secondary-700 font-medium py-3 rounded-lg 
                       border border-neutral-300
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
