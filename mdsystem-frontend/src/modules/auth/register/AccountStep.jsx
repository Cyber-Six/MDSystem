import { useState } from 'react';
import styles from './css/AccountStep.module.css';

const AccountStep = ({ formData, onInputChange, onSubmit, loading, error, successMessage }) => {
  return (
    <div className={styles.stepContainer}>
      <h2 className={styles.title}>Create Your Account</h2>
      <p className={styles.subtitle}>Enter your credentials to get started</p>
      
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={onInputChange}
            placeholder="your.email@tip.edu.ph"
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
            onChange={onInputChange}
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
            onChange={onInputChange}
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
            onChange={onInputChange}
            disabled={loading}
          >
            <option value="patient">Patient</option>
            <option value="staff">Medical Staff</option>
          </select>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Processing...' : 'Continue'}
        </button>
      </form>
    </div>
  );
};

export default AccountStep;
