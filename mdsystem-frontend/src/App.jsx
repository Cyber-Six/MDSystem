import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Auth from './pages/Auth.jsx';
import { BannerProvider, useBanner } from './context/BannerContext.jsx';
import Banner from './components/banner/Banner.jsx';
import { setBannerCallback } from './services/axiosRequestHandler.js';

function AppContent() {
  const { showBanner } = useBanner();

  // Set up banner callback for axios interceptors
  useEffect(() => {
    setBannerCallback(showBanner);
  }, [showBanner]);

  return (
    <>
      <Banner />
      <Router>
        <Routes>
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

export default App
