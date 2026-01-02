/**
 * MDSystem Mobile App
 * 
 * React Native app with NativeWind styling, dark mode support,
 * and shared business logic from @mdsystem/core
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/auth';
import { DashboardScreen } from './src/screens/dashboard/DashboardScreen';
import { bannerService } from './src/core';

interface Banner {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  statusCode?: number;
}

// Banner display component
const BannerOverlay: React.FC = () => {
  const { isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    const unsubscribe = bannerService.subscribe(setBanners);
    return () => unsubscribe();
  }, []);

  if (banners.length === 0) return null;

  return (
    <View className="absolute top-12 left-4 right-4 z-50">
      {banners.map((banner) => (
        <View 
          key={banner.id} 
          className={`p-4 rounded-lg mb-2 shadow-lg ${
            banner.type === 'success' 
              ? 'bg-success-500' 
              : banner.type === 'error' 
                ? 'bg-error-500' 
                : 'bg-accent-500'
          }`}
        >
          <Text className="text-white text-sm font-medium text-center">
            {banner.message}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Loading screen
const LoadingScreen: React.FC = () => {
  const { isDark } = useTheme();
  
  return (
    <View className={`flex-1 items-center justify-center ${
      isDark ? 'bg-neutral-900' : 'bg-white'
    }`}>
      <View className="w-20 h-20 bg-primary-500 rounded-2xl items-center justify-center mb-4">
        <Text className="text-4xl">🏥</Text>
      </View>
      <ActivityIndicator size="large" color="#F1C526" />
      <Text className={`mt-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
        Loading...
      </Text>
    </View>
  );
};

// Main app content with navigation
const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
      {isAuthenticated ? (
        <DashboardScreen onLogout={checkAuth} />
      ) : (
        <AuthScreen onAuthSuccess={checkAuth} />
      )}
      <BannerOverlay />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
};

// Root app component with providers
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
