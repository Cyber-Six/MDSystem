import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Skeleton } from './Skeleton';
import { BadgeVariant } from './Badge';
import { colors } from '../../context/ThemeContext';
import { useTheme } from '../../context/ThemeContext';

type IconType = React.ComponentType<{ size: number; color: string }>;

type BadgeConfig = {
  label: string;
  variant: BadgeVariant;
};

const BADGE_BG: Record<BadgeVariant, string> = {
  success: 'bg-success-100 dark:bg-success-700',
  warning: 'bg-primary-100 dark:bg-primary-800',
  info: 'bg-accent-100 dark:bg-accent-700',
  error: 'bg-error-100 dark:bg-error-700',
  neutral: 'bg-neutral-100 dark:bg-secondary-700',
};

const BADGE_TEXT: Record<BadgeVariant, string> = {
  success: 'text-success-700 dark:text-success-100',
  warning: 'text-primary-800 dark:text-primary-100',
  info: 'text-accent-700 dark:text-accent-100',
  error: 'text-error-700 dark:text-error-100',
  neutral: 'text-secondary-600 dark:text-secondary-300',
};

type StatTileProps = {
  icon: IconType;
  label: string;
  count?: number;
  badge?: BadgeConfig;
  loading?: boolean;
  onPress?: () => void;
};

export const StatTile: React.FC<StatTileProps> = ({
  icon: Icon,
  label,
  count,
  badge,
  loading = false,
  onPress,
}) => {
  const { isDark } = useTheme();
  const resolvedCount = count ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 bg-white dark:bg-secondary-800 rounded-2xl p-3 border border-neutral-200 dark:border-secondary-700 items-center justify-center min-h-[90px]"
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${resolvedCount}`}
      disabled={!onPress}
    >
      {loading ? (
        <>
          <Skeleton className="w-6 h-6 rounded-full mb-2" />
          <Skeleton className="w-8 h-6 rounded mb-1" />
          <Skeleton className="w-14 h-3 rounded" />
        </>
      ) : (
        <>
          <Icon size={22} color={isDark ? colors.primary[400] : colors.primary[600]} />
          <Text className="text-[22px] font-bold text-secondary-800 dark:text-neutral-100 leading-tight mt-1">
            {resolvedCount}
          </Text>
          <Text className="text-[11px] text-secondary-400 dark:text-secondary-500 text-center">
            {label}
          </Text>

          {badge ? (
            <View className={`mt-1.5 px-2 py-0.5 rounded-full ${BADGE_BG[badge.variant]}`}>
              <Text className={`text-[10px] font-semibold ${BADGE_TEXT[badge.variant]}`}>{badge.label}</Text>
            </View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
};
