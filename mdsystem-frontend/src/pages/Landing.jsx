import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../modules/landing/landing.module.css';

const Landing = () => {
  const navigate = useNavigate();

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
          <h1 className={styles.heroTitle}>Welcome to MDSystem</h1>
          <p className={styles.heroSubtitle}>
            Comprehensive healthcare management system for patients and medical professionals.
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
