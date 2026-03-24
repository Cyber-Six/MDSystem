/**
 * MDSystem Mobile App
 * 
 * React Native app with NativeWind styling, dark mode support,
 * React Navigation bottom tabs, and shared business logic from @mdsystem/core
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, LogBox, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme, colors } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { BannerProvider } from './src/context/BannerContext';
import { RecordStatusProvider } from './src/context/RecordStatusContext';
import { HealthChatNotificationProvider } from './src/context/HealthChatNotificationProvider';
import { AuthScreen } from './src/screens/auth';
import { MainTabNavigator } from './src/navigation/MainTabNavigator';
import { Banner as BannerComponent } from './src/components/Banner';
import { bannerService, setNavigationRef } from './src/core';

interface BannerData {
  id: string | number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  statusCode?: number;
}

// SafeAreaView deprecation currently surfaces from third-party dependencies.
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

// Also suppress in terminal output (LogBox only hides the yellow box)
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('SafeAreaView has been deprecated')) return;
  originalWarn(...args);
};

// Banner display component
const BannerOverlay: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<BannerData[]>([]);

  useEffect(() => {
    const unsubscribe = bannerService.subscribe(setBanners);
    return () => unsubscribe();
  }, []);

  if (banners.length === 0) return null;

  return (
    <View style={[appStyles.bannerOverlay, { top: insets.top + 4 }]}>
      {banners.map((banner: any) => (
        <BannerComponent
          key={banner.id}
          id={String(banner.id)}
          type={banner.type}
          message={banner.message}
          statusCode={banner.statusCode}
          onDismiss={(id) => bannerService.dismissBanner(Number(id))}
        />
      ))}
    </View>
  );
};

// Loading screen
const LoadingScreen: React.FC = () => {
  const { isDark } = useTheme();
  
  return (
    <View style={[
      appStyles.loadingContainer,
      { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
    ]}>
      <View style={appStyles.loadingLogo}>
        <Text style={appStyles.loadingEmoji}>🏥</Text>
      </View>
      <ActivityIndicator size="large" color={colors.primary[500]} />
      <Text style={[
        appStyles.loadingText,
        { color: isDark ? colors.neutral[400] : colors.neutral[600] },
      ]}>
        Loading...
      </Text>
    </View>
  );
};

// Main app content with navigation
const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Wire navigation ref to core.ts for logout redirects
  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef.current);
    }
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={[
      appStyles.rootContainer,
      { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] },
    ]}>
      {isAuthenticated ? (
        <NavigationContainer ref={navigationRef}>
          <HealthChatNotificationProvider>
            <MainTabNavigator />
          </HealthChatNotificationProvider>
        </NavigationContainer>
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
          <RecordStatusProvider>
            <BannerProvider>
              <AppContent />
            </BannerProvider>
          </RecordStatusProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    backgroundColor: colors.primary[500],
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingEmoji: {
    fontSize: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
});
