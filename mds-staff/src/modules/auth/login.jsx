import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosRequest, TokenStorage } from '../../packages-core-adapter.js';
import ForgetPassword from './forget-password.jsx';
import DataConsent from './data-consent/data-consent.jsx';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const RECAPTCHA_ENABLED = !!RECAPTCHA_SITE_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED !== 'false' && !!GOOGLE_CLIENT_ID;

// ── Shared spinner ────────────────────────────────────────────────────────────
const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ── Error banner ──────────────────────────────────────────────────────────────
const ErrorBanner = ({ message }) =>
  message ? (
    <div className="flex items-start gap-2 px-3 py-2.5 bg-error-50 border border-error-200 rounded-lg">
      <svg className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-xs text-error-600 leading-relaxed">{message}</p>
    </div>
  ) : null;

// ── 6-box OTP input ───────────────────────────────────────────────────────────
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
        // Current field has value, delete it and move to previous
        const next = [...digits];
        next[i] = '';
        onChange(next.join('').replace(/ /g, ''));
        if (i > 0) inputsRef.current[i - 1]?.focus();
      } else if (i > 0) {
        // Current field is empty, delete previous and move to previous
        const next = [...digits];
        next[i - 1] = '';
        onChange(next.join('').replace(/ /g, ''));
        inputsRef.current[i - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && i < 5) {
      inputsRef.current[i + 1]?.focus();
    }
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
          className={`w-12 h-14 text-center text-lg font-semibold font-mono
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

// ── Step header (icon + title + subtitle) ─────────────────────────────────────
const StepHeader = ({ icon, title, subtitle, className = '' }) => (
  <div className={`flex flex-col items-center text-center ${className}`} style={{ gap: '10px', marginBottom: '18px' }}>
    <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <h2 className="text-2xl font-bold text-secondary-900 font-heading" style={{ lineHeight: 1.3, margin: 0 }}>{title}</h2>
      {subtitle && <p className="text-sm text-neutral-500" style={{ lineHeight: 1.4, margin: '4px 0 0 0' }}>{subtitle}</p>}
    </div>
  </div>
);

// ── Primary button ─────────────────────────────────────────────────────────────
const PrimaryBtn = ({ loading, loadingLabel, label, disabled, type = 'submit', onClick, className = '' }) => (
  <button
    type={type}
    disabled={disabled || loading}
    onClick={onClick}
    className="w-full flex items-center justify-center gap-2
      bg-primary-500 hover:bg-primary-600 active:bg-primary-700
      text-white font-semibold text-sm py-3 rounded-lg
      transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
      shadow-sm hover:shadow-tip
      ${className}"
  >
    {loading ? <><Spinner /> {loadingLabel}</>  : label}
  </button>
);

// ── Ghost button ───────────────────────────────────────────────────────────────
const GhostBtn = ({ label, onClick, disabled, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-center gap-1.5
      bg-white hover:bg-neutral-50 active:bg-neutral-100
      text-secondary-600 font-medium text-sm py-2.5 rounded-lg
      border border-neutral-300
      transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
const Login = ({ onVerificationViewChange }) => {
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
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState(null);
  const recaptchaRef = useRef(null);
  const googleBtnRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    onVerificationViewChange?.(showTwoFactor || showTotpVerify);
  }, [showTwoFactor, showTotpVerify, onVerificationViewChange]);

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
    if (!captchaRequired || !RECAPTCHA_SITE_KEY) return;
    const timer = setInterval(() => {
      if (window.grecaptcha && recaptchaRef.current && recaptchaWidgetId === null) {
        renderRecaptcha();
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [captchaRequired, renderRecaptcha, recaptchaWidgetId]);

  // ── Google Sign-In setup ──────────────────────────────────────────────
  const handleGoogleCredential = useCallback(async (response) => {
    if (!response.credential) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await axiosRequest.post('/auth/oauth/google', { credential: response.credential });
      if (res.data.ok) {
        const loginKey = res.data.LoginKey;
        setVerificationKey(loginKey);
        const responseEmail = String(res.data.email || '').trim();
        let tokenEmail = '';
        try {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          tokenEmail = String(payload.email || '').trim();
        } catch { /* non-critical */ }

        const loginEmail = responseEmail || tokenEmail;
        if (loginEmail) {
          setEmail(loginEmail);
        }

        if (res.data.requiresTotp) {
          setShowTotpVerify(true);
        } else {
          const sent = await handleSend2FA(loginEmail);
          if (sent) setShowTwoFactor(true);
        }
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Google sign-in failed.';
      switch (errorCode) {
        case 'INVALID_GOOGLE_TOKEN': setError('Google authentication failed. Ensure you are using a @tip.edu.ph account.'); break;
        case 'ACCOUNT_NOT_FOUND':   setError('No account found for this email. Please register first.'); break;
        case 'ACCOUNT_LOCKED':      setError(errorMsg); break;
        default:                    setError(errorMsg);
      }
    } finally { setIsLoading(false); }
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
          type: 'standard', theme: 'outline', size: 'large',
          text: 'signin_with', shape: 'rectangular',
          logo_alignment: 'left',
          width: googleBtnRef.current.offsetWidth || 320,
        });
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [handleGoogleCredential]);

  const handleSend2FA = async (emailOverride) => {
    const targetEmail = String(emailOverride || email || '').trim();

    if (!targetEmail) {
      setError('Unable to send verification code. Please sign in again.');
      return false;
    }

    try {
      await axiosRequest.post('/auth/email/2fa', { email: targetEmail });
      if (targetEmail !== email) {
        setEmail(targetEmail);
      }
      return true;
    } catch (err) {
      const errorCode = err.response?.data?.error;
      switch (errorCode) {
        case 'EMAIL_COOLDOWN_ACTIVE':
          setError('Please wait before requesting another code.');
          break;
        case 'EMAIL_ATTEMPT_LIMIT_REACHED':
          setError('Too many attempts. Please try again later.');
          break;
        case 'MISSING_FIELDS':
        case 'INVALID_INSTITUTION_EMAIL':
          setError('Unable to send verification code. Please sign in again.');
          break;
        default:
          setError(err.response?.data?.message || 'Failed to send verification code.');
      }
      return false;
    }
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (captchaRequired && RECAPTCHA_ENABLED && !recaptchaToken) { setError('Please complete the reCAPTCHA check.'); return; }
    setIsLoading(true);
    try {
      const payload = { email, password };
      if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
      const response = await axiosRequest.post('/auth/login', payload);
      if (response.data.ok) {
        setVerificationKey(response.data.LoginKey);
        if (response.data.requiresTotp) {
          setShowTotpVerify(true);
        } else {
          const sent = await handleSend2FA(email);
          if (sent) setShowTwoFactor(true);
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      const errorCode = err.response?.data?.error;
      if (err.response?.data?.requiresCaptcha) setCaptchaRequired(true);
      resetRecaptcha();
      switch (errorCode) {
        case 'RECAPTCHA_REQUIRED':       setError('Too many failed attempts. Please complete the reCAPTCHA check.'); break;
        case 'INVALID_RECAPTCHA':        setError('reCAPTCHA verification failed. Please try again.'); break;
        case 'MISSING_FIELDS':           setError('Please fill in all required fields.'); break;
        case 'INVALID_EMAIL_FORMAT':     setError('Invalid email format.'); break;
        case 'INVALID_INSTITUTION_EMAIL':setError('Email must follow TIP institutional format.'); break;
        case 'ACCOUNT_LOCKED':           setError(errorMsg); break;
        case 'STAFF_ACCOUNT_SUSPENDED':  setError(errorMsg); break;
        case 'INVALID_CREDENTIALS':      setError('Email or password is incorrect.'); break;
        default:                         setError(errorMsg);
      }
    } finally { setIsLoading(false); }
  };

  const handleTwoFactorVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const verificationEmail = String(email || '').trim();
    if (!verificationEmail) {
      setError('Email is missing. Please sign in again.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/auth/email/2fa/verify', { email: verificationEmail, otp: twoFactorCode, verificationKey });
      if (response.data.ok) {
        const nextVerificationKey = response.data.verificationKey;
        setVerificationKey(nextVerificationKey);
        setShowTwoFactor(false);
        await completeLoginWithKey(nextVerificationKey, { promptConsentIfRequired: true });
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const attempts = err.response?.data?.attempts;
      const attemptLimit = err.response?.data?.attemptLimit;
      const retryAfter = err.response?.data?.retryAfterSeconds;
      switch (errorCode) {
        case 'INVALID_OTP':    setError(`Invalid OTP code. Attempts: ${attempts}/${attemptLimit}`); break;
        case 'OTP_LOCKED_OUT': setError(`Too many invalid attempts. Please try again after ${retryAfter} seconds.`); break;
        default:               setError(err.response?.data?.message || '2FA verification failed.');
      }
    } finally { setIsLoading(false); }
  };

  const handleResend2FA = async () => {
    setError('');
    setIsLoading(true);
    try {
      await handleSend2FA(email);
    } finally { setIsLoading(false); }
  };

  const handleTotpVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await axiosRequest.post('/settings/totp/validate', { token: totpCode, verificationKey, email });
      if (response.data.ok) {
        const nextVerificationKey = verificationKey;
        setShowTotpVerify(false);
        setTotpCode('');
        await completeLoginWithKey(nextVerificationKey, { promptConsentIfRequired: true });
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      switch (errorCode) {
        case 'INVALID_TOTP_CODE': setError('Invalid authenticator code. Please try again.'); break;
        case 'INVALID_SESSION':
          setError('Login session expired. Please start over.');
          setShowTotpVerify(false);
          setVerificationKey('');
          break;
        default: setError(err.response?.data?.message || 'TOTP verification failed.');
      }
    } finally { setIsLoading(false); }
  };

  const handleUseEmailInstead = async () => {
    setError('');
    const sent = await handleSend2FA(email);
    if (!sent) return;
    setTotpCode('');
    setShowTotpVerify(false);
    setShowTwoFactor(true);
  };

  const completeLoginWithKey = async (key, { promptConsentIfRequired = false } = {}) => {
    setError('');
    setIsLoading(true);
    let shouldOpenConsent = false;

    try {
      const response = await axiosRequest.post('/auth/login/complete', { LoginKey: key });
      if (response.data.ok) {
        if (response.data.accessToken && response.data.refreshToken) {
          await TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          const userId = response.data.refreshToken.split(':')[0];
          window.dispatchEvent(new CustomEvent('mds:auth-changed', { detail: { userId } }));
        }
        navigate('/');
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMsg = err.response?.data?.message || 'Login completion failed.';
      switch (errorCode) {
        case 'INVALID_LOGIN_SESSION':
          setError('Login session is invalid or expired. Please try again.');
          setShowConsent(false); setShowTwoFactor(false); setShowTotpVerify(false); setVerificationKey('');
          break;
        case '2FA_NOT_VERIFIED':
          setError('2FA has not been verified.');
          setShowConsent(false); setShowTwoFactor(true);
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
        case 'STAFF_ACCOUNT_PENDING':
        case 'STAFF_ACCOUNT_INACTIVE':
          setError('Your staff account is not yet activated. Contact your administrator to grant you access.');
          setShowConsent(false);
          break;
        case 'STAFF_ACCOUNT_SUSPENDED':
          setError('Your staff account has been suspended. Contact your administrator.');
          setShowConsent(false);
          break;
        default: setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setShowConsent(shouldOpenConsent);
    }
  };

  const handleConsentAccept = () => completeLoginWithKey(verificationKey);
  const handleConsentCancel = () => { setShowConsent(false); setVerificationKey(''); setError(''); };

  // ── TOTP screen ───────────────────────────────────────────────────────────
  if (showTotpVerify) {
    return (
      <div className="w-full max-w-md mx-auto px-2 py-8">
        <StepHeader
          icon={
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          title="Authenticator Verification"
          subtitle={<>Enter the 6-digit code from your<br />authenticator app</>}
        />

        <form onSubmit={handleTotpVerification} className="w-full" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ErrorBanner message={error} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="block text-xs font-medium text-secondary-600" style={{ margin: 0, textAlign: 'left' }}>
              Authenticator code
            </label>
            <OtpInput value={totpCode} onChange={setTotpCode} disabled={isLoading} />
          </div>

          <PrimaryBtn loading={isLoading} loadingLabel="Verifying…" label="Verify code"
            className="py-2.5"
            disabled={totpCode.length !== 6} />

          <div className="flex" style={{ gap: '8px', paddingTop: '8px', flexDirection: 'column' }}>
            <GhostBtn label="Go back" onClick={() => { setShowTotpVerify(false); setVerificationKey(''); setTotpCode(''); setError(''); }} disabled={isLoading} />
            <button type="button" onClick={handleUseEmailInstead} disabled={isLoading}
              className="w-full text-xs text-accent-600 hover:text-accent-700 hover:underline py-1 transition-colors disabled:opacity-50">
              Use email code instead
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Email 2FA screen ──────────────────────────────────────────────────────
  if (showTwoFactor) {
    return (
      <div className="w-full max-w-md mx-auto px-2 py-8">
        <StepHeader
          icon={
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title="Verify your email"
          subtitle={<>We've sent a 6-digit code to<br /><span className="font-semibold text-secondary-900">{email}</span></>}
        />

        <form onSubmit={handleTwoFactorVerification} className="w-full" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ErrorBanner message={error} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="block text-xs font-medium text-secondary-600" style={{ margin: 0, textAlign: 'left' }}>
              Verification code
            </label>
            <OtpInput value={twoFactorCode} onChange={setTwoFactorCode} disabled={isLoading} />
          </div>

          <PrimaryBtn loading={isLoading} loadingLabel="Verifying…" label="Verify code" className="py-2.5" />

          <div className="flex" style={{ gap: '8px', paddingTop: '6px' }}>
            <button type="button" onClick={handleResend2FA} disabled={isLoading}
              className="flex-1 bg-neutral-50 hover:bg-neutral-100 text-secondary-600 font-medium text-sm
                py-2.5 rounded-lg border border-neutral-300 transition-all duration-200 disabled:opacity-50">
              Resend code
            </button>
            <button type="button" disabled={isLoading}
              onClick={() => { setShowTwoFactor(false); setVerificationKey(''); setTwoFactorCode(''); }}
              className="flex-1 bg-white hover:bg-neutral-50 text-secondary-600 font-medium text-sm
                py-2.5 rounded-lg border border-neutral-300 transition-all duration-200 disabled:opacity-50">
              Go back
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Initial login form ────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full max-w-md mx-auto">
        <ErrorBanner message={error} />

        <form onSubmit={handleInitialLogin} className="mt-2.5 space-y-3">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-secondary-700 mb-1">
              Email address
            </label>
            <input
              id="email" type="email"
              placeholder="your.email@tip.edu.ph"
              value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required disabled={isLoading}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 text-secondary-900
                border border-neutral-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                placeholder:text-neutral-400 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Password */}
          <div>
            <div className="mb-1">
              <label htmlFor="password" className="block text-xs font-medium text-secondary-700">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required disabled={isLoading}
                className="w-full px-3.5 py-2.5 pr-10 text-sm bg-neutral-50 text-secondary-900
                  border border-neutral-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  placeholder:text-neutral-400 transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-secondary-600 transition-colors disabled:opacity-50">
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
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-accent-600 hover:text-accent-700 hover:underline transition-colors font-medium"
              >
                Forgot password?
              </button>
            </div>

          </div>

          {/* reCAPTCHA — only rendered when enabled and triggered by the backend */}
          {captchaRequired && RECAPTCHA_ENABLED && (
            <div ref={recaptchaRef} id="staff-recaptcha-container" className="flex justify-center" />
          )}

          <div className="mt-10">
            <PrimaryBtn
              loading={isLoading} loadingLabel="Signing in…" label="Sign in"
              disabled={captchaRequired && RECAPTCHA_ENABLED && !recaptchaToken}
            />
          </div>
        </form>

        {/* Google OAuth divider + button */}
        {GOOGLE_OAUTH_ENABLED && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-neutral-400">or continue with</span>
              </div>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div ref={googleBtnRef} className="flex justify-center w-full [&>div]:!w-full" />
            ) : (
              <button
                type="button" disabled={isLoading}
                onClick={() => setError('Google OAuth is not available.')}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5
                  border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50
                  shadow-sm hover:shadow transition-all duration-150
                  text-sm font-medium text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
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

      {/* ── Forgot Password Modal ─────────────────────────────────────────── */}
      {showForgotPassword && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4 py-8">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForgotPassword(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-slide-in">
            {/* Modal close */}
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="px-6 py-6">
              <ForgetPassword onBackToLogin={() => setShowForgotPassword(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Data Consent Modal ────────────────────────────────────────────── */}
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

export default Login;