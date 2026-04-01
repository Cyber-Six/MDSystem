import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PrivateRoute from './routes/private-route';
import { BannerProvider } from './context/banner-context';
import { SettingsProvider } from './context/settings-context';
import Banner from './components/banner/banner';
import ErrorBoundary from './components/error-boundary';
import { PatientNotificationProvider } from './modules/notification/notification-context';

// Lazy-loaded pages for code splitting
const Auth = lazy(() => import('./pages/Auth.jsx'));
const ResetPassword = lazy(() => import('./modules/auth/resetpassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <BannerProvider>
          <Banner />
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route
                  path="/auth/password/reset-password/:verificationKey"
                  element={<ResetPassword />}
                />
                <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
                <Route path="/auth/login" element={<Auth />} />
                <Route path="/auth/register" element={<Auth />} />
                <Route
                  path="/initial-medical-record"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/*"
                  element={
                    <PrivateRoute>
                      <PatientNotificationProvider>
                        <Dashboard />
                      </PatientNotificationProvider>
                    </PrivateRoute>
                  }
                />
              </Routes>
            </Suspense>
          </Router>
        </BannerProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
