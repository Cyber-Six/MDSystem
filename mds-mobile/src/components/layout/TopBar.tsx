import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';

type TopBarProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onMenuPress?: () => void;
  rightAction?: React.ReactNode;
  containerStyle?: ViewStyle;
  centerTitle?: boolean;
};

export const TopBar: React.FC<TopBarProps> = ({
  title,
  showBack = false,
  onBack,
  onMenuPress,
  rightAction,
  containerStyle,
  centerTitle = false,
}) => {
  const { isDark } = useTheme();

  return (
    <View
      className="h-14 flex-row items-center px-4 border-b"
      style={[
        {
          backgroundColor: isDark ? colors.secondary[900] : colors.neutral[50],
          borderBottomColor: isDark ? colors.secondary[700] : colors.neutral[200],
        },
        containerStyle,
      ]}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={onBack}
          className="w-10 h-10 items-center justify-center min-h-[48px] min-w-[48px]"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDark ? colors.neutral[100] : colors.secondary[700]}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onMenuPress}
          className="w-10 h-10 items-center justify-center min-h-[48px] min-w-[48px]"
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Ionicons
            name="menu"
            size={22}
            color={isDark ? colors.neutral[100] : colors.secondary[700]}
          />
        </TouchableOpacity>
      )}

      <Text
        className="flex-1 text-[17px] font-semibold"
        style={{
          color: isDark ? colors.neutral[50] : colors.secondary[900],
          textAlign: centerTitle ? 'center' : 'left',
          paddingHorizontal: centerTitle ? 8 : 0,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightAction ? (
        <View className="min-h-[40px] min-w-[40px] items-center justify-center">{rightAction}</View>
      ) : (
        <View className="min-h-[40px] min-w-[40px]" />
      )}
    </View>
  );
};
