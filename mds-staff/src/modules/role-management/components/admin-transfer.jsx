import React, { useState, useEffect, useCallback } from 'react';
import { fetchStaffAccounts, initiateAdminTransfer, confirmAdminTransfer } from '../staff-service';
import { formatBranchLabel } from '../../../utils/branch-utils';

/**
 * Admin Transfer Component
 * Normal flow:    initiate (select target + password) → verify (email OTP) → success
 * Bootstrap flow: initiate (select target + password) → bootstrap (direct confirm) → success
 */
const AdminTransfer = () => {
  const [step, setStep] = useState('initiate'); // 'initiate' | 'verify' | 'bootstrap' | 'success'
  const [staffList, setStaffList] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

  // Initiate form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);
  const [initiateError, setInitiateError] = useState(null);

  // Verify form
  const [verificationToken, setVerificationToken] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Result
  const [transferResult, setTransferResult] = useState(null);

  const loadStaff = useCallback(async () => {
    setIsLoadingStaff(true);
    try {
      const records = await fetchStaffAccounts();
      // Filter to active non-admin staff only (admin cannot transfer to themselves)
      setStaffList(records.filter((s) => s.status === 'Active' && !s.permissions?.is_admin));
    } catch {
      // Silently fail — staff list is for selection convenience
    } finally {
      setIsLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleInitiate = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !password) return;
    setInitiateError(null);
    setIsInitiating(true);
    try {
      const result = await initiateAdminTransfer(selectedUserId, password);
      if (result.ok && result.bootstrapMode) {
        setPassword('');
        setStep('bootstrap');
      } else if (result.ok && result.verificationRequired) {
        setPassword('');
        setStep('verify');
      } else if (result.ok) {
        // Unexpected response shape — surface the server message
        setInitiateError(result.message || 'Unexpected response from server.');
      }
    } catch (err) {
      setInitiateError(err.message || 'Failed to initiate transfer.');
    } finally {
      setIsInitiating(false);
    }
  };

  const handleBootstrapConfirm = async () => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      const result = await confirmAdminTransfer('BOOTSTRAP_ADMIN_TRANSFER');
      if (result.ok) {
        setTransferResult(result);
        setStep('success');
      }
    } catch (err) {
      setConfirmError(err.message || 'Failed to confirm transfer.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!verificationToken.trim()) return;
    setConfirmError(null);
    setIsConfirming(true);
    try {
      const result = await confirmAdminTransfer(verificationToken.trim());
      if (result.ok) {
        setTransferResult(result);
        setStep('success');
      }
    } catch (err) {
      setConfirmError(err.message || 'Failed to confirm transfer.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setStep('initiate');
    setSelectedUserId('');
    setPassword('');
    setVerificationToken('');
    setInitiateError(null);
    setConfirmError(null);
    setTransferResult(null);
  };

  const selectedStaff = staffList.find((s) => s.id === selectedUserId);

  return (
    <div className="max-w-lg">
      {/* Warning Banner */}
      <div className="mb-4 px-3.5 py-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-error-700 dark:text-error-400">Irreversible Action</p>
            <p className="text-[11px] text-error-600 dark:text-error-300 mt-0.5">
              Transferring admin privileges cannot be undone. You will lose admin access permanently.
              A verification code will be sent to your email unless the system is in bootstrap mode.
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Initiate ── */}
      {step === 'initiate' && (
        <form onSubmit={handleInitiate} className="space-y-4">
          <div className="space-y-3">
            {/* Target Staff Selection */}
            <div>
              <label className="text-xs font-medium text-secondary-700 dark:text-neutral-300 block mb-1">
                Transfer admin privileges to
              </label>
              {isLoadingStaff ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-secondary-400">Loading staff...</span>
                </div>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="">Select a staff member...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              )}
              {selectedStaff && (
                <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-md">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
                    {selectedStaff.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-secondary-800 dark:text-white">{selectedStaff.name}</p>
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500">{selectedStaff.email} · {formatBranchLabel(selectedStaff.branch)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-secondary-700 dark:text-neutral-300 block mb-1">
                Your current password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password to verify identity"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          {initiateError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <p className="text-xs text-error-600 dark:text-error-400 mb-0">{initiateError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isInitiating || !selectedUserId || !password}
            className="w-full px-4 py-2 text-sm font-medium bg-error-500 text-white rounded-lg hover:bg-error-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isInitiating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isInitiating ? 'Verifying...' : 'Initiate Admin Transfer'}
          </button>
        </form>
      )}

      {/* ── Step 2 (Bootstrap): Direct confirm ── */}
      {step === 'bootstrap' && (
        <div className="space-y-4">
          {/* Bootstrap mode banner */}
          <div className="px-3.5 py-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-warning-700 dark:text-warning-400">Bootstrap Mode Active</p>
                <p className="text-[11px] text-warning-600 dark:text-warning-300 mt-0.5">
                  The system is running in bootstrap mode. 2FA verification and email confirmation are bypassed.
                  The transfer will complete immediately upon confirmation.
                </p>
              </div>
            </div>
          </div>

          {/* Target staff preview */}
          {selectedStaff && (
            <div className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <p className="text-[10px] font-medium text-secondary-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">Transferring to</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                  {selectedStaff.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-800 dark:text-white">{selectedStaff.name}</p>
                  <p className="text-[10px] text-secondary-400 dark:text-neutral-500">{selectedStaff.email} · {formatBranchLabel(selectedStaff.branch)}</p>
                </div>
              </div>
            </div>
          )}

          {confirmError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <p className="text-xs text-error-600 dark:text-error-400 mb-0">{confirmError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBootstrapConfirm}
              disabled={isConfirming}
              className="flex-1 px-4 py-2 text-sm font-medium bg-warning-500 text-white rounded-lg hover:bg-warning-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isConfirming && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isConfirming ? 'Confirming...' : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Verify (normal flow) ── */}
      {step === 'verify' && (
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="px-3.5 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-400">Check your email</p>
                <p className="text-[11px] text-primary-600 dark:text-primary-300 mt-0.5">
                  A verification code has been sent to your admin email. Enter it below to complete the transfer.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-700 dark:text-neutral-300 block mb-1">
              Verification code
            </label>
            <input
              type="text"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              required
              placeholder="Enter the 8-character code from your email"
              autoFocus
              className="w-full px-3 py-2 text-sm font-mono tracking-wider bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-center"
            />
          </div>

          {confirmError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <p className="text-xs text-error-600 dark:text-error-400 mb-0">{confirmError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConfirming || !verificationToken.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-error-500 text-white rounded-lg hover:bg-error-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isConfirming && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isConfirming ? 'Confirming...' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 4: Success ── */}
      {step === 'success' && (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">Transfer Complete</h4>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-4">
            {transferResult?.message || 'Admin privileges have been transferred successfully.'}
          </p>
          <p className="text-[11px] text-secondary-400 dark:text-neutral-500">
            You no longer have admin access. Please refresh the page.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminTransfer;
