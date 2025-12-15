import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';
import { AccountStep, SendOtpStep, VerifyOtpStep, ConsentStep, SuccessStep } from './register/index';
import styles from './register.module.css';

const TOTAL_STEPS = 5;

const Register = ({ onBackToLogin }) => {
  const navigate = useNavigate();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [slideDirection, setSlideDirection] = useState('next');
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
  });

  // Step-specific state
  const [otp, setOtp] = useState('');
  const [verificationKey, setVerificationKey] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

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

  const goToNextStep = () => {
    setSlideDirection('next');
    setError('');
    setSuccessMessage('');
    setCurrentStep(prev => prev + 1);
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
      const response = await axiosRequest.post('auth/register', {
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      if (response.data.ok) {
        goToNextStep();
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;
      
      if (errorCode === 'EMAIL_EXISTS') {
        setError('This email is already registered. Please login instead.');
      } else if (errorCode === 'INVALID_EMAIL_FORMAT') {
        setError('Please enter a valid email address.');
      } else if (errorCode === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format.');
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
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_PLACEHOLDER';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('Verification code sent to your email!');
        goToNextStep();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message;
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
      const response = await axiosRequest.post('/auth/email/verification/verify', {
        email: formData.email,
        otp: otp
      });

      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        goToNextStep();
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'INVALID_OTP') {
        setError('Invalid verification code. Please try again.');
      } else if (errorCode === 'OTP_EXPIRED') {
        setError('Verification code expired. Please request a new one.');
      } else if (errorCode === 'OTP_LOCKED_OUT') {
        const retryAfter = err.response?.data?.retryAfterSeconds;
        setError(`Too many invalid attempts. Please try again after ${retryAfter} seconds.`);
      } else {
        setError(errorMessage || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      const recaptchaToken = 'RECAPTCHA_TOKEN_PLACEHOLDER';

      const response = await axiosRequest.post('/auth/email/verification', {
        email: formData.email,
        recaptchaToken
      });

      if (response.data.ok) {
        setSuccessMessage('A new verification code has been sent!');
        setOtp('');
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      
      if (errorCode === 'EMAIL_COOLDOWN_ACTIVE') {
        setError('Please wait before requesting another code.');
      } else if (errorCode === 'EMAIL_ATTEMPT_LIMIT_REACHED') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Submit Consent and Complete Registration
  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!consentAccepted) {
      setError('You must accept the data consent agreement to continue.');
      setLoading(false);
      return;
    }

    try {
      // Record consent
      const consentResponse = await axiosRequest.post('auth/consent/register', { // FIX endpoint
        verificationKey
      });

      if (consentResponse.data.ok) {
        // Complete registration
        const response = await axiosRequest.post('auth/register/complete', {
          verificationKey,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });

        if (response.data.ok) {
          // Store tokens
          if (response.data.accessToken && response.data.refreshToken) {
            TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
          }

          goToNextStep();
          
          // Redirect after showing success
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        }
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      if (errorCode === 'INVALID_VERIFICATION_SESSION' || errorCode === 'INVALID_OR_EXPIRED_SESSION') {
        setError('Session expired. Please start over.');
        setCurrentStep(1);
      } else if (errorCode === 'DATA_CONSENT_REQUIRED') {
        setError('You must agree to the data consent policy.');
      } else {
        setError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <AccountStep
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleInitialRegistration}
            loading={loading}
            error={error}
            successMessage={successMessage}
          />
        );
      case 2:
        return (
          <SendOtpStep
            email={formData.email}
            onSendOtp={handleSendOTP}
            loading={loading}
            error={error}
            successMessage={successMessage}
          />
        );
      case 3:
        return (
          <VerifyOtpStep
            email={formData.email}
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            loading={loading}
            error={error}
            successMessage={successMessage}
          />
        );
      case 4:
        return (
          <ConsentStep
            consentAccepted={consentAccepted}
            onConsentChange={setConsentAccepted}
            onSubmit={handleConsentSubmit}
            loading={loading}
            error={error}
            successMessage={successMessage}
          />
        );
      case 5:
        return <SuccessStep message="Your account has been created successfully!" />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.registerContainer}>
      {/* Step Counter */}
      <div className={styles.stepCounter}>
        Step {currentStep} of {TOTAL_STEPS}
      </div>

      {/* Back button */}
      {currentStep === 1 && onBackToLogin && (
        <button 
          className={styles.backButton}
          onClick={onBackToLogin}
          type="button"
        >
          ← Back to Login
        </button>
      )}

      {/* Step Content with Animation */}
      <div className={`${styles.stepContent} ${styles[slideDirection]}`} key={currentStep}>
        {renderStep()}
      </div>
    </div>
  );
};

export default Register;
