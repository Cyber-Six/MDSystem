import React from 'react';
import { Text, View } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const BADGE_STYLES: Record<BadgeVariant, { container: string; text: string }> = {
  success: {
    container: 'bg-success-100 dark:bg-success-700',
    text: 'text-success-700 dark:text-success-100',
  },
  warning: {
    container: 'bg-primary-100 dark:bg-primary-800',
    text: 'text-primary-800 dark:text-primary-100',
  },
  error: {
    container: 'bg-error-100 dark:bg-error-700',
    text: 'text-error-700 dark:text-error-100',
  },
  info: {
    container: 'bg-accent-100 dark:bg-accent-700',
    text: 'text-accent-700 dark:text-accent-100',
  },
  neutral: {
    container: 'bg-neutral-100 dark:bg-secondary-700',
    text: 'text-secondary-600 dark:text-secondary-300',
  },
};

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const style = BADGE_STYLES[variant];

  return (
    <View className={`px-2 py-0.5 rounded-full self-start ${style.container}`}>
      <Text className={`text-[11px] font-semibold ${style.text}`}>{label}</Text>
    </View>
  );
};
