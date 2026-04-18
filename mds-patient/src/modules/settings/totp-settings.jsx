import { useState, useEffect, useRef } from 'react';
import { axiosRequest } from '../../packages-core-adapter.js';

/**
 * TOTP Two-Factor Authentication Settings Component
 *
 * Allows patients to:
 * - View their current 2FA status
 * - Set up TOTP 2FA (scan QR code or enter manual key)
 * - Verify and enable TOTP
 * - Disable TOTP (requires current authenticator code)
 */

// ── Modal Backdrop ──
const ModalBackdrop = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div
      className="absolute inset-0"
      onClick={onClose}
    />
    <div className="relative w-full max-w-md mx-4">
      {children}
    </div>
  </div>
);

// ── Setup Modal ──
const SetupModal = ({ qrCode, secret, onVerify, onCancel, error, isLoading }) => {
  const [token, setToken] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onVerify(token);
  };

  // Format the secret into groups of 4 for easy reading
  const formattedSecret = secret ? secret.replace(/(.{4})/g, '$1 ').trim() : '';

  return (
    <ModalBackdrop onClose={onCancel}>
      <div className="bg-white dark:bg-[#171311] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#2a2420] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-[#2a2420]/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Set Up Authenticator 2FA</h3>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">Scan with Google Authenticator, Authy, or similar app</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white rounded-lg shadow-inner border border-neutral-100">
              <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
            </div>
          </div>

          {/* Manual Key Toggle */}
          <div className="text-center mb-4">
            <button
              type="button"
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              {showManualKey ? 'Hide manual key' : "Can't scan? Enter key manually"}
            </button>
          </div>

          {/* Manual Key */}
          {showManualKey && (
            <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-[#2a2420]">
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-1">Manual Entry Key</p>
              <p className="font-mono text-sm text-secondary-800 dark:text-neutral-200 tracking-wider select-all break-all">
                {formattedSecret}
              </p>
            </div>
          )}

          {/* Verification */}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2">
              Enter the 6-digit code from your app
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={isLoading}
              className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.5em] bg-neutral-50 dark:bg-neutral-900 text-secondary-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-[#3a322c] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            />

            {error && (
              <p className="mt-2 text-sm text-error-600 dark:text-error-400 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-secondary-600 dark:text-neutral-400 border border-neutral-300 dark:border-[#3a322c] hover:bg-neutral-50 dark:hover:bg-[#221d1a] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || token.length !== 6}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </>
                ) : 'Verify & Enable'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// ── Disable Modal ──
const DisableModal = ({ onConfirm, onCancel, error, isLoading }) => {
  const [token, setToken] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(token);
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <div className="bg-white dark:bg-[#171311] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#2a2420] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-[#2a2420]/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-error-100 dark:bg-error-900/30">
              <svg className="w-5 h-5 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Disable Authenticator 2FA</h3>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">This will reduce your account security</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="mb-4 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-700">
            <p className="text-xs text-warning-700 dark:text-warning-300 mb-0">
              Enter the current code from your authenticator app to confirm disabling 2FA.
              You will need to set it up again if you want to re-enable it.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-2">
              Authenticator code
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={isLoading}
              className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.5em] bg-neutral-50 dark:bg-neutral-900 text-secondary-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-[#3a322c] rounded-lg focus:outline-none focus:ring-2 focus:ring-error-500 focus:border-transparent disabled:opacity-50"
            />

            {error && (
              <p className="mt-2 text-sm text-error-600 dark:text-error-400 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-secondary-600 dark:text-neutral-400 border border-neutral-300 dark:border-[#3a322c] hover:bg-neutral-50 dark:hover:bg-[#221d1a] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || token.length !== 6}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-error-500 text-white hover:bg-error-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Disabling...
                  </>
                ) : 'Disable 2FA'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// ── Success Modal ──
const SuccessModal = ({ message, onClose }) => (
  <ModalBackdrop onClose={onClose}>
    <div className="bg-white dark:bg-[#171311] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#2a2420] p-6 text-center">
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
const TotpSettings = () => {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await axiosRequest.get('/settings/totp/status');
      if (res.data.ok) {
        setTotpEnabled(res.data.totpEnabled);
      }
    } catch {
      // Status fetch failed — default to disabled
    } finally {
      setLoading(false);
    }
  };

  // ── Setup flow ──
  const handleSetup = async () => {
    setError('');
    setActionLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/setup');
      if (res.data.ok) {
        setSetupData({
          qrCode: res.data.qrCode,
          secret: res.data.secret,
        });
        setShowSetup(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start 2FA setup.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Verify ──
  const handleVerify = async (token) => {
    setError('');
    setActionLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/verify', { token });
      if (res.data.ok) {
        setShowSetup(false);
        setSetupData(null);
        setTotpEnabled(true);
        setShowSuccess('Authenticator 2FA has been enabled successfully.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid verification code.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Disable ──
  const handleDisable = async (token) => {
    setError('');
    setActionLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/disable', { token });
      if (res.data.ok) {
        setShowDisable(false);
        setTotpEnabled(false);
        setShowSuccess('Authenticator 2FA has been disabled.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to disable 2FA.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setShowSetup(false);
    setSetupData(null);
    setError('');
  };

  const handleCancelDisable = () => {
    setShowDisable(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary-700 dark:text-neutral-200">Authenticator 2FA</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">Loading status...</p>
        </div>
        <div className="w-5 h-5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary-700 dark:text-neutral-200">Authenticator 2FA</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5">
            {totpEnabled
              ? 'Your account is protected with an authenticator app'
              : 'Add an extra layer of security using an authenticator app'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            totpEnabled
              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
              : 'bg-neutral-100 text-neutral-600 dark:bg-[#2d2723] dark:text-neutral-300'
          }`}>
            {totpEnabled ? 'Enabled' : 'Disabled'}
          </span>

          {/* Action button */}
          {totpEnabled ? (
            <button
              onClick={() => { setError(''); setShowDisable(true); }}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-error-600 dark:text-error-400 border border-error-300 dark:border-error-700 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={handleSetup}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading ? (
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : null}
              Set Up
            </button>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      {showSetup && setupData && (
        <SetupModal
          qrCode={setupData.qrCode}
          secret={setupData.secret}
          onVerify={handleVerify}
          onCancel={handleCancelSetup}
          error={error}
          isLoading={actionLoading}
        />
      )}

      {/* Disable Modal */}
      {showDisable && (
        <DisableModal
          onConfirm={handleDisable}
          onCancel={handleCancelDisable}
          error={error}
          isLoading={actionLoading}
        />
      )}

      {/* Success Modal */}
      {showSuccess && (
        <SuccessModal
          message={showSuccess}
          onClose={() => setShowSuccess(null)}
        />
      )}
    </>
  );
};

export default TotpSettings;
