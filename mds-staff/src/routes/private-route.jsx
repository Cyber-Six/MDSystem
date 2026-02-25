import { Navigate } from 'react-router-dom';
import { TokenStorage, refreshAccessToken, isAccessTokenExpired } from '../packages-core-adapter.js';
import { useState, useEffect } from 'react';

const PrivateRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const checkAuth = async () => {
      // DEV MODE: Set VITE_BYPASS_PRIVATE_ROUTE_AUTH=true in .env.local to bypass authentication
      if (import.meta.env.VITE_BYPASS_PRIVATE_ROUTE_AUTH === 'true') {
        console.warn('⚠️ DEV MODE: Authentication bypassed. Remove VITE_BYPASS_PRIVATE_ROUTE_AUTH in production!');
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

      // Check if access token is still valid (not expired)
      const expired = await isAccessTokenExpired(60); // 60s buffer before actual expiry

      if (!expired) {
        // Access token is still valid — no need to hit the refresh endpoint
        setIsAuthenticated(true);
        setIsChecking(false);
        return;
      }

      // Access token expired or about to expire — attempt refresh
      try {
        await refreshAccessToken();
        setIsAuthenticated(true);
      } catch (error) {
        console.warn('[PrivateRoute] Session expired — refresh failed:', error.message);
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

  return isAuthenticated ? children : <Navigate to="/auth/login" replace />;
};

export default PrivateRoute;
