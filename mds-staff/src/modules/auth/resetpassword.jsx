import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosRequest } from '../../packages-core-adapter';

// ── Password strength helper ─────────────────────────────────────────────────
const getStrength = (pwd) => {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd))  score++;
  if (score <= 1) return { label: 'Weak',   color: 'bg-error-400',   width: 'w-1/4' };
  if (score === 2) return { label: 'Fair',   color: 'bg-warning-400', width: 'w-2/4' };
  if (score === 3) return { label: 'Good',   color: 'bg-primary-400', width: 'w-3/4' };
  return              { label: 'Strong', color: 'bg-success-500',  width: 'w-full' };
};

const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ── Password input with toggle ────────────────────────────────────────────────
const PasswordField = ({ id, label, placeholder, value, onChange, disabled }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-secondary-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          className="w-full px-3.5 py-2.5 pr-10 text-sm bg-neutral-50 text-secondary-900
            border border-neutral-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            placeholder:text-neutral-400 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-secondary-600 transition-colors disabled:opacity-50"
        >
          {show ? (
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
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const ResetPassword = () => {
  const { verificationKey } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getStrength(password);
  const mismatch = confirm && password !== confirm;

  useEffect(() => {
    const validateLink = async () => {
      try {
        await axiosRequest.get(`/auth/password/reset-password/check/${verificationKey}`);
        setAllowed(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Reset link is invalid or expired.');
      } finally { setChecking(false); }
    };
    validateLink();
  }, [verificationKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirm) { setError('All fields are required.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await axiosRequest.post(`/auth/password/reset-password/${verificationKey}`, { newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/auth/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <Spinner className="h-5 w-5" />
          Validating reset link…
        </div>
      </div>
    );
  }

  // ── Invalid link ──────────────────────────────────────────────────────────
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-error-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-secondary-900 font-heading mb-2">Invalid reset link</h2>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/auth/login')}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold
              text-sm py-3 rounded-lg transition-colors shadow-sm hover:shadow-tip"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-7">
          <img src="/MDSystem.png" alt="MDSystem" className="h-12 w-12 rounded-xl" />
          <div>
            <h2 className="text-xl font-bold text-secondary-900 font-heading leading-tight">Reset password</h2>
            <p className="text-xs text-neutral-500 mt-1">Enter and confirm your new password below</p>
          </div>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-5 flex items-start gap-2 px-3 py-2.5 bg-success-50 border border-success-200 rounded-lg">
            <svg className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-success-700 leading-relaxed">Password reset successful! Redirecting to login…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-2 px-3 py-2.5 bg-error-50 border border-error-200 rounded-lg">
            <svg className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-error-600 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <PasswordField
              id="new-password"
              label="New password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              disabled={loading || success}
            />
            {/* Strength meter */}
            {password && strength && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">Password strength</span>
                  <span className={`text-xs font-medium ${
                    strength.label === 'Weak'   ? 'text-error-500' :
                    strength.label === 'Fair'   ? 'text-warning-500' :
                    strength.label === 'Good'   ? 'text-primary-600' :
                    'text-success-600'
                  }`}>{strength.label}</span>
                </div>
                <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              placeholder="Re-enter new password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              disabled={loading || success}
            />
            {mismatch && (
              <p className="mt-1.5 text-xs text-error-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Passwords do not match
              </p>
            )}
            {confirm && !mismatch && (
              <p className="mt-1.5 text-xs text-success-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Passwords match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || success || mismatch}
            className="w-full flex items-center justify-center gap-2
              bg-primary-500 hover:bg-primary-600 active:bg-primary-700
              text-white font-semibold text-sm py-3 rounded-lg
              transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              shadow-sm hover:shadow-tip mt-2"
          >
            {loading ? (
              <><Spinner /> Resetting…</>
            ) : 'Reset password'}
          </button>
        </form>

        <div className="text-center mt-5">
          <button
            onClick={() => navigate('/auth/login')}
            className="flex items-center justify-center gap-1.5 mx-auto
              text-xs text-accent-600 hover:text-accent-700 hover:underline
              font-medium transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;