import { useState, useEffect } from 'react';
import Login from '../modules/auth/login';
import AuthSlides from '../modules/auth/auth-slides.jsx';

const Auth = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
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

      {/* Toggle Button - Shows only when login panel is closed */}
      {!isPanelOpen && (
        <button 
          className="toggle-btn fixed top-6 right-6 px-6 py-3 bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold rounded-full shadow-lg cursor-pointer flex items-center gap-2 z-[12] transition-all duration-300 hover:shadow-xl hover:scale-105"
          onClick={togglePanel}
          aria-label="Open login panel"
        >
          Click here to login
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Sliding Login Panel */}
      <div className={`auth-panel fixed top-0 h-screen w-full max-w-[420px] bg-white dark:bg-dark-bg-primary shadow-2xl z-10 overflow-y-auto transition-all duration-400 ease-out ${isPanelOpen ? 'right-0' : '-right-full'}`}>
        <div className="h-full flex flex-col px-8 md:px-6 sm:px-5 py-8 md:py-6">
          {/* X Close Button */}
          <button
            onClick={closePanel}
            className="absolute top-6 right-6 p-2 hover:bg-neutral-100 dark:hover:bg-dark-bg-secondary rounded-full transition-colors z-20"
            aria-label="Close login panel"
          >
            <svg className="w-6 h-6 text-secondary-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 flex flex-col">
            {/* Welcome Header */}
            <div className="text-center mb-6 pt-8">
              <img 
                src="/MDSystem.png" 
                alt="MDSystem Logo" 
                className="h-24 w-24 mx-auto mb-4"
              />
              <h1 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary font-heading mb-1">
                Staff Portal
              </h1>
              <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                Sign in to your staff account
              </p>
            </div>

            {/* Centered Login Form */}
            <div className="flex-1">
              <Login />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
