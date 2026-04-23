import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { UserAvatar } from '../common/UserAvatar';

type DrawerMenuProps = {
  userName: string;
  userEmail: string;
  onSignOut: () => void;
  showMyDocuments?: boolean;
} & DrawerContentComponentProps;

type DrawerItem = {
  key: string;
  label: string;
  subtitle: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  screen: string;
};

const DRAWER_ITEMS: DrawerItem[] = [
  {
    key: 'profile',
    label: 'Profile',
    subtitle: 'View personal info',
    iconName: 'person-outline',
    screen: 'Profile',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    subtitle: 'Clinic news',
    iconName: 'megaphone-outline',
    screen: 'Announcements',
  },
  {
    key: 'my-documents',
    label: 'My Documents',
    subtitle: 'Uploaded files',
    iconName: 'folder-open-outline',
    screen: 'MyDocuments',
  },
  {
    key: 'faqs',
    label: 'FAQs',
    subtitle: 'Common questions',
    iconName: 'help-circle-outline',
    screen: 'FAQs',
  },
  {
    key: 'settings',
    label: 'Settings',
    subtitle: 'Theme and preferences',
    iconName: 'settings-outline',
    screen: 'Settings',
  },
];

const getLeafRouteName = (state: any): string | null => {
  if (!state?.routes?.length) return null;

  let route = state.routes[state.index ?? 0];
  while (route?.state?.routes?.length) {
    route = route.state.routes[route.state.index ?? 0];
  }

  return route?.name ?? null;
};

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  state,
  navigation,
  userName,
  userEmail,
  onSignOut,
  showMyDocuments = true,
}) => {
  const { isDark } = useTheme();
  const currentLeafRoute = getLeafRouteName(state);
  const visibleDrawerItems = showMyDocuments
    ? DRAWER_ITEMS
    : DRAWER_ITEMS.filter((item) => item.screen !== 'MyDocuments');
  const panelBg = isDark ? colors.secondary[900] : '#FFFFFF';
  const cardBg = isDark ? colors.secondary[800] : '#FFFFFF';
  const mutedCardBg = isDark ? colors.secondary[800] : colors.neutral[50];
  const cardBorder = isDark ? colors.secondary[700] : colors.neutral[200];
  const titleColor = isDark ? colors.neutral[50] : colors.secondary[900];
  const subtitleColor = isDark ? colors.secondary[500] : colors.secondary[400];

  const navigateToSecondaryScreen = (screen: string) => {
    (navigation as any).navigate('MoreStack', { screen });
    navigation.closeDrawer();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: panelBg }} edges={['top', 'bottom']}>
      <ScrollView>
        <View
          className="px-5 pt-4 pb-3 border-b"
          style={{ borderBottomColor: isDark ? colors.secondary[700] : colors.neutral[100] }}
        >
          <Text className="text-[13px] font-bold tracking-widest uppercase" style={{ color: colors.primary[600] }}>
            MDSystem
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigateToSecondaryScreen('Profile')}
          className="flex-row items-center px-5 py-4 mx-3 mt-3 mb-1 rounded-2xl border"
          style={{
            backgroundColor: mutedCardBg,
            borderColor: cardBorder,
          }}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <UserAvatar name={userName || userEmail || 'Patient'} size="md" />

          <View className="flex-1 ml-3">
            <Text className="text-[15px] font-semibold" style={{ color: titleColor }} numberOfLines={1}>
              {userName || 'Patient'}
            </Text>
            <Text className="text-[12px]" style={{ color: subtitleColor }} numberOfLines={1}>
              {userEmail || 'No email'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={isDark ? colors.secondary[600] : colors.secondary[300]}
          />
        </TouchableOpacity>

        <View
          className="mx-3 mt-3 rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
          }}
        >
          {visibleDrawerItems.map((item, index) => {
            const isActive = currentLeafRoute === item.screen;

            return (
              <View key={item.key}>
                <TouchableOpacity
                  onPress={() => navigateToSecondaryScreen(item.screen)}
                  className="flex-row items-center px-4 py-3.5 min-h-[60px]"
                  style={{
                    backgroundColor: isActive
                      ? (isDark ? colors.secondary[700] : colors.primary[50])
                      : 'transparent',
                  }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                >
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3 flex-shrink-0"
                    style={{ backgroundColor: isDark ? colors.secondary[700] : colors.neutral[100] }}
                  >
                    <Ionicons
                      name={item.iconName}
                      size={18}
                      color={isDark ? colors.secondary[300] : colors.secondary[600]}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-[15px] font-medium" style={{ color: isDark ? colors.neutral[100] : colors.secondary[800] }}>
                      {item.label}
                    </Text>
                    <Text className="text-[12px] mt-0.5" style={{ color: subtitleColor }}>
                      {item.subtitle}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? colors.secondary[600] : colors.secondary[300]}
                  />
                </TouchableOpacity>

                {index < visibleDrawerItems.length - 1 ? (
                  <View
                    className="h-[0.5px] ml-16"
                    style={{ backgroundColor: isDark ? colors.secondary[700] : colors.neutral[100] }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View className="mx-3 mt-3">
          <TouchableOpacity
            onPress={onSignOut}
            className="flex-row items-center justify-center gap-2 border border-error-300 dark:border-error-800 rounded-full py-3.5 min-h-[52px]"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={isDark ? colors.error[400] : colors.error[600]}
            />
            <Text className="text-[15px] font-semibold text-error-600 dark:text-error-400">
              Sign out
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          className="text-center text-[11px] mt-6 mb-4"
          style={{ color: isDark ? colors.secondary[600] : colors.secondary[300] }}
        >
          MDSystem Mobile {process.env.EXPO_PUBLIC_APP_VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
