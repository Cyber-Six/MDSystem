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
            className="rounded-2xl overflow-hidden border"
            style={{
              width: cardWidth,
              backgroundColor: isDark ? colors.secondary[800] : '#FFFFFF',
              borderColor: isDark ? colors.secondary[700] : colors.neutral[200],
            }}
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
              <View
                className="w-full h-36 items-center justify-center"
                style={{ backgroundColor: isDark ? colors.secondary[700] : colors.primary[50] }}
              >
                <Ionicons
                  name="megaphone-outline"
                  size={36}
                  color={isDark ? colors.secondary[500] : colors.primary[300]}
                />
              </View>
            )}

            <View className="p-3">
              <Text
                className="text-[14px] font-semibold"
                style={{ color: isDark ? colors.neutral[100] : colors.secondary[800] }}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              <Text
                className="text-[12px] mt-1"
                style={{ color: isDark ? colors.secondary[500] : colors.secondary[400] }}
                numberOfLines={2}
              >
                {item.body}
              </Text>

              <Text
                className="text-[11px] mt-2 font-medium"
                style={{ color: isDark ? colors.primary[400] : colors.primary[600] }}
              >
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
