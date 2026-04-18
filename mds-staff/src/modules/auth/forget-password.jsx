import { useState, useCallback, useEffect, useRef } from 'react';
import { axiosRequest } from '../../packages-core-adapter.js';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const ForgetPassword = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState(null);
  const recaptchaRef = useRef(null);

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
    const timer = setInterval(() => {
      if (window.grecaptcha && recaptchaRef.current && recaptchaWidgetId === null) {
        renderRecaptcha();
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [renderRecaptcha, recaptchaWidgetId]);

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setError('Please complete the reCAPTCHA check.');
      setLoading(false);
      return;
    }

    try {
      await axiosRequest.post('/auth/password/forget-password', { email, recaptchaToken });
      setSuccessMessage('Password reset link sent! Please check your email.');
      setEmail('');
      setTimeout(() => onBackToLogin(), 2000);
    } catch (err) {
      const errorCode = err.response?.data?.error;
      switch (errorCode) {
        case 'INVALID_INSTITUTION_EMAIL': setError('Email must follow TIP institutional format (@tip.edu.ph).'); break;
        case 'EMAIL_COOLDOWN_ACTIVE':     setError('Too many attempts. Please try again later.'); break;
        default: setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
      }
      resetRecaptcha();
    } finally { setLoading(false); }
  };

  const isDone = !!successMessage;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-secondary-900 font-heading leading-tight">Forgot password?</h2>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Enter your institutional email to receive a reset link
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-error-50 border border-error-200 rounded-lg">
          <svg className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-error-600 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Success */}
      {successMessage && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-success-50 border border-success-200 rounded-lg">
          <svg className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-success-700 leading-relaxed">{successMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSendResetLink} className="space-y-3.5">
        <div>
          <label htmlFor="fp-email" className="block text-xs font-medium text-secondary-700 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            id="fp-email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="your.email@tip.edu.ph"
            required
            disabled={loading || isDone}
            className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 text-secondary-900
              border border-neutral-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              placeholder:text-neutral-400 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* reCAPTCHA */}
        {RECAPTCHA_SITE_KEY && (
          <div className="flex justify-center">
            <div ref={recaptchaRef} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onBackToLogin}
            disabled={loading || isDone}
            className="flex-1 flex items-center justify-center gap-1.5
              text-sm font-medium text-secondary-600
              bg-white hover:bg-neutral-50 active:bg-neutral-100
              border border-neutral-300 rounded-lg
              py-2.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <button
            type="submit"
            disabled={loading || isDone}
            className="flex-1 flex items-center justify-center gap-2
              text-sm font-semibold text-white
              bg-primary-500 hover:bg-primary-600 active:bg-primary-700
              rounded-lg py-2.5 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-sm hover:shadow-tip"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending…
              </>
            ) : 'Send reset link'}
          </button>
        </div>
      </form>

      <p className="text-xs text-neutral-400 text-center mt-4">
        Check your spam folder if you don't receive the email
      </p>
    </div>
  );
};

export default ForgetPassword;