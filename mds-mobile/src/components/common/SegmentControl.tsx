import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <View className={`flex-row bg-neutral-100 dark:bg-secondary-700 rounded-xl p-1 ${className}`}>
      {options.map((opt) => {
        const selected = value === opt.value;

        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-lg items-center min-h-[40px] justify-center ${selected ? 'bg-white dark:bg-secondary-600' : ''}`}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text
              className={`text-[13px] font-semibold ${selected ? 'text-secondary-800 dark:text-neutral-100' : 'text-secondary-400 dark:text-secondary-500'}`}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
