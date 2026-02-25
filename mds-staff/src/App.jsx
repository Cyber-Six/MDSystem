import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './routes/private-route';
import { BannerProvider } from './context/banner-context';
import Banner from './components/banner/banner';

// Pages
import Auth from './pages/Auth.jsx';
import ResetPassword from './modules/auth/resetpassword.jsx';
import Dashboard from './pages/Dashboard.jsx';

function App() {
  return (
    <BannerProvider>
      <Banner />
      <Router>
        <Routes>
          <Route
            path="/auth/password/reset-password/:verificationKey"
            element={<ResetPassword />}
          />
          <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Auth />} />

          {/* Staff portal routes — requires auth */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </BannerProvider>
  );
}

export default App;
