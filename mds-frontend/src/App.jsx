import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './routes/private-route.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Auth from './pages/Auth.jsx';
import { BannerProvider, useBanner } from './context/banner-context.jsx';
import Banner from './components/banner/banner.jsx';
import ResetPassword from './modules/auth/resetpassword.jsx';

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
