import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '@core/routes/private-route.jsx';
import Auth from './auth/Auth.jsx';
import { BannerProvider, useBanner } from '@core/context/banner-context.jsx';
import Banner from '@core/components/banner/banner.jsx';
import ResetPassword from './auth/resetpassword.jsx';
import { detectRoleFromHostname } from '@mdsystem/core/utils/role-detection';

// ── Portal preloading ────────────────────────────────────────────────────────
// Detect which portal is active at module parse time (same logic as RoleProvider)
// and start downloading its chunk immediately — before any auth check or route match.
// The other portal's chunk is never downloaded on this subdomain.
const _hostname = window.location.hostname;
const _devPortal = import.meta.env.VITE_DEV_PORTAL || 'www';
const _effectiveHostname =
  _hostname === 'localhost' || _hostname === '127.0.0.1'
    ? `${_devPortal}.mdsystemtip.space`
    : _hostname;
const _isStaffPortal = detectRoleFromHostname(_effectiveHostname) === 'medical';

// Fire the relevant fetch now; lazy() receives an already-in-flight Promise
const _staffChunk   = _isStaffPortal  ? import('./staff/StaffApp.jsx')     : null;
const _patientChunk = !_isStaffPortal ? import('./patient/PatientApp.jsx') : null;

const StaffApp   = lazy(() => _staffChunk   ?? import('./staff/StaffApp.jsx'));
const PatientApp = lazy(() => _patientChunk ?? import('./patient/PatientApp.jsx'));

// Loading fallback for lazy-loaded portals
const PortalLoader = ({ label }) => (
  <div className="flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-900">
    <div className="flex flex-col items-center gap-8">

      {/* Staggered bar loader */}
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              animation: 'loader-bar 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
            className="w-1 rounded-full bg-primary-500"
          />
        ))}
      </div>

      {/* Label + shimmer line */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-400 dark:text-neutral-500">
          {label}
        </span>
        <div className="relative h-px w-40 bg-neutral-200 dark:bg-neutral-700 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 w-20 rounded-full bg-gradient-to-r from-transparent via-primary-400 to-transparent"
            style={{ animation: 'loader-shimmer 1.6s ease-in-out infinite' }}
          />
        </div>
      </div>

    </div>

    <style>{`
      @keyframes loader-bar {
        0%, 100% { height: 8px; opacity: 0.35; }
        50%       { height: 28px; opacity: 1; }
      }
      @keyframes loader-shimmer {
        0%   { transform: translateX(-80px); }
        100% { transform: translateX(160px); }
      }
    `}</style>
  </div>
);

function AppContent() {
  const { showBanner } = useBanner();

  return (
    <>
      <Banner />

      <Router>
        <Routes>
          <Route 
            path="/auth/password/reset-password/:verificationKey" 
            element={<ResetPassword />} 
          />

          {/* Auth routes - Login/Register */}
          <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/register" element={<Auth />} />

          {/* Initial Medical Record - redirects to dashboard where modal appears */}
          <Route 
            path="/initial-medical-record" 
            element={<Navigate to="/" replace />}
          />

          {/* Portal routing — determined by subdomain, not URL path */}
          {_isStaffPortal ? (
            <Route
              path="/*"
              element={
                import.meta.env.VITE_BYPASS_STAFF_AUTH === 'true' ? (
                  <Suspense fallback={<PortalLoader label="Staff Portal" />}>
                    <StaffApp />
                  </Suspense>
                ) : (
                  <PrivateRoute>
                    <Suspense fallback={<PortalLoader label="Staff Portal" />}>
                      <StaffApp />
                    </Suspense>
                  </PrivateRoute>
                )
              }
            />
          ) : (
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Suspense fallback={<PortalLoader label="Patient Portal" />}>
                    <PatientApp />
                  </Suspense>
                </PrivateRoute>
              }
            />
          )}
        </Routes>
      </Router>
    </>
  );
}

function App() {
  return (
    <BannerProvider>
      <AppContent />
    </BannerProvider>
  );
}

export default App;
