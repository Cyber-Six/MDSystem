import styles from './css/SuccessStep.module.css';

const SuccessStep = ({ message }) => {
  return (
    <div className={styles.stepContainer}>
      <div className={styles.iconContainer}>
        <span className={styles.icon}>✅</span>
      </div>
      
      <h2 className={styles.title}>Registration Complete!</h2>
      <p className={styles.subtitle}>
        {message || 'Your account has been created successfully.'}
      </p>
      
      <p className={styles.redirect}>
        Redirecting you to the dashboard...
      </p>

      <div className={styles.loader}>
        <div className={styles.spinner}></div>
      </div>
    </div>
  );
};

export default SuccessStep;
