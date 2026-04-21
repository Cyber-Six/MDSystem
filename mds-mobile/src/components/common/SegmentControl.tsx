import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentControlProps<T extends string> = {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  className = 'mx-4 mb-4',
}: SegmentControlProps<T>) {
  const { isDark } = useTheme();

  return (
    <View
      className={`flex-row rounded-xl p-1 ${className}`}
      style={{ backgroundColor: isDark ? colors.secondary[700] : colors.neutral[100] }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;

        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1 py-2 rounded-lg items-center min-h-[40px] justify-center"
            style={selected
              ? { backgroundColor: isDark ? colors.secondary[600] : '#FFFFFF' }
              : undefined}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{
                color: selected
                  ? (isDark ? colors.neutral[100] : colors.secondary[800])
                  : (isDark ? colors.secondary[500] : colors.secondary[400]),
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
