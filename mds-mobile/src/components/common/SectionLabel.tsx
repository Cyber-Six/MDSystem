import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

type SectionLabelProps = {
  title: string;
  action?: () => void;
  actionLabel?: string;
  style?: string;
};

export const SectionLabel: React.FC<SectionLabelProps> = ({
  title,
  action,
  actionLabel = 'See all',
  style,
}) => {
  const { isDark } = useTheme();

  return (
    <View className={`flex-row items-center justify-between mb-3 ${style || ''}`}>
      <Text
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: isDark ? colors.secondary[500] : colors.secondary[400] }}
      >
        {title}
      </Text>

      {action ? (
        <TouchableOpacity onPress={action} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text
            className="text-[12px] font-semibold"
            style={{ color: isDark ? colors.primary[400] : colors.primary[600] }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
