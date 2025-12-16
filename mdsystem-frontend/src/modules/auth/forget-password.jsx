import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBanner } from '../../context/BannerContext';
import axiosRequest from '../../services/axiosRequestHandler';
import styles from './forget-password.module.css';

const ForgetPassword = ({ onBackToLogin }) => {
  const navigate = useNavigate();
  const { showBanner } = useBanner();

  // Step management
  const [currentStep, setCurrentStep] = useState(1); // 1: Request OTP, 2: Reset Password

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE'; // Replace with actual reCAPTCHA implementation

      const response = await axiosRequest.post('/patient/user/forget-password', {
        email: formData.email,
        recaptchaToken,
      });

      setSuccessMessage('OTP sent to your email successfully!');
      showBanner('OTP sent to your email. Please check your inbox.', 'success');
      setCurrentStep(2);
    } catch (err) {
      console.error('Request OTP error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
      showBanner(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axiosRequest.post('/patient/user/forget-password', {
        email: formData.email,
        newPassword: formData.newPassword,
        otp: formData.otp,
      });

      setSuccessMessage('Password reset successfully!');
      showBanner('Password reset successfully! You can now log in with your new password.', 'success');

      // Redirect to login after a short delay
      setTimeout(() => {
        if (onBackToLogin) {
          onBackToLogin();
        } else {
          navigate('/auth');
        }
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
      showBanner(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const goBackToStep1 = () => {
    setCurrentStep(1);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {currentStep === 1 ? 'Forgot Password' : 'Reset Password'}
          </h2>
          <p className={styles.subtitle}>
            {currentStep === 1
              ? 'Enter your email address to receive a password reset code'
              : 'Enter the code from your email and your new password'
            }
          </p>
        </div>

        {/* Progress indicator */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
          <div className={styles.stepIndicators}>
            <span className={`${styles.stepIndicator} ${currentStep >= 1 ? styles.active : ''}`}>
              1
            </span>
            <span className={`${styles.stepIndicator} ${currentStep >= 2 ? styles.active : ''}`}>
              2
            </span>
          </div>
        </div>

        {/* Step 1: Request OTP */}
        {currentStep === 1 && (
          <form onSubmit={handleRequestOtp} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your.email@tip.edu.ph"
                required
                disabled={loading}
              />
            </div>

            {/* TODO: Add reCAPTCHA component here */}
            <div className={styles.recaptchaPlaceholder}>
              <p>reCAPTCHA will be implemented here</p>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {successMessage && <div className={styles.success}>{successMessage}</div>}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={onBackToLogin}
                className={styles.backButton}
                disabled={loading}
              >
                Back to Login
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Reset Password */}
        {currentStep === 2 && (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="otp">Verification Code</label>
              <input
                type="text"
                id="otp"
                name="otp"
                value={formData.otp}
                onChange={handleInputChange}
                placeholder="Enter 6-digit code"
                required
                disabled={loading}
                maxLength="6"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="At least 8 characters"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Re-enter your new password"
                required
                disabled={loading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {successMessage && <div className={styles.success}>{successMessage}</div>}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={goBackToStep1}
                className={styles.backButton}
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.hint}>
            {currentStep === 1
              ? 'Make sure to check your spam folder if you don\'t receive the email.'
              : 'Password must be at least 8 characters long.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;