import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

type IconType = React.ComponentType<{ size: number; color: string }>;

type EmptyStateProps = {
  icon: IconType;
  message: string;
  subMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  message,
  subMessage,
  actionLabel,
  onAction,
}) => {
  const { isDark } = useTheme();

  return (
    <View className="bg-white dark:bg-secondary-800 rounded-2xl p-6 items-center border border-neutral-200 dark:border-secondary-700 border-dashed mb-3">
      <Icon
        size={32}
        color={isDark ? colors.secondary[600] : colors.neutral[300]}
      />

      <Text className="text-[14px] font-semibold text-secondary-600 dark:text-secondary-400 text-center mt-3">
        {message}
      </Text>

      {subMessage ? (
        <Text className="text-[12px] text-secondary-400 dark:text-secondary-500 text-center mt-1 mb-4">
          {subMessage}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          className="bg-primary-500 px-6 py-2.5 rounded-full min-h-[40px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-[13px] font-semibold text-secondary-900">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default EmptyState;
