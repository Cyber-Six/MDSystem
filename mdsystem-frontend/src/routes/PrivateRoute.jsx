import { Navigate } from 'react-router-dom';
import { TokenStorage, refreshAccessToken } from '../services/refreshTokenService';
import { useState, useEffect } from 'react';

/**
 * PrivateRoute Component
 * SECURITY: Validates authentication by checking refresh token validity
 * If refresh token is valid, attempts to refresh access token
 * If authentication fails, redirects to /auth
 */
const PrivateRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // SECURITY: Check if both tokens exist
      const accessToken = TokenStorage.getAccessToken();
      const refreshToken = TokenStorage.getRefreshToken();

      if (!accessToken || !refreshToken) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      // SECURITY: Validate refresh token format (userId:deviceId:rawToken)
      const parts = refreshToken.split(':');
      if (parts.length !== 3) {
        TokenStorage.clearTokens();
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      // SECURITY: Attempt to refresh access token to verify validity
      try {
        await refreshAccessToken();
        setIsAuthenticated(true);
      } catch (error) {
        // Refresh failed - tokens are invalid or expired
        TokenStorage.clearTokens();
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, []);

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontSize: '1.2rem',
        color: '#6b7280'
      }}>
        Verifying authentication...
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

export default PrivateRoute;
