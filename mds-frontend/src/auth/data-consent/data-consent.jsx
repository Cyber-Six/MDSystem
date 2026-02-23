import { useState, useEffect, useRef } from 'react';
import { axiosRequest } from '../../packages-core-adapter';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleCloseClick}
        />
        
        {/* Modal Container */}
        <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-neutral-900 
                      rounded-2xl shadow-2xl flex flex-col overflow-hidden
                      animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-6 border-b 
                        border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <div>
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Data Consent Policy
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {purpose === 'register' 
                  ? 'Required for Account Registration' 
                  : isNewVersion 
                    ? 'Policy Update - Consent Renewal Required'
                    : 'Review MDSystem Data Policy'}
              </p>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleCloseClick}
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 
                       dark:text-neutral-400 dark:hover:text-neutral-200
                       hover:bg-neutral-100 dark:hover:bg-neutral-700
                       transition-colors focus:outline-none"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5" ref={scrollContainerRef} onScroll={handleScroll}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="animate-spin h-10 w-10 text-primary-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-neutral-600 dark:text-neutral-400">Loading consent policy...</p>
              </div>
            ) : error && !consentData ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-error-100 dark:bg-error-900/30 
                              flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-error-600 dark:text-error-400 text-center mb-4">{error}</p>
                <button 
                  onClick={loadConsentData}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white 
                           rounded-lg transition-colors font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Version Notice */}
                {isNewVersion && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 
                                dark:border-amber-700 rounded-lg">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" 
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">Policy Updated</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                          Our data consent policy has been updated from version {consentData.data_consent_version} to {consentData.required_version}. 
                          Please review and accept the new policy to continue.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Consent Text from Backend */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border 
                              border-neutral-200 dark:border-neutral-700">
                  <p className="text-secondary-700 dark:text-neutral-300 leading-relaxed">
                    {consentData?.consent_text || 
                      "I consent to the collection and use of my data in accordance with the MDSystem Privacy Policy."}
                  </p>
                </div>

                {/* Version Info */}
                {consentData && (
                  <div className="-mt-3">
                    <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                      Consent Version: <span className="font-mono font-bold text-primary-600 dark:text-primary-400">{consentData.required_version}</span>
                    </p>
                  </div>
                )}

                {/* Detailed Consent Sections */}
                <div className="space-y-4 text-xs">
                  {/* Purpose */}
                  <section>
                    <h3 className="text-lg font-semibold text-secondary-800 dark:text-neutral-300 mb-1.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 
                                     flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-semibold">1</span>
                      Purpose of Data Collection
                    </h3>
                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed pl-7">
                      By using MDSystem, you consent to the collection, processing, and storage of your 
                      personal and medical information. This information is necessary to provide you with 
                      quality healthcare services and maintain accurate medical records.
                    </p>
                  </section>

                  {/* Information Collected */}
                  <section>
                    <h3 className="text-lg font-semibold text-secondary-800 dark:text-neutral-300 mb-1.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 
                                     flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-semibold">2</span>
                      Information We Collect
                    </h3>
                    <ul className="text-sm text-neutral-500 dark:text-neutral-500 pl-7 space-y-1">
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Personal identification information (name, student/employee ID, email)
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Medical history and health records
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Appointment and visit records
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Treatment and prescription information
                      </li>
                    </ul>
                  </section>

                  {/* Data Protection */}
                  <section>
                    <h3 className="text-lg font-semibold text-secondary-800 dark:text-neutral-300 mb-1.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 
                                     flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-semibold">3</span>
                      Data Protection
                    </h3>
                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed pl-7">
                      Your information is protected in accordance with data protection regulations and 
                      institutional policies. Access is restricted to authorized healthcare providers 
                      and administrative staff only. All data is encrypted and stored securely.
                    </p>
                  </section>

                  {/* Your Rights */}
                  <section>
                    <h3 className="text-lg font-semibold text-secondary-800 dark:text-neutral-300 mb-1.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 
                                     flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-semibold">4</span>
                      Your Rights
                    </h3>
                    <ul className="text-sm text-neutral-500 dark:text-neutral-500 pl-7 space-y-1">
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Access and review your medical records
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Request corrections to inaccurate information
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Understand how your data is being used
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        File a complaint regarding data handling
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && consentData && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 
                          bg-neutral-50 dark:bg-neutral-800/50">
              <form onSubmit={handleSubmit}>
                {/* Checkbox */}
                <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setError('');
                    }}
                    disabled={submitting || !hasScrolledToBottom}
                    className="mt-1 w-6 h-6 rounded border-2 border-neutral-400 dark:border-neutral-500
                             bg-white dark:bg-neutral-700
                             checked:bg-primary-500 checked:border-primary-500 
                             focus:outline-none
                             transition-all cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300 
                                 group-hover:text-secondary-900 dark:group-hover:text-white transition-colors">
                    I have read and agree to the data consent policy and understand how my personal 
                    and medical information will be collected, used, and protected.
                    {!hasScrolledToBottom && (
                      <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        ⚠️ Please scroll to the bottom to enable this option
                      </span>
                    )}
                  </span>
                </label>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-300 
                                dark:border-error-700 rounded-lg">
                    <p className="text-error-600 dark:text-error-400 text-sm text-center">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleCloseClick}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-neutral-300 dark:bg-neutral-800 
                             hover:bg-neutral-400 dark:hover:bg-neutral-700
                             text-secondary-700 dark:text-neutral-200 font-medium rounded-lg
                             border border-neutral-400 dark:border-neutral-700
                             transition-colors disabled:opacity-50 order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!agreed || submitting}
                    className="flex-1 px-4 py-3 bg-primary-500 hover:bg-primary-600 
                             active:bg-primary-700 text-white font-semibold rounded-lg
                             transition-all disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-md hover:shadow-lg order-1 sm:order-2
                             flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Accept & Continue
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Exit Warning Modal */}
      {showExitWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={handleCancelExit} />
          
          {/* Warning Dialog */}
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl 
                        shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 
                            flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                Data Consent Required
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                {purpose === 'register' 
                  ? 'Data consent is required to create an account. Without accepting the data consent policy, your registration cannot be completed.'
                  : 'Data consent is required to continue. Without accepting the updated data consent policy, you will not be able to log in to your account.'}
              </p>
            </div>

            {/* Important Notice */}
            <div className="mb-6 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 
                          dark:border-error-800 rounded-lg">
              <p className="text-error-700 dark:text-error-400 text-xs text-center font-medium">
                ⚠️ Closing this dialog will cancel your {purpose === 'register' ? 'registration' : 'login'} process.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmExit}
                className="flex-1 px-4 py-2.5 bg-neutral-200 dark:bg-neutral-700 
                         hover:bg-neutral-300 dark:hover:bg-neutral-600
                         text-secondary-700 dark:text-neutral-200 font-medium rounded-lg
                         transition-colors text-sm"
              >
                Cancel {purpose === 'register' ? 'Registration' : 'Login'}
              </button>
              <button
                onClick={handleCancelExit}
                className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 
                         text-white font-semibold rounded-lg
                         transition-colors text-sm"
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" />
          
          {/* Dialog */}
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl 
                        shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 
                            flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                Account Already Exists
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                An account with this email address already exists in our system. 
                Please log in to your existing account instead of creating a new one.
              </p>
            </div>

            {/* Info Box */}
            <div className="mb-6 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 
                          dark:border-primary-800 rounded-lg">
              <p className="text-primary-700 dark:text-primary-400 text-xs text-center font-medium">
                💡 If you forgot your password, you can reset it on the login page.
              </p>
            </div>

            {/* Button */}
            <button
              onClick={handleGoToLogin}
              className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 
                       text-white font-semibold rounded-lg
                       transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
