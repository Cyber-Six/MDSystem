import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BadgeVariant } from './Badge';
import { colors } from '../../context/ThemeContext';

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

type ActivityCardProps = {
  icon: IconType;
  iconBg: string;
  title: string;
  subtitle: string;
  timeAgo?: string;
  badge?: BadgeConfig;
  onPress?: () => void;
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  timeAgo,
  badge,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-white dark:bg-secondary-800 rounded-2xl p-4 border border-neutral-200 dark:border-secondary-700 mb-2.5 min-h-[68px]"
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
    >
      <View className={`w-10 h-10 rounded-xl ${iconBg} items-center justify-center mr-3 flex-shrink-0`}>
        <Icon size={18} color={colors.neutral[50]} />
      </View>

      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-secondary-800 dark:text-neutral-100" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[12px] text-secondary-400 dark:text-secondary-500 mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View className="items-end gap-1 flex-shrink-0 ml-2">
        {timeAgo ? (
          <Text className="text-[11px] text-secondary-300 dark:text-secondary-600">{timeAgo}</Text>
        ) : null}

        {badge ? (
          <View className={`px-2 py-0.5 rounded-full ${BADGE_BG[badge.variant]}`}>
            <Text className={`text-[10px] font-semibold ${BADGE_TEXT[badge.variant]}`}>{badge.label}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};
