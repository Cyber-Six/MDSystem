/**
 * Auth Screen Container
 * Handles navigation between Login and Register
 */

import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';

type AuthView = 'login' | 'register';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { isDark } = useTheme();
  const [currentView, setCurrentView] = useState<AuthView>('login');

  return (
    <SafeAreaView 
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.neutral[900] : '#FFFFFF' }
      ]}
    >
      {currentView === 'login' ? (
        <LoginScreen
          onNavigateToRegister={() => setCurrentView('register')}
          onLoginSuccess={onAuthSuccess}
        />
      ) : (
        <RegisterScreen
          onNavigateToLogin={() => setCurrentView('login')}
          onRegisterSuccess={onAuthSuccess}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AuthScreen;
