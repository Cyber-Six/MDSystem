import { useState } from 'react';
import { useBanner } from '../../context/BannerContext';
import axiosRequest from '../../services/axiosRequestHandler';
import styles from './forget-password.module.css';

const ForgetPassword = ({ onBackToLogin }) => {
  const { showBanner } = useBanner();

  // Form data - only email needed
  const [formData, setFormData] = useState({
    email: '',
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

  // Send Reset Link Email
  const handleSendResetLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE'; // Replace with actual reCAPTCHA implementation

      console.log('Sending reset request for email:', formData.email);

      const response = await axiosRequest.post('/auth/password/forget-password', {
        email: formData.email,
        recaptchaToken,
      });

      console.log('Reset request response:', response.data);
      console.log('Response status:', response.status);

      // Debug: Check if backend provides any link information
      if (response.data.jobId) {
        console.log('Email job queued with ID:', response.data.jobId);
        console.log('Expected processing time:', response.data.expectedArrivalSeconds, 'seconds');
      }

      setSuccessMessage('Password reset link sent! Please check your email.');
      showBanner('Password reset link sent to your email. Please check your inbox.', 'success');
    } catch (err) {
      console.error('Send reset link error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);

      const errorMessage = err.response?.data?.message ||
                          err.response?.data?.error ||
                          'Failed to send reset link. Please try again.';
      setError(errorMessage);
      showBanner(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Forgot Password</h2>
          <p className={styles.subtitle}>
            Enter your email address to receive a password reset link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSendResetLink} className={styles.form}>
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
            <p>⚠️ reCAPTCHA not implemented - using placeholder token</p>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
              This will cause the request to fail until proper reCAPTCHA is integrated.
            </p>
          </div>

          {error && (
            <div className={styles.error}>
              <strong>Error:</strong> {error}
              {error.includes('reCAPTCHA') && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <em>Note: reCAPTCHA validation is required but not yet implemented in the frontend.</em>
                </div>
              )}
            </div>
          )}
          {successMessage && (
            <div className={styles.success}>
              {successMessage}
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                <strong>Expected Link Format:</strong><br />
                <code>https://[portal].[domain]/[session-token]</code><br />
                <em>Where portal is 'www' for patients or 'staff' for staff accounts.</em>
              </div>
            </div>
          )}

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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.hint}>
            Make sure to check your spam folder if you don't receive the email.
          </p>
          <p className={styles.hint} style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            <strong>Debug:</strong> If the link doesn't work, check browser console for response details and verify backend domain configuration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;