import styles from './css/SendOtpStep.module.css';

const SendOtpStep = ({ email, onSendOtp, loading, error, successMessage }) => {
  return (
    <div className={styles.stepContainer}>
      <div className={styles.iconContainer}>
        <span className={styles.icon}>📧</span>
      </div>
      
      <h2 className={styles.title}>Verify Your Email</h2>
      <p className={styles.subtitle}>
        We'll send a 6-digit verification code to:
      </p>
      <p className={styles.email}>{email}</p>

      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}
      
      <button 
        onClick={onSendOtp} 
        className={styles.submitButton}
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Send Verification Code'}
      </button>

      <p className={styles.hint}>
        Make sure to check your spam folder if you don't receive the email.
      </p>
    </div>
  );
};

export default SendOtpStep;
