import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import { BannerProvider, useBanner } from './context/BannerContext.jsx';
import Banner from './components/banner/Banner.jsx';
import { setBannerCallback } from './services/axiosRequestHandler.js';

function AppContent() {
  // Simulate authentication state (replace with real auth logic)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Dashboard isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
            </PrivateRoute>
          } />
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
