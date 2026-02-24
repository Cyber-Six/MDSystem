import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '@shared/routes/private-route.jsx';
import Auth from './auth/Auth.jsx';
import { BannerProvider, useBanner } from '@shared/context/banner-context.jsx';
import Banner from '@shared/components/banner/banner.jsx';
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
  <div className="flex items-center justify-center h-screen bg-neutral-100 dark:bg-neutral-900">
    <div className="flex items-center gap-2 text-secondary-500 dark:text-neutral-400">
      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading {label}...</span>
    </div>
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
