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
      const token = await TokenStorage.getAccessToken();
      setIsAuthenticated(!!token);
    } catch (error) {
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
