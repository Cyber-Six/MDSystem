import { useState } from 'react';
import { axiosRequest } from '../../packages-core-adapter.js';

const ForgetPassword = ({ onBackToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const recaptchaToken = 'RECAPTCHA_TOKEN_HERE';

      await axiosRequest.post('/auth/password/forget-password', {
        email: formData.email,
        recaptchaToken,
      });

      setSuccessMessage('Password reset link sent! Please check your email.');
      setFormData({ email: '' });
      
      setTimeout(() => {
        onBackToLogin();
      }, 2000);
    } catch (err) {
      if (err.response?.data?.error === 'INVALID_INSTITUTION_EMAIL') {
        setError('Email must follow TIP institutional format (@tip.edu.ph).');
      } else if (err.response?.data?.error === 'EMAIL_COOLDOWN_ACTIVE') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-secondary-900 font-heading mb-2">
          Forgot Password?
        </h2>
        <p className="text-xs text-neutral-600">
          Enter your email to receive a password reset link
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-2 p-2 bg-error-50 border border-error-300 rounded-lg">
          <p className="text-error-600 text-xs text-center">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-success-50 border border-success-300 rounded-lg">
          <p className="text-success-600 text-xs text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSendResetLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-secondary-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="your.email@tip.edu.ph"
            required
            disabled={loading || !!successMessage}
            className="w-full px-3 py-2.5 text-sm bg-neutral-50
                     text-secondary-900
                     border border-neutral-300
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     placeholder:text-neutral-400
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBackToLogin}
            disabled={loading || !!successMessage}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-primary-500
                     border-2 border-primary-500 bg-white
                     hover:bg-primary-500 hover:text-white
                    
                     rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !!successMessage}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white
                     bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                    
                     rounded-lg transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </div>
      </form>

      {/* Helper Text */}
      <p className="text-xs text-neutral-500 text-center mt-4">
        Check your spam folder if you don't receive the email
      </p>
    </div>
  );
};

export default ForgetPassword;
