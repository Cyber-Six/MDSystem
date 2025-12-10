import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Login from '../modules/auth/Login';
import Register from '../modules/auth/Register';
import { useDetectPortalFromSubdomain } from '../hooks/usePortal';
import styles from '../modules/auth/auth.module.css';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useDetectPortalFromSubdomain();
  const { isPatient, isMedical, portal } = role;

  // Determine initial view from URL query params or default to login
  const queryParams = new URLSearchParams(location.search);
  const initialView = queryParams.get('view') || 'login';
  
  const [activeView, setActiveView] = useState(initialView);

  useEffect(() => {
    // Auto-redirect if already logged in
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    // Update activeView when URL changes
    const view = queryParams.get('view') || 'login';
    setActiveView(view);
  }, [location.search]);

  const handleViewChange = (view) => {
    setActiveView(view);
    // Update URL without causing a full navigation
    navigate(`/auth?view=${view}`, { replace: true });
  };

  return (
    <div className={styles.authContainer}>
      {/* Left/Right Panel - Login */}
      <div className={styles.loginPanel}>
        <div className={styles.loginPanelContent}>
          <div className={styles.portalBadge}>
            {isPatient && '👤 Patient Portal'}
            {isMedical && '⚕️ Staff Portal'}
            {!isPatient && !isMedical && '🏥 MDSystem'}
          </div>
          
          <h1 className={styles.loginTitle}>
            {activeView === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          
          {activeView === 'login' ? (
            <>
              <Login />
              <div className={styles.switchView}>
                <p>Don't have an account?</p>
                <button 
                  onClick={() => handleViewChange('register')}
                  className={styles.switchButton}
                >
                  Register Here
                </button>
              </div>
            </>
          ) : (
            <div className={styles.loginRedirect}>
              <p>Already have an account?</p>
              <button 
                onClick={() => handleViewChange('login')}
                className={styles.switchButton}
              >
                Login Here
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center Content - Register or Other Content */}
      <div className={styles.centerContent}>
        {activeView === 'register' ? (
          <div className={styles.registerContent}>
            <Register />
          </div>
        ) : (
          <div className={styles.welcomeContent}>
            <h2>
              {isPatient && 'Patient Portal Access'}
              {isMedical && 'Medical Staff Access'}
              {!isPatient && !isMedical && 'Healthcare Management System'}
            </h2>
            <p className={styles.welcomeDescription}>
              {isPatient && 'Access your medical records, appointments, and prescriptions securely.'}
              {isMedical && 'Manage patient care with comprehensive tools and analytics.'}
              {!isPatient && !isMedical && 'Comprehensive platform for healthcare management.'}
            </p>
            
            <div className={styles.features}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🔒</span>
                <h3>Secure & Private</h3>
                <p>Your data is protected with enterprise-grade security</p>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>📱</span>
                <h3>Accessible</h3>
                <p>Access from any device, anywhere</p>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>⚡</span>
                <h3>Fast & Reliable</h3>
                <p>High-performance system you can trust</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
