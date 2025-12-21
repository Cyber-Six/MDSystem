import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Login from '../modules/auth/login';
import Register from '../modules/auth/register';
import AuthSlides from '../modules/auth/auth-slides';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine view from URL path instead of query params
  const getViewFromPath = () => {
    if (location.pathname === '/auth/register') return 'register';
    return 'login';
  };
  
  const [activeView, setActiveView] = useState(getViewFromPath());
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Update activeView when path changes
  useEffect(() => {
    setActiveView(getViewFromPath());
  }, [location.pathname]);

  const handleViewChange = (view) => {
    setActiveView(view);
    navigate(`/auth/${view}`, { replace: true });
  };

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
      <AuthSlides isPanelOpen={isPanelOpen} activeView={activeView} />

      {/* Toggle Button - Shows only when login panel is closed */}
      {!isPanelOpen && activeView === 'login' && (
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
      <div className={`auth-panel fixed top-0 h-screen w-full max-w-[420px] bg-white dark:bg-dark-bg-primary shadow-2xl z-10 overflow-y-auto transition-all duration-400 ease-out ${isPanelOpen && activeView === 'login' ? 'right-0' : '-right-full'}`}>
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
                Welcome Back
              </h1>
              <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                Sign in to your account to continue
              </p>
            </div>

            {/* Centered Login Form */}
            <div className="flex-1">
              <Login />
            </div>
            
            {/* Register Link */}
            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-dark-border-primary text-center">
              <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mb-2">
                Don't have an account?
              </p>
              <button 
                onClick={() => handleViewChange('register')}
                className="text-accent-600 dark:text-accent-400 font-semibold text-xs hover:text-accent-700 dark:hover:text-accent-300 transition-colors hover:underline"
              >
                Sign up!
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Centered Register Modal */}
      {activeView === 'register' && (
        <div className="fixed inset-0 flex items-center justify-center z-20 px-4 py-8">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleViewChange('login')}
          />
          
          {/* Modal Card */}
          <div className="relative w-full max-w-md bg-white dark:bg-dark-bg-primary rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="px-8 md:px-6 sm:px-5 py-8 md:py-6">
              {/* Close Button */}
              <button
                onClick={() => handleViewChange('login')}
                className="absolute top-4 right-4 p-2 hover:bg-neutral-100 dark:hover:bg-dark-bg-secondary rounded-full transition-colors z-30"
                aria-label="Close register modal"
              >
                <svg className="w-6 h-6 text-secondary-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="text-center mb-8">
                <img 
                  src="/MDSystem.png" 
                  alt="MDSystem Logo" 
                  className="h-20 w-20 mx-auto mb-4"
                />
                <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-text-primary font-heading mb-1">
                  Create Account
                </h2>
                <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Join our healthcare platform
                </p>
              </div>

              {/* Register Component */}
              <Register onBackToLogin={() => {
                handleViewChange('login');
                setIsPanelOpen(true);
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;  