/**
 * Auth Context - Manages authentication state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TokenStorage, registerSessionExpiredCallback } from '../core';
import { clearProfileCache } from '../services/profile-service';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  setAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        Promise.resolve(TokenStorage.getAccessToken?.()),
        Promise.resolve(TokenStorage.getRefreshToken?.()),
      ]);

      if (!accessToken || !refreshToken) {
        await Promise.resolve(TokenStorage.clearTokens?.());
        setIsAuthenticated(false);
        return;
      }

      const isAccessValid =
        typeof TokenStorage.validateToken === 'function'
          ? TokenStorage.validateToken(accessToken)
          : true;
      const isRefreshValid =
        typeof TokenStorage.validateRefreshToken === 'function'
          ? TokenStorage.validateRefreshToken(refreshToken)
          : true;

      if (!isAccessValid || !isRefreshValid) {
        await Promise.resolve(TokenStorage.clearTokens?.());
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
    } catch (error) {
      try {
        await Promise.resolve(TokenStorage.clearTokens?.());
      } catch {
        // Ignore token cleanup failures during bootstrap.
      }
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Force logout when token service detects an expired/invalid refresh session
  useEffect(() => {
    registerSessionExpiredCallback(() => {
      clearProfileCache();
      setIsAuthenticated(false);
    });
  }, []);

  const setAuthenticated = (value: boolean) => {
    if (!value) {
      clearProfileCache();
    }
    setIsAuthenticated(value);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, checkAuth, setAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
