import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface BannerProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  statusCode?: number;
  onDismiss: (id: string) => void;
}

export const Banner: React.FC<BannerProps> = ({ id, type, message, statusCode, onDismiss }) => {
  const getBannerClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-success-100 border-success-500';
      case 'error':
        return 'bg-error-100 border-error-500';
      case 'warning':
        return 'bg-warning-100 border-warning-500';
      case 'info':
      default:
        return 'bg-accent-100 border-accent-500';
    }
  };

  const getTextClasses = () => {
    switch (type) {
      case 'success':
        return 'text-success-800';
      case 'error':
        return 'text-error-800';
      case 'warning':
        return 'text-warning-800';
      case 'info':
      default:
        return 'text-accent-800';
    }
  };

  return (
    <View className={`mx-4 my-2 p-4 rounded-lg border-l-4 flex-row items-center justify-between ${getBannerClasses()}`}>
      <View className="flex-1 mr-3">
        <Text className={`text-base font-medium ${getTextClasses()}`}>
          {message}
        </Text>
        {statusCode && (
          <Text className={`text-sm mt-1 ${getTextClasses()} opacity-70`}>
            Status Code: {statusCode}
          </Text>
        )}
      </View>
      <TouchableOpacity 
        onPress={() => onDismiss(id)}
        className="p-2"
        accessibilityLabel="Dismiss banner"
        accessibilityRole="button"
      >
        <Text className={`text-lg font-bold ${getTextClasses()}`}>×</Text>
      </TouchableOpacity>
    </View>
  );
};

