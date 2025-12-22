import { useState } from 'react';
import styles from './css/VerifyOtpStep.module.css';

const VerifyOtpStep = ({ email, otp, onOtpChange, onVerify, onResend, loading, error, successMessage }) => {
  return (
    <div className={styles.stepContainer}>
      <div className={styles.iconContainer}>
        <span className={styles.icon}>🔐</span>
      </div>
      
      <h2 className={styles.title}>Enter Verification Code</h2>
      <p className={styles.subtitle}>
        Enter the 6-digit code sent to:
      </p>
      <p className={styles.email}>{email}</p>

      <form onSubmit={onVerify} className={styles.form}>
        <div className={styles.otpContainer}>
          <input
            type="text"
            value={otp}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              onOtpChange(value);
            }}
            placeholder="000000"
            maxLength={6}
            required
            disabled={loading}
            className={styles.otpInput}
            autoComplete="one-time-code"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}

        <button type="submit" className={styles.submitButton} disabled={loading || otp.length !== 6}>
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        <button 
          type="button"
          onClick={onResend} 
          className={styles.resendButton}
          disabled={loading}
        >
          Resend Code
        </button>
      </form>
    </div>
  );
};

export default VerifyOtpStep;
