import styles from './css/ConsentStep.module.css';

const ConsentStep = ({ 
  consentAccepted, 
  onConsentChange, 
  onSubmit, 
  loading, 
  error, 
  successMessage 
}) => {
  return (
    <div className={styles.stepContainer}>
      <h2 className={styles.title}>Data Consent Agreement</h2>
      <p className={styles.subtitle}>Please review and accept our data usage policy</p>

      <div className={styles.consentContainer}>
        <div className={styles.consentText}>
          <section className={styles.section}>
            <h3>Data Collection and Usage</h3>
            <p>
              By registering for MDSystem, you agree to allow us to collect and process your 
              personal and medical information for the purpose of providing healthcare services.
            </p>
          </section>
          
          <section className={styles.section}>
            <h3>Privacy Protection</h3>
            <p>
              Your data is protected under HIPAA regulations and will only be shared with 
              authorized healthcare providers involved in your care.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Your Rights</h3>
            <ul>
              <li>Access your data at any time</li>
              <li>Request corrections to your information</li>
              <li>Withdraw consent (subject to legal requirements)</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="consent"
              checked={consentAccepted}
              onChange={(e) => onConsentChange(e.target.checked)}
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
            {loading ? 'Processing...' : 'Accept and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConsentStep;
