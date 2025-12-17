import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Login from '../modules/auth/Login';
import Register from '../modules/auth/Register';

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
      {/* Fullscreen Landing Content */}
      <div 
        className="fixed top-0 left-0 w-full h-screen z-[1]"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
        }}
      >
        <div 
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)'
          }}
        >
          <div className="h-full flex items-center justify-center px-8 py-8">
            <div className="max-w-2xl text-center">
              <div className="inline-block px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-full text-primary-300 text-sm font-semibold mb-6">
                🏥 MDSystem
              </div>
              <h1 className="text-5xl lg:text-4xl md:text-3xl font-bold text-white mb-4 leading-tight font-heading">
                Healthcare Management System
              </h1>
              <p className="text-lg md:text-base text-neutral-300 mb-12 leading-relaxed">
                Comprehensive platform for healthcare management with enterprise-grade security.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-4 mt-12">
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
                  <span className="text-3xl block mb-3">🔒</span>
                  <h3 className="text-base font-semibold text-white mb-2">Secure & Private</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">Your data is protected with enterprise-grade security</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
                  <span className="text-3xl block mb-3">📱</span>
                  <h3 className="text-base font-semibold text-white mb-2">Accessible</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">Access from any device, anywhere</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
                  <span className="text-3xl block mb-3">⚡</span>
                  <h3 className="text-base font-semibold text-white mb-2">Fast & Reliable</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">High-performance system you can trust</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button - Fixed Top Right - Hidden when panel is open */}
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

      {/* Sliding Login/Register Panel */}
      <div className={`auth-panel fixed top-0 h-screen w-full max-w-[420px] bg-white dark:bg-dark-bg-primary shadow-2xl z-10 overflow-y-auto transition-all duration-400 ease-out ${isPanelOpen ? 'right-0' : '-right-full'}`}>
        <div className="h-full flex flex-col px-8 md:px-6 sm:px-5 py-8 md:py-6">
          {activeView === 'login' ? (
            <div className="flex-1 flex flex-col">
              {/* Welcome Header */}
              <div className="text-center mb-8">
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
              <div className="flex-1 flex items-center justify-center">
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
          ) : (
            <div className="w-full max-w-md mx-auto">
              <Register onBackToLogin={() => handleViewChange('login')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;