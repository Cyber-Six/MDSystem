import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './routes/private-route.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Auth from './pages/Auth.jsx';
import { BannerProvider, useBanner } from './context/banner-context.jsx';
import Banner from './components/banner/banner.jsx';
import ResetPassword from './modules/auth/resetpassword.jsx';
import InitialMedicalRecordForm from './modules/record-forms/initial-record/medical/initial-medical-record-form.jsx';

// Lazy load Staff Module for better performance
const StaffModule = lazy(() => import('./modules/staff/index.jsx'));

// Loading fallback for staff module
const StaffLoader = () => (
  <div className="flex items-center justify-center h-screen bg-neutral-100 dark:bg-neutral-900">
    <div className="flex items-center gap-2 text-secondary-500 dark:text-neutral-400">
      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading Staff Portal...</span>
    </div>
  </div>
);

function AppContent() {
  const { showBanner } = useBanner();

  // Banner callback is now automatically handled by core.js
  // No need to set it up here anymore

  return (
    <>
      <Banner />

      <Router>
        <Routes>
            <Route 
            path="/auth/password/reset-password/:verificationKey" 
            element={<ResetPassword />} 
            />
          
          {/* Staff/Doctor Portal - Auth bypassed for development */}
          <Route 
            path="/staff/*" 
            element={
              <Suspense fallback={<StaffLoader />}>
                <StaffModule />
              </Suspense>
            } 
          />

          {/* Root route - Dashboard with authentication check */}
          <Route 
            path="/*" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />

          {/* Auth routes - Login/Register */}
          <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/register" element={<Auth />} />
          
          {/* Initial Medical Record */}
          <Route 
            path="/initial-medical-record" 
            element={
              <PrivateRoute>
                <InitialMedicalRecordForm />
              </PrivateRoute>
            } 
          />

          {/* Redirect any unknown routes to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
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
