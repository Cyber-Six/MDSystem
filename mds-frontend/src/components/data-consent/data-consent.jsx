import { useState, useEffect } from 'react';
import { axiosRequest } from '../../core';
import styles from './data-consent.module.css';

const DataConsent = ({ 
  verificationKey, 
  purpose = 'login', // 'login' or 'register'
  onAccept, 
  onCancel,
  isOpen = false 
}) => {
  const [consentData, setConsentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load consent data when modal opens
  useEffect(() => {
    if (isOpen && verificationKey) {
      loadConsentData();
    }
  }, [isOpen, verificationKey]);

  const loadConsentData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosRequest.get(`info/consent/${purpose}`, { // FIX endpoint ${purpose} needed?
        params: { verificationKey }
      });

      if (response.data.ok) {
        setConsentData(response.data);
        
        // If user already consented to the current version, auto-check
        if (response.data.data_consent && 
            response.data.data_consent_version === response.data.required_version) {
          setAgreed(true);
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to load consent policy.';
      setError(errorMessage);
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
        // Call the onAccept callback to proceed with login/registration
        if (onAccept) {
          onAccept();
        }
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please try again.');
          break;
        default:
          setError(errorMessage || 'Failed to record consent. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setAgreed(false);
    setError('');
    if (onCancel) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Data Consent Policy</h2>
          {purpose === 'register' && (
            <p className={styles.subtitle}>Required for Account Registration</p>
          )}
          {purpose === 'login' && (
            <p className={styles.subtitle}>Semestral Update Required</p>
          )}
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <p>Loading consent policy...</p>
            </div>
          ) : error && !consentData ? (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error}</p>
              <button onClick={loadConsentData} className={styles.retryButton}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className={styles.consentText}>
                <h3>Purpose of Data Collection</h3>
                <p>
                  {consentData?.consent_text || 
                    `By using the MDSystem platform, you consent to the collection, processing, 
                    and storage of your personal and medical information. This information is 
                    necessary to provide you with quality healthcare services and maintain 
                    accurate medical records.`
                  }
                </p>

                <h3>Information We Collect</h3>
                <ul>
                  <li>Personal identification information (name, student/employee ID, email)</li>
                  <li>Medical history and health records</li>
                  <li>Appointment and visit records</li>
                  <li>Treatment and prescription information</li>
                  <li>Laboratory and diagnostic results</li>
                </ul>

                <h3>How We Use Your Data</h3>
                <ul>
                  <li>Providing medical care and treatment</li>
                  <li>Maintaining accurate health records</li>
                  <li>Communication regarding appointments and health matters</li>
                  <li>Compliance with institutional and legal requirements</li>
                  <li>Statistical analysis for healthcare improvement (anonymized)</li>
                </ul>

                <h3>Data Protection</h3>
                <p>
                  Your information is protected in accordance with data protection regulations 
                  and institutional policies. Access is restricted to authorized healthcare 
                  providers and administrative staff only. All data is encrypted and stored securely.
                </p>

                <h3>Your Rights</h3>
                <ul>
                  <li>Access and review your medical records</li>
                  <li>Request corrections to inaccurate information</li>
                  <li>Understand how your data is being used</li>
                  <li>File a complaint regarding data handling</li>
                </ul>

                {purpose === 'login' && (
                  <div className={styles.semestralNotice}>
                    <h3>Semestral Consent Update</h3>
                    <p>
                      As part of our institutional policy, all students and employees are 
                      required to renew their consent for data processing at the start of 
                      each semester. This ensures that you are aware of and agree to how 
                      your medical information is being handled.
                    </p>
                  </div>
                )}

                {consentData && (
                  <div className={styles.versionInfo}>
                    <small>
                      Consent Version: {consentData.required_version}
                      {consentData.data_consent_version && 
                       consentData.data_consent_version !== consentData.required_version && (
                        <span className={styles.outdated}>
                          {' '}(You previously agreed to version {consentData.data_consent_version})
                        </span>
                      )}
                    </small>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    id="consent-checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setError('');
                    }}
                    disabled={submitting}
                  />
                  <label htmlFor="consent-checkbox">
                    I have read and agree to the data consent policy and understand 
                    how my personal and medical information will be collected, used, 
                    and protected.
                  </label>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={styles.cancelButton}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.acceptButton}
                    disabled={!agreed || submitting}
                  >
                    {submitting ? 'Submitting...' : 'Accept and Continue'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataConsent;
