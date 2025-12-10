import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDetectPortalFromSubdomain } from '../hooks/usePortal';
import styles from '../modules/landing/landing.module.css';

const Landing = () => {
  const navigate = useNavigate();
  const role = useDetectPortalFromSubdomain();
  const { isPatient, isMedical, portal } = role;

  useEffect(() => {
    // Auto-redirect if already logged in
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleGetStarted = () => {
    navigate('/auth');
  };

  return (
    <div className={styles.landingContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {isPatient && 'Welcome to Your Patient Portal'}
            {isMedical && 'Welcome to Staff Portal'}
            {!isPatient && !isMedical && 'Welcome to MDSystem'}
          </h1>
          <p className={styles.heroSubtitle}>
            {isPatient && 'Manage your health records, appointments, and prescriptions in one secure place.'}
            {isMedical && 'Streamline patient care with comprehensive medical record management.'}
            {!isPatient && !isMedical && 'Comprehensive healthcare management system for patients and medical professionals.'}
          </p>
          <button className={styles.ctaButton} onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>Key Features</h2>
        <div className={styles.featuresGrid}>
          {isPatient && (
            <>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📋</div>
                <h3>Medical Records</h3>
                <p>Access your complete medical history anytime, anywhere.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📅</div>
                <h3>Appointments</h3>
                <p>Schedule and manage appointments with your healthcare providers.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>💊</div>
                <h3>Prescriptions</h3>
                <p>View and manage your medications and prescriptions.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔒</div>
                <h3>Secure Access</h3>
                <p>Your health data is protected with advanced security measures.</p>
              </div>
            </>
          )}
          {isMedical && (
            <>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>👥</div>
                <h3>Patient Management</h3>
                <p>Comprehensive patient records and care coordination.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📊</div>
                <h3>Analytics</h3>
                <p>Insights and reporting for better clinical decisions.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📝</div>
                <h3>Documentation</h3>
                <p>Efficient clinical documentation and note-taking.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔐</div>
                <h3>HIPAA Compliant</h3>
                <p>Full compliance with healthcare privacy regulations.</p>
              </div>
            </>
          )}
          {!isPatient && !isMedical && (
            <>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🏥</div>
                <h3>Unified Platform</h3>
                <p>Single platform for patients and healthcare providers.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔐</div>
                <h3>Secure & Compliant</h3>
                <p>HIPAA-compliant with enterprise-grade security.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📱</div>
                <h3>Accessible</h3>
                <p>Access from any device, anywhere, anytime.</p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>⚡</div>
                <h3>Fast & Reliable</h3>
                <p>High-performance system built for healthcare.</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>&copy; 2025 MDSystem. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
