import { useState, useEffect, useRef } from 'react';
import { axiosRequest } from '../../../packages-core-adapter.js';

/**
 * DataConsent Modal Component
 * 
 * A modal that displays data consent policy for login/register flows.
 * 
 * Backend Integration:
 * - GET /info/consent/:purpose - Fetches consent data
 * - POST /info/consent/:purpose - Records user consent
 * 
 * @param {Object} props
 * @param {string} props.verificationKey - Session verification key from login/register flow
 * @param {'login'|'register'} props.purpose - Purpose of consent (affects messaging)
 * @param {Function} props.onAccept - Callback when consent is accepted
 * @param {Function} props.onCancel - Callback when modal is cancelled
 * @param {boolean} props.isOpen - Controls modal visibility
 */
const DataConsent = ({ 
  verificationKey, 
  purpose = 'login',
  onAccept, 
  onCancel,
  isOpen = false 
}) => {
  // State
  const [consentData, setConsentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showEmailExistsDialog, setShowEmailExistsDialog] = useState(false);
  const scrollContainerRef = useRef(null);

  // Load consent data when modal opens
  useEffect(() => {
    if (isOpen && verificationKey) {
      loadConsentData();
    }
  }, [isOpen, verificationKey]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      setError('');
      setShowExitWarning(false);
      setHasScrolledToBottom(false);
    }
  }, [isOpen]);

  // Auto-enable checkbox if content doesn't need scrolling
  useEffect(() => {
    if (!loading && consentData && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      // If content fits without scrolling, no need to require scroll-to-bottom
      if (el.scrollHeight <= el.clientHeight + 10) {
        setHasScrolledToBottom(true);
      }
    }
  }, [loading, consentData]);

  const loadConsentData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosRequest.get(`/info/consent/${purpose}`, {
        params: { verificationKey }
      });

      if (response.data.ok) {
        setConsentData(response.data);
      } else {
        // API returned ok: false — still set data so footer renders
        setConsentData(response.data);
        setError(response.data.message || 'Unexpected response from server.');
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || 'Failed to load consent policy.';
      
      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'MISSING_VERIFICATION_KEY':
          setError('Verification key is missing. Please restart the process.');
          break;
        default:
          setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agreed) {
      setError('You must agree to the data consent policy to continue.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await axiosRequest.post(`/info/consent/${purpose}`, {
        verificationKey
      });

      if (response.data.ok) {
        if (onAccept) {
          onAccept({
            version: response.data.version,
            verificationKey
          });
        }
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || 'Failed to record consent.';

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'EMAIL_ALREADY_EXISTS':
        case 'USER_ALREADY_EXISTS':
          // Show email exists dialog for registration flow
          if (purpose === 'register') {
            setShowEmailExistsDialog(true);
          } else {
            setError(errorMessage);
          }
          break;
        default:
          setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseClick = () => {
    setShowExitWarning(true);
  };

  const handleConfirmExit = () => {
    setShowExitWarning(false);
    setAgreed(false);
    setError('');
    if (onCancel) {
      onCancel();
    }
  };

  const handleCancelExit = () => {
    setShowExitWarning(false);
  };

  const handleGoToLogin = () => {
    setShowEmailExistsDialog(false);
    // Redirect to login page
    window.location.href = '/auth/login';
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 10;
    if (bottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isNewVersion = consentData && 
    consentData.data_consent_version && 
    consentData.data_consent_version !== consentData.required_version;

  return (
    <>
      {/* Main Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleCloseClick}
        />

        {/* Modal Container */}
        <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-secondary-900 leading-tight">Data Consent Policy</h2>
                <p className="text-xs text-neutral-500 mt-0.5 leading-tight">
                  {purpose === 'register'
                    ? 'Required for Account Registration'
                    : isNewVersion
                      ? 'Policy Update — Renewal Required'
                      : 'Review MDSystem Data Policy'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseClick}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors flex-shrink-0 ml-3"
              aria-label="Close modal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4" ref={scrollContainerRef} onScroll={handleScroll}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <svg className="animate-spin h-8 w-8 text-primary-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-neutral-500">Loading consent policy...</p>
              </div>
            ) : error && !consentData ? (
              <div className="flex flex-col items-center justify-center py-10">
                <svg className="w-8 h-8 text-error-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-error-600 text-center mb-3">{error}</p>
                <button
                  onClick={loadConsentData}
                  className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                {/* Version Update Notice */}
                {isNewVersion && (
                  <div className="flex gap-2.5 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Policy Updated</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                        Updated from version {consentData.data_consent_version} to {consentData.required_version}. Please review and accept the new policy to continue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Consent Text from Backend */}
                {consentData?.consent_text ? (
                  <div
                    className="text-sm text-secondary-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: consentData.consent_text }}
                  />
                ) : (
                  <p className="text-sm text-secondary-700 leading-relaxed">
                    I consent to the collection and use of my data in accordance with the MDSystem Privacy Policy.
                  </p>
                )}

                {/* Version Badge */}
                {consentData && (
                  <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center gap-2">
                    <span className="text-xs text-neutral-400">Document version:</span>
                    <span className="text-xs font-mono font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                      {consentData.required_version}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && consentData && (
            <div className="flex-shrink-0 px-5 py-3 border-t border-neutral-200 bg-neutral-50">
              <form onSubmit={handleSubmit}>
                {/* Checkbox */}
                <label className="flex items-start gap-2.5 mb-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setError('');
                    }}
                    disabled={submitting || !hasScrolledToBottom}
                    className="mt-0.5 w-4 h-4 rounded border border-neutral-400 accent-primary-500
                             cursor-pointer disabled:opacity-50 flex-shrink-0"
                  />
                  <span className="text-xs text-secondary-600 group-hover:text-secondary-800 transition-colors leading-relaxed">
                    I have read and agree to the data consent policy and understand how my personal
                    and medical information will be collected, used, and protected.
                    {!hasScrolledToBottom && (
                      <span className="flex items-center gap-1 text-xs text-amber-500 mt-1 font-medium">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Please scroll to the bottom to enable this option
                      </span>
                    )}
                  </span>
                </label>

                {/* Error */}
                {error && (
                  <div className="mb-3 px-3 py-2 bg-error-50 border border-error-200 rounded-lg">
                    <p className="text-xs text-error-600 text-center">{error}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseClick}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-secondary-600
                             bg-white border border-neutral-300 rounded-lg
                             hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!agreed || submitting}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-white
                             bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                             rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Accept &amp; Continue
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Exit Warning Dialog */}
      {showExitWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={handleCancelExit} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-secondary-900">Data Consent Required</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {purpose === 'register'
                    ? 'Consent is required to create an account. Closing will cancel your registration.'
                    : 'Consent is required to continue. Closing will cancel your login.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmExit}
                className="flex-1 px-3 py-2 text-xs font-medium text-secondary-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel {purpose === 'register' ? 'Registration' : 'Login'}
              </button>
              <button
                onClick={handleCancelExit}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                Continue Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Already Exists Dialog */}
      {showEmailExistsDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-secondary-900">Account Already Exists</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  An account with this email already exists. Please log in to your existing account instead.
                </p>
              </div>
            </div>
            <button
              onClick={handleGoToLogin}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Go to Login Page
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DataConsent;
