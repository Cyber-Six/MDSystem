import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';

type BadgeCounts = Partial<Record<string, number>>;

type BottomTabBarExtraProps = {
  badgeCounts?: BadgeCounts;
};

type TabMeta = {
  label: string;
  renderIcon: (isActive: boolean, isDark: boolean) => React.ReactNode;
};

const TAB_META: Record<string, TabMeta> = {
  Home: {
    label: 'Home',
    renderIcon: (isActive, isDark) => (
      <Ionicons
        name={isActive ? 'home' : 'home-outline'}
        size={20}
        color={isActive ? (isDark ? colors.primary[400] : colors.primary[700]) : isDark ? colors.secondary[500] : colors.secondary[400]}
      />
    ),
  },
  Appointments: {
    label: 'Appointment',
    renderIcon: (isActive, isDark) => (
      <Ionicons
        name={isActive ? 'calendar' : 'calendar-outline'}
        size={20}
        color={isActive ? (isDark ? colors.primary[400] : colors.primary[700]) : isDark ? colors.secondary[500] : colors.secondary[400]}
      />
    ),
  },
  HealthChat: {
    label: 'Chat',
    renderIcon: (isActive, isDark) => (
      <Ionicons
        name={isActive ? 'chatbubble' : 'chatbubble-outline'}
        size={20}
        color={isActive ? (isDark ? colors.primary[400] : colors.primary[700]) : isDark ? colors.secondary[500] : colors.secondary[400]}
      />
    ),
  },
  Medicine: {
    label: 'Medicine',
    renderIcon: (isActive, isDark) => (
      <MaterialCommunityIcons
        name="pill"
        size={20}
        color={isActive ? (isDark ? colors.primary[400] : colors.primary[700]) : isDark ? colors.secondary[500] : colors.secondary[400]}
      />
    ),
  },
  Records: {
    label: 'Records',
    renderIcon: (isActive, isDark) => (
      <Ionicons
        name={isActive ? 'clipboard' : 'clipboard-outline'}
        size={20}
        color={isActive ? (isDark ? colors.primary[400] : colors.primary[700]) : isDark ? colors.secondary[500] : colors.secondary[400]}
      />
    ),
  },
};

export const BottomTabBar: React.FC<BottomTabBarProps & BottomTabBarExtraProps> = ({
  state,
  descriptors,
  navigation,
  badgeCounts = {},
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isSingleTabMode = state.routes.length === 1;
  const bottomInset = isSingleTabMode
    ? Math.max(insets.bottom - 14, 6)
    : insets.bottom;

  return (
    <View
      className="flex-row border-t"
      style={{
        paddingBottom: bottomInset,
        backgroundColor: isDark ? colors.secondary[900] : '#FFFFFF',
        borderTopColor: isDark ? colors.secondary[700] : colors.neutral[200],
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const configuredLabel = typeof options.tabBarLabel === 'string'
          ? options.tabBarLabel
          : typeof options.title === 'string'
          ? options.title
          : null;

        const baseMeta = TAB_META[route.name];
        const meta = baseMeta ?? {
          label: route.name,
          renderIcon: () => null,
        };
        const resolvedLabel = configuredLabel || meta.label;

        const badge = badgeCounts[route.name] ?? 0;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            className={`flex-1 items-center justify-center ${isSingleTabMode ? 'pt-1 pb-0 min-h-[48px]' : 'pt-2 pb-1 min-h-[56px]'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={resolvedLabel}
          >
            <View
              className="w-10 h-7 rounded-lg items-center justify-center mb-1"
              style={isFocused ? {
                backgroundColor: isDark ? colors.primary[900] : colors.primary[100],
              } : undefined}
            >
              <View className="relative">
                {meta.renderIcon(isFocused, isDark)}
                {badge > 0 ? (
                  <View className="absolute -top-1 -right-1.5 bg-error-500 rounded-full min-w-[14px] h-3.5 items-center justify-center px-0.5">
                    <Text className="text-white text-[9px] font-bold leading-none">{badge > 99 ? '99+' : badge}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Text
              className="text-[10px] font-medium"
              style={{
                color: isFocused
                  ? (isDark ? colors.primary[400] : colors.primary[700])
                  : (isDark ? colors.secondary[500] : colors.secondary[400]),
              }}
              numberOfLines={1}
            >
              {resolvedLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
