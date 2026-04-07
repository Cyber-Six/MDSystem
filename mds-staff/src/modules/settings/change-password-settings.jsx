import { useState, useEffect, useRef } from 'react';
import { axiosRequest } from '../../packages-core-adapter.js';

// ── Modal Backdrop ──
const ModalBackdrop = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="absolute inset-0" onClick={onClose} />
    <div className="relative w-full max-w-md mx-4">
      {children}
    </div>
  </div>
);

// ── Eye Icon ──
const EyeIcon = ({ open }) => open ? (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
) : (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

// ── Password Field ──
const PasswordField = ({ id, label, value, onChange, placeholder, disabled, autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full px-3 py-2.5 pr-10 text-sm bg-neutral-50 dark:bg-neutral-900 text-secondary-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
};

// ── Change Password Modal ──
const ChangePasswordModal = ({ totpEnabled, onSuccess, onCancel }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const totpRef = useRef(null);

  // Validate inline
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;

  const isSubmittable =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword &&
    (!totpEnabled || totpToken.length === 6);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSubmittable) return;

    setIsLoading(true);
    try {
      const payload = { currentPassword, newPassword };
      if (totpEnabled) payload.totpToken = totpToken;

      const res = await axiosRequest.post('/settings/password/change', payload);
      if (res.data.ok) {
        onSuccess(res.data.message || 'Password changed successfully.');
      }
    } catch (err) {
      const code = err.response?.data?.error;
      const msg = err.response?.data?.message || 'Failed to change password.';

      setError(msg);

      // Focus TOTP field on invalid code
      if (code === 'INVALID_TOTP_CODE' && totpRef.current) {
        setTotpToken('');
        totpRef.current.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalBackdrop onClose={isLoading ? undefined : onCancel}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Change Password</h3>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">
                {totpEnabled
                  ? 'Your authenticator code is required to confirm this change'
                  : 'Enter your current password to confirm this change'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <PasswordField
            id="cp-current"
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            disabled={isLoading}
            autoFocus
          />

          <PasswordField
            id="cp-new"
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={isLoading}
          />
          {tooShort && (
            <p className="text-xs text-error-600 dark:text-error-400 -mt-2">Password must be at least 8 characters.</p>
          )}
          {sameAsCurrent && !tooShort && (
            <p className="text-xs text-error-600 dark:text-error-400 -mt-2">New password must differ from your current password.</p>
          )}

          <PasswordField
            id="cp-confirm"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            disabled={isLoading}
          />
          {passwordMismatch && (
            <p className="text-xs text-error-600 dark:text-error-400 -mt-2">Passwords do not match.</p>
          )}

          {/* TOTP field — only when enabled */}
          {totpEnabled && (
            <div>
              <label htmlFor="cp-totp" className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-1.5">
                Authenticator code
              </label>
              <div className="p-3 mb-2 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-700">
                <p className="text-xs text-warning-700 dark:text-warning-300">
                  Enter the 6-digit code from your authenticator app to authorize this change.
                </p>
              </div>
              <input
                id="cp-totp"
                ref={totpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                disabled={isLoading}
                className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.5em] bg-neutral-50 dark:bg-neutral-900 text-secondary-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-700">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-secondary-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isSubmittable || isLoading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
};

// ── Success Modal ──
const SuccessModal = ({ message, onClose }) => (
  <ModalBackdrop onClose={onClose}>
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-secondary-800 dark:text-white mb-1">{message}</h3>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
      >
        Done
      </button>
    </div>
  </ModalBackdrop>
);

// ── Main Component ──
const ChangePasswordSettings = () => {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    axiosRequest
      .get('/settings/totp/status')
      .then((res) => {
        if (res.data.ok) setTotpEnabled(res.data.totpEnabled || false);
      })
      .catch(() => {
        // Status unavailable — default to no TOTP requirement
      })
      .finally(() => setStatusLoaded(true));
  }, []);

  const handleSuccess = (message) => {
    setShowModal(false);
    setSuccessMessage(message);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary-700 dark:text-neutral-200">Change Password</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">
            {totpEnabled
              ? 'Your authenticator code will be required to confirm the change'
              : 'Update your account password'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!statusLoaded}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          Change
        </button>
      </div>

      {showModal && (
        <ChangePasswordModal
          totpEnabled={totpEnabled}
          onSuccess={handleSuccess}
          onCancel={() => setShowModal(false)}
        />
      )}

      {successMessage && (
        <SuccessModal
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </>
  );
};

export default ChangePasswordSettings;
