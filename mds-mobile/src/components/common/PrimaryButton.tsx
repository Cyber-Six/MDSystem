import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../context/ThemeContext';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = true,
  className,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`rounded-full py-4 items-center justify-center min-h-[52px] ${fullWidth ? 'w-full' : 'px-8'} ${isDisabled ? 'bg-neutral-200 dark:bg-secondary-700' : 'bg-primary-500 active:bg-primary-600'} ${className || ''}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.secondary[900]} />
      ) : (
        <Text className={`text-[15px] font-semibold ${isDisabled ? 'text-secondary-400 dark:text-secondary-500' : 'text-secondary-900'}`}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};
