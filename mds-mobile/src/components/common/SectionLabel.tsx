import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <View className={`flex-row items-center justify-between mb-3 ${style || ''}`}>
      <Text className="text-[11px] font-semibold uppercase tracking-widest text-secondary-400 dark:text-secondary-500">
        {title}
      </Text>

      {action ? (
        <TouchableOpacity onPress={action} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text className="text-[12px] font-semibold text-primary-600 dark:text-primary-400">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
