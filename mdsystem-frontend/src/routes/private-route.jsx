import { Navigate } from 'react-router-dom';
import { TokenStorage, refreshAccessToken } from '../services/refreshTokenService';
import { useState, useEffect } from 'react';

/**
 * PrivateRoute Component
 * SECURITY: Validates authentication by checking refresh token validity
 * If refresh token is valid, attempts to refresh access token
 * If authentication fails, redirects to /auth
 * 
 * DEV MODE: Set VITE_BYPASS_AUTH=true in .env.local to bypass authentication
 */
const PrivateRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      // DEV MODE: Bypass authentication if environment variable is set
      if (import.meta.env.VITE_BYPASS_AUTH === 'true') {
        console.warn('⚠️ DEV MODE: Authentication bypassed. Remove VITE_BYPASS_AUTH in production!');
        setIsAuthenticated(true);
        setIsChecking(false);
        return;
      }

      // SECURITY: Check if both tokens exist
      const accessToken = TokenStorage.getAccessToken();
      const refreshToken = TokenStorage.getRefreshToken();

      if (!accessToken || !refreshToken) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      // SECURITY: Validate token format
      if (!TokenStorage.validateToken(accessToken) || !TokenStorage.validateToken(refreshToken)) {
        TokenStorage.clearTokens();
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

      // Tokens exist and are valid format - user is authenticated
      // The axios interceptor will handle refreshing if access token is expired
      setIsAuthenticated(true);
      setIsChecking(false);
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

  return isAuthenticated ? children : <Navigate to="/auth/login" replace />;
};

export default PrivateRoute;
