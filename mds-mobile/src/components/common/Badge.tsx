import React from 'react';
import { Text, View } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; darkBg: string; darkText: string }> = {
  success: {
    bg: colors.success[100],
    text: colors.success[700],
    darkBg: colors.success[700],
    darkText: colors.success[100],
  },
  warning: {
    bg: colors.primary[100],
    text: colors.primary[800],
    darkBg: colors.primary[800],
    darkText: colors.primary[100],
  },
  error: {
    bg: colors.error[100],
    text: colors.error[700],
    darkBg: colors.error[700],
    darkText: colors.error[100],
  },
  info: {
    bg: colors.accent[100],
    text: colors.accent[700],
    darkBg: colors.accent[700],
    darkText: colors.accent[100],
  },
  neutral: {
    bg: colors.neutral[100],
    text: colors.secondary[600],
    darkBg: colors.secondary[700],
    darkText: colors.secondary[300],
  },
};

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const { isDark } = useTheme();
  const color = BADGE_COLORS[variant];

  return (
    <View
      className="px-2 py-0.5 rounded-full self-start"
      style={{ backgroundColor: isDark ? color.darkBg : color.bg }}
    >
      <Text
        className="text-[11px] font-semibold"
        style={{ color: isDark ? color.darkText : color.text }}
      >
        {label}
      </Text>
    </View>
  );
};
