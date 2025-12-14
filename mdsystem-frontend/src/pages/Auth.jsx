import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from '../components/navbar/NavBar.jsx';
import Login from '../modules/auth/Login';
import Register from '../modules/auth/Register';
import styles from '../modules/auth/auth.module.css';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const initialView = queryParams.get('view') || 'login';
  
  const [activeView, setActiveView] = useState(initialView);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const handleViewChange = (view) => {
    setActiveView(view);
    navigate(`/auth?view=${view}`, { replace: true });
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <>
      <NavBar />
      <div className={styles.authPage}>
        {/* Fullscreen Landing Content */}
        <div className={styles.landingContent}>
          <div className={styles.landingOverlay}>
            <div className={styles.landingInner}>
              <div className={styles.heroSection}>
                <div className={styles.portalBadge}>🏥 MDSystem</div>
                <h1 className={styles.heroTitle}>Healthcare Management System</h1>
                <p className={styles.heroSubtitle}>
                  Comprehensive platform for healthcare management with enterprise-grade security.
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
            </div>
          </div>
        </div>

        {/* Sliding Login/Register Panel */}
        <div className={`${styles.authPanel} ${isPanelOpen ? styles.panelOpen : ''}`}>
          <button 
            className={styles.toggleButton}
            onClick={togglePanel}
            aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
          >
            {isPanelOpen ? '→' : '←'}
          </button>

          <div className={styles.authPanelContent}>
            {activeView === 'login' ? (
              <div className={styles.authForm}>
                <h2 className={styles.formTitle}>Welcome Back</h2>
                <p className={styles.formSubtitle}>Sign in to your account</p>
                
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
              </div>
            ) : (
              <div className={styles.authForm}>
                <Register onBackToLogin={() => handleViewChange('login')} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
