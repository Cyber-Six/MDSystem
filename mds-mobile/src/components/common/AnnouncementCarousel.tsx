import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';

export type AnnouncementCarouselItem = {
  id: string;
  title: string;
  body: string;
  imageUri?: string | null;
  renderImage?: () => React.ReactNode;
  onPress?: () => void;
};

type AnnouncementCarouselProps = {
  items: AnnouncementCarouselItem[];
};

export const AnnouncementCarousel: React.FC<AnnouncementCarouselProps> = ({ items }) => {
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.max(width - 32, 280);

  return (
    <View className="mb-6">
      <FlatList
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
          setActiveIndex(Math.min(Math.max(index, 0), Math.max(items.length - 1, 0)));
        }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white dark:bg-secondary-800 rounded-2xl overflow-hidden border border-neutral-200 dark:border-secondary-700"
            style={{ width: cardWidth }}
            onPress={item.onPress}
            activeOpacity={0.85}
            accessibilityRole={item.onPress ? 'button' : undefined}
            accessibilityLabel={item.title}
            disabled={!item.onPress}
          >
            {item.renderImage ? (
              item.renderImage()
            ) : item.imageUri ? (
              <Image source={{ uri: item.imageUri }} className="w-full h-36" resizeMode="cover" />
            ) : (
              <View className="w-full h-36 bg-primary-50 dark:bg-secondary-700 items-center justify-center">
                <Ionicons
                  name="megaphone-outline"
                  size={36}
                  color={isDark ? colors.secondary[500] : colors.primary[300]}
                />
              </View>
            )}

            <View className="p-3">
              <Text
                className="text-[14px] font-semibold text-secondary-800 dark:text-neutral-100"
                numberOfLines={2}
              >
                {item.title}
              </Text>

              <Text
                className="text-[12px] text-secondary-400 dark:text-secondary-500 mt-1"
                numberOfLines={2}
              >
                {item.body}
              </Text>

              <Text className="text-[11px] text-primary-600 dark:text-primary-400 mt-2 font-medium">
                Tap to view full details
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {items.length > 1 ? (
        <View className="flex-row justify-center gap-1.5 mt-3">
          {items.map((item, index) => (
            <View
              key={item.id}
              className={index === activeIndex
                ? 'w-5 h-1.5 rounded-full bg-primary-500'
                : 'w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-secondary-600'}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default AnnouncementCarousel;
