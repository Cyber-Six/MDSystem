/**
 * Reusable Form Components with Dark Mode Support
 * Uses StyleSheet for reliable styling on React Native
 */

import React from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TextInputProps, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';

// ============ Input Component ============
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  style,
  ...props 
}) => {
  const { isDark } = useTheme();

  return (
    <View style={styles.inputContainer}>
      {label && (
        <Text style={[
          styles.label,
          { color: isDark ? colors.neutral[100] : colors.secondary[700] }
        ]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
            color: isDark ? colors.neutral[100] : colors.secondary[900],
            borderColor: error 
              ? colors.error[500] 
              : isDark ? colors.neutral[600] : colors.neutral[300],
          },
          style
        ]}
        placeholderTextColor={isDark ? colors.neutral[400] : colors.neutral[400]}
        {...props}
      />
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

// ============ Button Component ============
interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}) => {
  const { isDark } = useTheme();
  const isDisabled = loading || disabled;

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.button,
      opacity: isDisabled ? 0.5 : 1,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: colors.primary[500],
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return { ...styles.buttonText, color: '#FFFFFF' };
      case 'secondary':
        return { 
          ...styles.buttonText, 
          color: isDark ? colors.neutral[100] : colors.secondary[700] 
        };
      case 'outline':
        return { 
          ...styles.buttonText, 
          color: isDark ? colors.neutral[100] : colors.secondary[700] 
        };
      default:
        return styles.buttonText;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[getButtonStyle(), style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : colors.primary[500]} />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// ============ Alert Component ============
interface AlertProps {
  message: string;
  type?: 'error' | 'success' | 'info';
}

export const Alert: React.FC<AlertProps> = ({ message, type = 'error' }) => {
  const { isDark } = useTheme();
  
  if (!message) return null;

  const getAlertStyle = (): ViewStyle => {
    switch (type) {
      case 'error':
        return {
          ...styles.alert,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : colors.error[50],
          borderColor: isDark ? colors.error[700] : colors.error[400],
        };
      case 'success':
        return {
          ...styles.alert,
          backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : colors.success[50],
          borderColor: isDark ? colors.success[600] : colors.success[400],
        };
      case 'info':
        return {
          ...styles.alert,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : colors.accent[50],
          borderColor: isDark ? colors.accent[600] : colors.accent[400],
        };
      default:
        return styles.alert;
    }
  };

  const getTextColor = (): string => {
    switch (type) {
      case 'error':
        return isDark ? colors.error[400] : colors.error[600];
      case 'success':
        return isDark ? colors.success[400] : colors.success[600];
      case 'info':
        return isDark ? colors.accent[400] : colors.accent[600];
      default:
        return colors.error[600];
    }
  };

  return (
    <View style={getAlertStyle()}>
      <Text style={[styles.alertText, { color: getTextColor() }]}>
        {message}
      </Text>
    </View>
  );
};

// ============ Link Button Component ============
interface LinkButtonProps {
  title: string;
  onPress: () => void;
}

export const LinkButton: React.FC<LinkButtonProps> = ({ title, onPress }) => {
  const { isDark } = useTheme();
  
  return (
    <TouchableOpacity onPress={onPress} style={styles.linkButton}>
      <Text style={[
        styles.linkButtonText,
        { color: isDark ? colors.accent[400] : colors.accent[600] }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

// ============ Checkbox Component ============
interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onPress, label }) => {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={styles.checkboxContainer}
      activeOpacity={0.8}
    >
      <View style={[
        styles.checkbox,
        {
          backgroundColor: checked ? colors.primary[500] : (isDark ? colors.neutral[800] : '#FFFFFF'),
          borderColor: checked ? colors.primary[500] : (isDark ? colors.neutral[600] : colors.neutral[400]),
        }
      ]}>
        {checked && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
      <Text style={[
        styles.checkboxLabel,
        { color: isDark ? colors.neutral[300] : colors.secondary[700] }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ============ Styles ============
const styles = StyleSheet.create({
  // Input styles
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: {
    color: colors.error[500],
    fontSize: 12,
    marginTop: 4,
  },

  // Button styles
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Alert styles
  alert: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Link button styles
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
