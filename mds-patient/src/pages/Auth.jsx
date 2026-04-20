import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Login from '../modules/auth/login';
import Register from '../modules/auth/register.jsx';
import AuthSlides from '../modules/auth/auth-slides.jsx';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Patient portal supports both login and register
  const getViewFromPath = () => {
    if (location.pathname === '/auth/register') return 'register';
    return 'login';
  };
  
  const [activeView, setActiveView] = useState(getViewFromPath());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [shouldPopLoginButton, setShouldPopLoginButton] = useState(false);
  const [isVerificationView, setIsVerificationView] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);

  // Blur button when panel closes to remove focus styling
  useEffect(() => {
    if (!isPanelOpen && !isPanelClosing && buttonRef.current) {
      buttonRef.current.blur();
    }
  }, [isPanelOpen, isPanelClosing]);

  // Update activeView when path changes
  useEffect(() => {
    const nextView = getViewFromPath();
    setActiveView(nextView);

    if (nextView !== 'login') {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsPanelClosing(false);
      setShouldPopLoginButton(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleViewChange = (view) => {
    if (view !== 'login') {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsPanelClosing(false);
      setShouldPopLoginButton(false);
    }

    setActiveView(view);
    setRegisterStep(1);
    navigate(`/auth/${view}`, { replace: true });
  };

  const finishPanelClose = () => {
    setIsPanelClosing(false);
    setShouldPopLoginButton(true);
  };

  const openPanel = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setShouldPopLoginButton(false);
    setIsPanelClosing(false);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    if (!isPanelOpen) {
      return;
    }

    setIsPanelOpen(false);

    if (activeView !== 'login') {
      setIsPanelClosing(false);
      setShouldPopLoginButton(false);
      return;
    }

    setShouldPopLoginButton(false);
    setIsPanelClosing(true);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      finishPanelClose();
      closeTimerRef.current = null;
    }, 450);
  };

  const handlePanelTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'right') {
      return;
    }

    if (!isPanelOpen && isPanelClosing && activeView === 'login') {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      finishPanelClose();
    }
  };

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isPanelOpen && !event.target.closest('.auth-panel') && !event.target.closest('.toggle-btn')) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fullscreen Landing Content with Slider */}
      <AuthSlides isPanelOpen={isPanelOpen} activeView={activeView} />

      {/* Toggle Button - Appears after the login panel fully closes */}
      {!isPanelOpen && !isPanelClosing && activeView === 'login' && (
        <button 
          ref={buttonRef}
          className={`toggle-btn fixed top-6 right-6 px-6 py-3 !bg-primary-500 hover:!bg-primary-600 text-white font-semibold rounded-full shadow-lg cursor-pointer flex items-center gap-2 z-[12] transition-colors duration-200 hover:shadow-xl active:!bg-primary-700 focus:!ring-0 focus:!outline-none ${shouldPopLoginButton ? 'auth-login-toggle-pop' : ''}`}
          onClick={openPanel}
          onAnimationEnd={() => {
            if (shouldPopLoginButton) {
              setShouldPopLoginButton(false);
            }
          }}
          aria-label="Open login panel"
        >
          Click here to login
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Sliding Login Panel */}
      <div
        className={`auth-panel fixed top-0 h-[100dvh] w-full max-w-[420px] bg-white shadow-2xl z-10 overflow-y-auto transition-all duration-400 ease-out ${isPanelOpen && activeView === 'login' ? 'right-0' : '-right-full'}`}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        <div className="h-full flex flex-col px-5 sm:px-6 md:px-8 py-6 sm:py-8">
          {/* X Close Button */}
          <button
            onClick={closePanel}
            className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full transition-colors z-20"
            aria-label="Close login panel"
          >
            <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 flex flex-col">
            {/* Auth branding */}
            {!isVerificationView && (
              <div className="text-center mb-3 sm:mb-4 pt-4 sm:pt-6" style={{ gap: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src="/MDSystem.png"
                  alt="MDSystem Logo"
                  className="h-16 w-16 sm:h-20 sm:w-20 mx-auto"
                />
                <div style={{ marginTop: '4px' }}>
                  <h1 className="text-2xl sm:text-2xl font-bold text-secondary-900 font-heading" style={{ lineHeight: 1.3, margin: 0 }}>
                    Patient Portal
                  </h1>
                  <p className="text-sm text-neutral-600" style={{ lineHeight: 1.3, margin: '3px 0 0 0' }}>
                    Sign in to your patient account
                  </p>
                </div>
              </div>
            )}

            {/* Centered Login Form */}
            <div className="flex-1">
              <Login onVerificationViewChange={setIsVerificationView} />
            </div>
            
            {/* Register Link - Show only on main login form */}
            {!isVerificationView && (
              <div className="mt-6 pt-4 pb-[max(env(safe-area-inset-bottom),20px)] border-t border-neutral-200 flex items-center justify-center gap-1.5 text-center">
                <span className="text-sm sm:text-xs text-neutral-500">
                  Don't have an account?
                </span>
                <button
                  onClick={() => handleViewChange('register')}
                  className="text-primary-500 font-semibold text-sm sm:text-xs hover:text-primary-600 transition-colors"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Centered Register Modal */}
      {activeView === 'register' && (
        <div className="fixed inset-0 flex items-center justify-center z-20 px-2 md:px-4 py-2 md:py-8 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleViewChange('login')}
          />
          
          {/* Modal Card */}
          <div className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden md:overflow-y-auto md:max-h-[90vh]">
            <div className="px-4 md:px-6 lg:px-8 pt-3 pb-4 md:py-5 flex flex-col">
              {/* Close Button */}
              <button
                onClick={() => handleViewChange('login')}
                className="absolute top-3 right-3 md:top-4 md:right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors z-30"
                aria-label="Close register modal"
              >
                <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              {registerStep === 1 && (
                <div className="text-center mb-2 md:mb-4">
                  <img
                    src="/MDSystem.png"
                    alt="MDSystem Logo"
                    className="h-11 w-11 md:h-14 md:w-14 mx-auto mb-2"
                  />
                  <h2 className="text-xl md:text-2xl font-bold text-secondary-900 font-heading mb-0.5">
                    Create Account
                  </h2>
                  <p className="text-xs md:text-sm text-neutral-600">
                    Join our healthcare platform
                  </p>
                </div>
              )}

              {/* Register Component */}
              <div className={`flex-1 min-h-0 md:flex-none ${registerStep === 1 ? '' : 'pt-8 md:pt-0'}`}>
                <Register onBackToLogin={() => {
                  handleViewChange('login');
                  openPanel();
                }} onStepChange={setRegisterStep} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
