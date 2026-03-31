import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SearchX, Home, ArrowLeft, ShieldAlert } from 'lucide-react';

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

  const progressPercent = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <div className="text-center max-w-lg w-full">
        {/* Animated icon */}
        <div className="relative mx-auto w-28 h-28 mb-6">
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-warning-100 dark:bg-warning-900/30 animate-ping opacity-30" />
          {/* Static ring */}
          <div className="absolute inset-0 rounded-full bg-warning-50 dark:bg-warning-900/20 animate-pulse" />
          {/* Icon container */}
          <div
            className="relative flex items-center justify-center w-28 h-28 rounded-full bg-warning-100 dark:bg-warning-800/40 border-2 border-warning-300 dark:border-warning-600"
            style={{ animation: 'notfound-bounce 2s ease-in-out infinite' }}
          >
            <SearchX className="w-12 h-12 text-warning-600 dark:text-warning-400" strokeWidth={1.8} />
          </div>
        </div>

        {/* 404 number with float animation */}
        <h1
          className="text-7xl font-extrabold text-secondary-800 dark:text-secondary-100 tracking-tight mb-2"
          style={{ animation: 'notfound-float 3s ease-in-out infinite' }}
        >
          404
        </h1>

        <h2 className="text-xl font-semibold text-secondary-700 dark:text-secondary-200 mb-2">
          Page Not Found
        </h2>

        <p className="text-secondary-500 dark:text-secondary-400 mb-3 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Show attempted path */}
        {displayPath && displayPath !== '/' && (
          <div className="inline-flex items-center gap-1.5 bg-secondary-100 dark:bg-secondary-800 rounded-lg px-3 py-1.5 mb-5">
            <ShieldAlert className="w-3.5 h-3.5 text-secondary-400" />
            <code className="text-xs text-secondary-500 dark:text-secondary-400 break-all">
              {displayPath}
            </code>
          </div>
        )}

        {/* Countdown timer */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="relative w-10 h-10">
              {/* Countdown circle */}
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                <circle
                  cx="20" cy="20" r="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-secondary-200 dark:text-secondary-700"
                />
                <circle
                  cx="20" cy="20" r="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="text-accent-500 dark:text-accent-400"
                  strokeDasharray={`${2 * Math.PI * 17}`}
                  strokeDashoffset={`${2 * Math.PI * 17 * (1 - progressPercent / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-accent-600 dark:text-accent-400">
                {countdown}
              </span>
            </div>
            <span className="text-sm text-secondary-500 dark:text-secondary-400">
              Redirecting to dashboard...
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs mx-auto h-1.5 bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-400 to-accent-600 rounded-full"
              style={{
                width: `${progressPercent}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>
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

        {/* Decorative floating dots */}
        <div className="relative mt-8 h-6" aria-hidden="true">
          <span
            className="absolute left-1/4 w-2 h-2 rounded-full bg-primary-400/60"
            style={{ animation: 'notfound-float 2.5s ease-in-out infinite 0.2s' }}
          />
          <span
            className="absolute left-1/2 w-1.5 h-1.5 rounded-full bg-accent-400/60"
            style={{ animation: 'notfound-float 3s ease-in-out infinite 0.8s' }}
          />
          <span
            className="absolute left-3/4 w-2 h-2 rounded-full bg-warning-400/60"
            style={{ animation: 'notfound-float 2.8s ease-in-out infinite 0.5s' }}
          />
        </div>
      </div>

      {/* CSS keyframe animations */}
      <style>{`
        @keyframes notfound-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes notfound-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default NotFound;
