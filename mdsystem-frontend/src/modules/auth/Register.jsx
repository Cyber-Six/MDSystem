import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDetectPortalFromSubdomain } from '../../hooks/usePortal';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';
import styles from './register.module.css';

const Register = () => {
  const navigate = useNavigate();
  const role = useDetectPortalFromSubdomain();
  const { isPatient, isMedical, portal } = role;

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: portal || 'patient', // Default to detected portal role
  });

  // Step-specific state
  const [otp, setOtp] = useState('');
  const [verificationKey, setVerificationKey] = useState('');
  const [declaredRole, setDeclaredRole] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');

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

  // Step 1: Initial Registration
  const handleInitialRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/register', {
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      if (response.data.ok) {
        setDeclaredRole(response.data.declaredRole);
        setSuccessMessage('Account created! Please verify your email.');
        setCurrentStep(2);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      
      if (errorCode === 'EMAIL_EXISTS') {
        setError('This email is already registered. Please login instead.');
      } else if (errorCode === 'INVALID_EMAIL_FORMAT') {
        setError('Please enter a valid email address.');
      } else {
        setError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Send Email Verification OTP
  const handleSendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      // In production, get reCAPTCHA token from Google reCAPTCHA v3
      // For now, using placeholder
      const recaptchaTokenPlaceholder = 'recaptcha_token_placeholder';

      const response = await axiosRequest.post('/auth/email/emailv', {
        email: formData.email,
        recaptchaToken: recaptchaTokenPlaceholder
      });

      if (response.data.ok) {
        setSuccessMessage('Verification code sent to your email!');
        setRecaptchaToken(recaptchaTokenPlaceholder);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message;
      setError(errorMessage || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/auth/email/emailv/verify', {
        email: formData.email,
        otp: otp
      });

      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        setSuccessMessage('Email verified successfully!');
        setCurrentStep(3);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;

      if (errorCode === 'INVALID_OTP') {
        setError('Invalid verification code. Please try again.');
      } else if (errorCode === 'OTP_EXPIRED') {
        setError('Verification code expired. Please request a new one.');
      } else {
        setError(errorMessage || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete Registration (after consent)
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!consentAccepted) {
      setError('You must accept the data consent agreement to continue.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosRequest.post('/register/complete', {
        verificationKey: verificationKey,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      if (response.data.ok) {
        // SECURITY: Store tokens using TokenStorage
        if (response.data.accessToken && response.data.refreshToken) {
          TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
        }

        setSuccessMessage('Registration complete! Redirecting to dashboard...');
        
        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;

      if (errorCode === 'INVALID_VERIFICATION_KEY') {
        setError('Invalid verification. Please start over.');
        setCurrentStep(1);
      } else if (errorCode === 'EMAIL_VERIFICATION_REQUIRED') {
        setError('Please verify your email first.');
        setCurrentStep(2);
      } else {
        setError(errorMessage || 'Registration completion failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Render Step 1: Initial Registration Form
  const renderStepOne = () => (
    <div className={styles.stepContainer}>
      <h2>Create Your Account</h2>
      <p className={styles.subtitle}>
        {isPatient && 'Register as a Patient'}
        {isMedical && 'Register as Medical Staff'}
        {!isPatient && !isMedical && 'Register for MDSystem'}
      </p>
      
      <form onSubmit={handleInitialRegistration} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="your.email@example.com"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="At least 8 characters"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Re-enter your password"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="role">Account Type</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            disabled={loading}
          >
            <option value="patient">Patient</option>
            <option value="staff">Medical Staff</option>
          </select>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Creating Account...' : 'Continue'}
        </button>
      </form>
    </div>
  );

  // Render Step 2: Email Verification
  const renderStepTwo = () => (
    <div className={styles.stepContainer}>
      <h2>Verify Your Email</h2>
      <p className={styles.subtitle}>
        We'll send a 6-digit verification code to {formData.email}
      </p>

      {!recaptchaToken ? (
        <div className={styles.otpSendContainer}>
          {error && <div className={styles.error}>{error}</div>}
          {successMessage && <div className={styles.success}>{successMessage}</div>}
          
          <button 
            onClick={handleSendOTP} 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerifyOTP} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="otp">Verification Code</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                setError('');
              }}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
              disabled={loading}
              className={styles.otpInput}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {successMessage && <div className={styles.success}>{successMessage}</div>}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <button 
            type="button"
            onClick={handleSendOTP} 
            className={styles.resendButton}
            disabled={loading}
          >
            Resend Code
          </button>
        </form>
      )}
    </div>
  );

  // Render Step 3: Data Consent
  const renderStepThree = () => (
    <div className={styles.stepContainer}>
      <h2>Data Consent Agreement</h2>
      <p className={styles.subtitle}>Please review and accept our data usage policy</p>

      <div className={styles.consentContainer}>
        <div className={styles.consentText}>
          <h3>Data Collection and Usage</h3>
          <p>
            By registering for MDSystem, you agree to allow us to collect and process your 
            personal and medical information for the purpose of providing healthcare services.
          </p>
          
          <h3>Privacy Protection</h3>
          <p>
            Your data is protected under HIPAA regulations and will only be shared with 
            authorized healthcare providers involved in your care.
          </p>

          <h3>Your Rights</h3>
          <ul>
            <li>Access your data at any time</li>
            <li>Request corrections to your information</li>
            <li>Withdraw consent (subject to legal requirements)</li>
            <li>Export your data in a portable format</li>
          </ul>
        </div>

        <form onSubmit={handleCompleteRegistration} className={styles.form}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="consent"
              checked={consentAccepted}
              onChange={(e) => {
                setConsentAccepted(e.target.checked);
                setError('');
              }}
              disabled={loading}
            />
            <label htmlFor="consent">
              I have read and agree to the data consent agreement
            </label>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {successMessage && <div className={styles.success}>{successMessage}</div>}

          <button 
            type="submit" 
            className={styles.submitButton} 
            disabled={loading || !consentAccepted}
          >
            {loading ? 'Completing Registration...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );

  // Render current step
  return (
    <div className={styles.registerContainer}>
      <div className={styles.stepIndicator}>
        <div className={`${styles.step} ${currentStep >= 1 ? styles.active : ''}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Account</span>
        </div>
        <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''}`}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Verify Email</span>
        </div>
        <div className={`${styles.step} ${currentStep >= 3 ? styles.active : ''}`}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Consent</span>
        </div>
      </div>

      {currentStep === 1 && renderStepOne()}
      {currentStep === 2 && renderStepTwo()}
      {currentStep === 3 && renderStepThree()}
    </div>
  );
};

export default Register;
