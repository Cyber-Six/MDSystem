import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosRequest from '../../services/axiosRequestHandler';
import { TokenStorage } from '../../services/refreshTokenService';
import DataConsent from '../../components/data-consent/DataConsent';
import './login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [verificationKey, setVerificationKey] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  
  const navigate = useNavigate();

  const handleSend2FA = async () => {
    try {
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';
      
      await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
    } catch (err) {
      console.error('Failed to send 2FA code:', err);
      // Don't throw error here, let the user manually request resend
    }
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Step 1: Initial login with email, password, role, and recaptcha
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE'; // Replace with actual reCAPTCHA implementation
      
      const response = await axiosRequest.post('/login', { 
        email, 
        password, 
        role: selectedRole,
        recaptchaToken 
      });
      
      if (response.data.ok) {
        setVerificationKey(response.data.verificationKey);
        
        // Check if 2FA is required
        if (response.data.requires2FA) {
          // Automatically send 2FA code
          await handleSend2FA();
          setShowTwoFactor(true);
        } else {
          // No 2FA required, show consent screen
          setShowConsent(true);
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'MISSING_FIELDS':
          setError('Please fill in all required fields.');
          break;
        case 'INVALID_EMAIL_FORMAT':
          setError('Invalid email format.');
          break;
        case 'INVALID_INSTITUTION_EMAIL':
          setError('Email must follow TIP institutional format.');
          break;
        case 'INVALID_RECAPTCHA':
          setError('reCAPTCHA verification failed. Please try again.');
          break;
        case 'INVALID_CREDENTIALS':
          setError('Email or password is incorrect.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Verify 2FA OTP code
      const response = await axiosRequest.post('/auth/email/2fa/verify', { 
        email,
        otp: twoFactorCode 
      });
      
      if (response.data.ok) {
        // After successful 2FA verification, show consent
        setShowTwoFactor(false);
        setShowConsent(true);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || '2FA verification failed.';
      const errorCode = err.response?.data?.error;
      const attempts = err.response?.data?.attempts;
      const attemptLimit = err.response?.data?.attemptLimit;
      const retryAfter = err.response?.data?.retryAfterSeconds;
      
      switch (errorCode) {
        case 'INVALID_OTP':
          setError(`Invalid OTP code. Attempts: ${attempts}/${attemptLimit}`);
          break;
        case 'OTP_LOCKED_OUT':
          setError(`Too many invalid attempts. Please try again after ${retryAfter} seconds.`);
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend2FA = async () => {
    setError('');
    setIsLoading(true);

    try {
      // TODO: Integrate Google reCAPTCHA token
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';
      
      const response = await axiosRequest.post('/auth/email/2fa', { 
        email,
        recaptchaToken 
      });
      
      if (response.data.ok) {
        setError(''); // Clear any previous errors
        // Show success message briefly
        const successMsg = 'A new verification code has been sent to your email.';
        setError(''); // We'll use a success state in production
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to resend code.';
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'EMAIL_COOLDOWN_ACTIVE':
          setError('Please wait before requesting another code.');
          break;
        case 'EMAIL_ATTEMPT_LIMIT_REACHED':
          setError('Too many attempts. Please try again later.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteLogin = async () => {
    if (!consentAgreed) {
      setError('You must agree to the data consent policy to continue.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Step 3: Complete login with verificationKey
      const response = await axiosRequest.post('/login/complete', { 
        verificationKey 
      });
      
      if (response.data.ok) {
        // SECURITY: Store tokens using TokenStorage
        if (response.data.accessToken && response.data.refreshToken) {
          TokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
        }
        
        // Redirect to dashboard on success
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login completion failed.';
      const errorCode = err.response?.data?.error;
      
      switch (errorCode) {
        case 'INVALID_LOGIN_SESSION':
          setError('Login session is invalid or expired. Please try again.');
          // Reset to initial state
          setShowConsent(false);
          setShowTwoFactor(false);
          setVerificationKey('');
          break;
        case '2FA_NOT_VERIFIED':
          setError('Email 2FA has not been verified.');
          setShowConsent(false);
          setShowTwoFactor(true);
          break;
        case 'DATA_CONSENT_REQUIRED':
          setError('You must agree to the data consent policy to login.');
          break;
        case 'OUTDATED_CONSENT':
          setError('You must agree to the latest data consent policy.');
          break;
        default:
          setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial login form
  if (!showTwoFactor && !showConsent) {
    return (
      <form className="login-form" onSubmit={handleInitialLogin}>
        <h2>Login</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <input 
          type="email" 
          placeholder="TIP Institutional Email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select 
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          required
        >
          <option value="">Select Role</option>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="admin">Admin</option>
        </select>
        
        {/* TODO: Add Google reCAPTCHA component here */}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    );
  }

  // Two-factor authentication form
  if (showTwoFactor) {
    return (
      <form className="login-form" onSubmit={handleTwoFactorVerification}>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
        
        <button 
          type="button" 
          onClick={handleResend2FA}
          disabled={isLoading}
          className="resend-button"
        >
          Resend Code
        </button>
        
        <button 
          type="button" 
          onClick={() => {
            setShowTwoFactor(false);
            setVerificationKey('');
            setTwoFactorCode('');
          }}
          className="cancel-button"
        >
          Cancel
        </button>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
        
        <button 
          type="button" 
          onClick={() => {
            setShowTwoFactor(false);
            setVerificationKey('');
          }}
          className="cancel-button"
        >
          Cancel
        </button>
      </form>
    );
  }

  // Data consent form
  if (showConsent) {
    return (
      <div className="login-form consent-form">
        <h2>Data Consent Policy</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="consent-content">
          <p>Before proceeding, please review and agree to our data consent policy:</p>
          <div className="consent-text">
            {/* TODO: Load actual consent policy text */}
            <p>By using this system, you agree to the collection and processing of your personal and medical data in accordance with our privacy policy and applicable laws.</p>
            <p>Your data will be used solely for medical purposes and will be protected according to industry standards.</p>
          </div>
          
          <label className="consent-checkbox">
            <input 
              type="checkbox" 
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
            />
            I have read and agree to the data consent policy
          </label>
        </div>
        
        <button 
          type="button"
          onClick={handleCompleteLogin}
          disabled={isLoading || !consentAgreed}
        >
          {isLoading ? 'Completing...' : 'Complete Login'}
        </button>
        
        <button 
          type="button" 
          onClick={() => {
            setShowConsent(false);
            setVerificationKey('');
          }}
          className="cancel-button"
        >
          Cancel
        </button>
      </div>
    );
  }
};

export default Login;
