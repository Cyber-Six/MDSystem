import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosRequest } from '../packages-core-adapter';

const ResetPassword = () => {
  const { verificationKey } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateLink = async () => {
      try {
        await axiosRequest.get(`/auth/password/reset-password/${verificationKey}`);
        setAllowed(true);
      } catch (err) {
        setError(err.response?.data?.message || "Reset link is invalid or expired.");
      } finally {
        setChecking(false);
      }
    };
    validateLink();
  }, [verificationKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirm) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axiosRequest.post(`/auth/password/reset-password/${verificationKey}`, { newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate("/auth/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-dark-bg-primary">
        <div className="flex items-center gap-3 text-neutral-500 dark:text-dark-text-secondary">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Validating reset link...
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-dark-bg-primary px-4">
        <div className="w-full max-w-md bg-white dark:bg-dark-bg-secondary rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-secondary-900 dark:text-dark-text-primary mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-6">{error}</p>
          <button
            onClick={() => navigate("/auth/login")}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-dark-bg-primary px-4">
      <div className="w-full max-w-md bg-white dark:bg-dark-bg-secondary rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/MDSystem.png" alt="MDSystem Logo" className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary font-heading mb-1">
            Reset Password
          </h2>
          <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
            Enter your new password below
          </p>
        </div>

        {/* Success state */}
        {success && (
          <div className="mb-6 p-4 bg-success-50 dark:bg-success-900/20 border border-success-300 dark:border-success-700 rounded-lg">
            <p className="text-success-600 dark:text-success-400 text-sm text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Password reset successful! Redirecting to login...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-300 dark:border-error-700 rounded-lg">
            <p className="text-error-600 dark:text-error-400 text-sm text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2">
              New Password
            </label>
            <input
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || success}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary
                       text-secondary-900 dark:text-dark-text-primary
                       border border-neutral-300 dark:border-dark-border-primary
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-dark-text-primary mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading || success}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-dark-bg-tertiary
                       text-secondary-900 dark:text-dark-text-primary
                       border border-neutral-300 dark:border-dark-border-primary
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                     dark:bg-primary-600 dark:hover:bg-primary-700
                     text-white font-semibold py-3.5 rounded-lg
                     transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center shadow-md hover:shadow-lg"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/auth/login")}
            className="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300
                     font-medium text-sm transition-colors hover:underline"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
