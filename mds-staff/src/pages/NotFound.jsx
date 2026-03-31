import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stethoscope, Home, ArrowLeft, FileX2 } from 'lucide-react';

const COUNTDOWN_SECONDS = 5;

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef(null);

  // Hardcoded safe redirect — never derived from URL params
  const safeRedirect = '/';

  const goHome = useCallback(() => {
    navigate(safeRedirect, { replace: true });
  }, [navigate]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  // Redirect when countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      goHome();
    }
  }, [countdown, goHome]);

  // Sanitize the displayed path — strip query strings and fragments,
  // encode HTML entities to prevent any reflected content issues.
  const displayPath = location.pathname
    .replace(/[<>"'&]/g, '')
    .slice(0, 80);

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <div className="text-center max-w-lg w-full">

        {/* Floating medical crosses — decorative */}
        <div className="relative h-10 mb-2" aria-hidden="true">
          <span
            className="absolute left-[15%] text-primary-400/50 dark:text-primary-500/40 text-xl font-bold select-none"
            style={{ animation: 'notfound-float 2.6s ease-in-out infinite 0s' }}
          >+</span>
          <span
            className="absolute left-[40%] text-primary-300/40 dark:text-primary-600/30 text-sm font-bold select-none"
            style={{ animation: 'notfound-float 3.2s ease-in-out infinite 0.4s' }}
          >+</span>
          <span
            className="absolute left-[72%] text-primary-400/50 dark:text-primary-500/40 text-lg font-bold select-none"
            style={{ animation: 'notfound-float 2.9s ease-in-out infinite 0.9s' }}
          >+</span>
          <span
            className="absolute left-[85%] text-primary-300/30 dark:text-primary-600/20 text-xs font-bold select-none"
            style={{ animation: 'notfound-float 3.5s ease-in-out infinite 0.2s' }}
          >+</span>
        </div>

        {/* Main animated icon — stethoscope inside MDS-branded circle */}
        <div className="relative mx-auto w-32 h-32 mb-5">
          {/* Outer pulsing ring — primary yellow */}
          <div className="absolute inset-0 rounded-full bg-primary-300/20 dark:bg-primary-400/10 animate-ping opacity-40" />
          {/* Mid ring */}
          <div className="absolute inset-2 rounded-full bg-primary-100/60 dark:bg-primary-900/20 animate-pulse" />
          {/* Icon container */}
          <div
            className="relative flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 dark:from-secondary-800 dark:to-secondary-700 border-2 border-primary-400/60 dark:border-primary-500/40 shadow-lg"
            style={{ animation: 'notfound-sway 3s ease-in-out infinite' }}
          >
            {/* Medical cross badge */}
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center shadow">
              <span className="text-white dark:text-secondary-900 text-sm font-extrabold leading-none">+</span>
            </div>
            <Stethoscope className="w-14 h-14 text-secondary-700 dark:text-secondary-200" strokeWidth={1.5} />
          </div>
        </div>

        {/* 404 with heartbeat line decoration */}
        <div className="relative inline-block mb-1">
          <h1
            className="text-8xl font-black text-secondary-800 dark:text-secondary-100 tracking-tighter"
            style={{ animation: 'notfound-float 4s ease-in-out infinite' }}
          >
            404
          </h1>
          {/* Heartbeat underline SVG */}
          <svg
            viewBox="0 0 160 18" className="w-40 mx-auto -mt-1" aria-hidden="true"
            style={{ animation: 'notfound-float 4s ease-in-out infinite' }}
          >
            <polyline
              points="0,9 28,9 36,2 42,16 48,9 56,9 64,2 70,16 76,9 160,9"
              fill="none"
              stroke="#FFD940"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-secondary-700 dark:text-secondary-200 mb-2 mt-1">
          Page Not Found
        </h2>

        <p className="text-secondary-500 dark:text-secondary-400 mb-3 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Show attempted path */}
        {displayPath && displayPath !== '/' && (
          <div className="inline-flex items-center gap-1.5 bg-secondary-100 dark:bg-secondary-800 rounded-lg px-3 py-1.5 mb-5">
            <FileX2 className="w-3.5 h-3.5 text-secondary-400 flex-shrink-0" />
            <code className="text-xs text-secondary-500 dark:text-secondary-400 break-all">
              {displayPath}
            </code>
          </div>
        )}

        {/* Countdown — translucent yellow circle with number */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div
            className="w-16 h-16 rounded-full border-4 border-primary-400/40 dark:border-primary-400/30 bg-primary-50/40 dark:bg-primary-900/10 flex items-center justify-center"
            style={{ animation: 'notfound-sway 2s ease-in-out infinite' }}
          >
            <span className="text-2xl font-black text-primary-600 dark:text-primary-400 tabular-nums">
              {countdown}
            </span>
          </div>
          <span className="text-sm text-secondary-500 dark:text-secondary-400">
            Redirecting to dashboard...
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-200 bg-secondary-100 dark:bg-secondary-800 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={goHome}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-600 rounded-lg transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Bottom floating medical crosses */}
        <div className="relative mt-8 h-8" aria-hidden="true">
          <span
            className="absolute left-[10%] text-primary-400/40 dark:text-primary-500/30 text-base font-bold select-none"
            style={{ animation: 'notfound-float 3s ease-in-out infinite 0.1s' }}
          >+</span>
          <span
            className="absolute left-[50%] text-primary-300/30 dark:text-primary-600/20 text-xs font-bold select-none"
            style={{ animation: 'notfound-float 2.7s ease-in-out infinite 0.6s' }}
          >+</span>
          <span
            className="absolute left-[80%] text-primary-400/40 dark:text-primary-500/30 text-sm font-bold select-none"
            style={{ animation: 'notfound-float 3.3s ease-in-out infinite 1s' }}
          >+</span>
        </div>
      </div>

      {/* CSS keyframe animations */}
      <style>{`
        @keyframes notfound-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes notfound-sway {
          0%, 100% { transform: scale(1) rotate(-1deg); }
          50% { transform: scale(1.04) rotate(1deg); }
        }
      `}</style>
    </div>
  );
};

export default NotFound;
