import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

export type FieldLabelProps = {
  label: string;
  required?: boolean;
};

export const FieldLabel: React.FC<FieldLabelProps> = ({ label, required = false }) => {
  return (
    <View className="flex-row items-center mb-1.5">
      <Text className="text-[13px] font-semibold text-secondary-700 dark:text-secondary-200">{label}</Text>
      {required ? <Text className="text-error-500 ml-1 text-[13px]">*</Text> : null}
    </View>
  );
};

type InputFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
};

export const InputField: React.FC<InputFieldProps> = ({
  label,
  required = false,
  error,
  onFocus,
  onBlur,
  ...props
}) => {
  const [focused, setFocused] = React.useState(false);

  return (
    <View className="mb-4">
      <FieldLabel label={label} required={required} />

      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={`h-12 px-4 rounded-xl text-[14px] text-secondary-800 dark:text-neutral-100 bg-white dark:bg-secondary-800 border ${error ? 'border-error-400' : focused ? 'border-primary-500' : 'border-neutral-200 dark:border-secondary-600'}`}
      />

      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text className="text-[12px] text-error-500 mt-1">{error}</Text>
        </View>
      ) : null}
    </View>
  );
};
