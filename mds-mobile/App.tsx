import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { axiosRequest, bannerService, TokenStorage } from './src/core';
import { validatePassword } from '../packages/core/src/validation/password-validation';
import { isValidTipEmail } from '../packages/core/src/validation/email-validation';

interface Banner {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  statusCode?: number;
}

export default function App() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = bannerService.subscribe(setBanners);
    checkAuth();
    return () => unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await TokenStorage.getAccessToken();
      setIsAuthenticated(!!token);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const testPasswordValidation = () => {
    const validPassword = 'MySecurePassword123';
    const invalidPassword = 'short';
    const validResult = validatePassword(validPassword);
    const invalidResult = validatePassword(invalidPassword);
    Alert.alert(
      'Password Validation Test',
      `Valid password: ${validResult}\nInvalid password: ${invalidResult}`
    );
  };

  const testEmailValidation = () => {
    const validEmail = 'msmith@tip.edu.ph';
    const invalidEmail = 'test@gmail.com';
    Alert.alert(
      'Email Validation Test',
      `Valid TIP email: ${isValidTipEmail(validEmail)}\nInvalid email: ${isValidTipEmail(invalidEmail)}`
    );
  };

  const testApiRequest = async () => {
    try {
      const response = await axiosRequest.get('/health');
      Alert.alert('API Test', 'Connection successful!');
    } catch (error: any) {
      Alert.alert('API Test', `Error: ${error.message}`);
    }
  };

  return (
    <View className="flex-1 bg-neutral-50">
      <ScrollView className="flex-1 px-5 pt-16">
        <Text className="text-3xl font-bold text-secondary-900 text-center mb-2">
          MDSystem Mobile
        </Text>
        <Text className="text-base text-neutral-600 text-center mb-8">
          Built with @mdsystem/core & NativeWind
        </Text>

        <View className="bg-white rounded-xl p-4 mb-4 shadow-md">
          <Text className="text-lg font-semibold text-secondary-900 mb-3">
            Authentication Status
          </Text>
          <Text className="text-base text-neutral-600">
            {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
          </Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4 shadow-md">
          <Text className="text-lg font-semibold text-secondary-900 mb-3">
            Banner Notifications
          </Text>
          <Text className="text-sm text-neutral-600 mb-2">
            Active Banners: {banners.length}
          </Text>
          {banners.map((banner) => (
            <View 
              key={banner.id} 
              className={`p-3 rounded-lg mt-2 ${banner.type === 'success' ? 'bg-success-100' : banner.type === 'error' ? 'bg-error-100' : 'bg-accent-100'}`}
            >
              <Text className="text-sm text-secondary-900">{banner.message}</Text>
            </View>
          ))}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4 shadow-md">
          <Text className="text-lg font-semibold text-secondary-900 mb-3">
            Test Core Features
          </Text>
          
          <TouchableOpacity onPress={testPasswordValidation} className="bg-accent-500 py-3 px-4 rounded-lg mb-3 active:bg-accent-600">
            <Text className="text-white text-center font-semibold">Test Password Validation</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={testEmailValidation} className="bg-accent-500 py-3 px-4 rounded-lg mb-3 active:bg-accent-600">
            <Text className="text-white text-center font-semibold">Test Email Validation</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={testApiRequest} className="bg-accent-500 py-3 px-4 rounded-lg mb-3 active:bg-accent-600">
            <Text className="text-white text-center font-semibold">Test API Request</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => bannerService.showBanner({ type: 'success', message: 'This is a test banner!' })} className="bg-success-500 py-3 px-4 rounded-lg active:bg-success-600">
            <Text className="text-white text-center font-semibold">Show Test Banner</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-sm text-neutral-400 text-center mt-5 mb-10">
          TypeScript + React Native + NativeWind + Shared Business Logic!
        </Text>
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}
