import { useState, useEffect, useRef } from 'react';
import Login from '../modules/auth/login';
import AuthSlides from '../modules/auth/auth-slides.jsx';

const Auth = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [shouldPopLoginButton, setShouldPopLoginButton] = useState(false);
  const [isVerificationView, setIsVerificationView] = useState(false);
  const buttonRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Blur button when panel closes to remove focus styling
  useEffect(() => {
    if (!isPanelOpen && !isPanelClosing && buttonRef.current) {
      buttonRef.current.blur();
    }
  }, [isPanelOpen, isPanelClosing]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

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

    setShouldPopLoginButton(false);
    setIsPanelClosing(true);
    setIsPanelOpen(false);

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

    if (!isPanelOpen && isPanelClosing) {
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
      <AuthSlides isPanelOpen={isPanelOpen} activeView="login" />

      {/* Toggle Button - Appears after the login panel fully closes */}
      {!isPanelOpen && !isPanelClosing && (
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
        className={`auth-panel fixed top-0 h-[100dvh] w-full max-w-[420px] bg-white shadow-2xl z-10 overflow-y-auto transition-all duration-400 ease-out ${isPanelOpen ? 'right-0' : '-right-full'}`}
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
                  className="h-14 w-14 sm:h-20 sm:w-20 mx-auto"
                />
                <div style={{ marginTop: '4px' }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-secondary-900 font-heading" style={{ lineHeight: 1.3, margin: 0 }}>
                    Staff Portal
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-600" style={{ lineHeight: 1.3, margin: '3px 0 0 0' }}>
                    Sign in to your staff account
                  </p>
                </div>
              </div>
            )}

            {/* Centered Login Form */}
            <div className="flex-1">
              <Login onVerificationViewChange={setIsVerificationView} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
