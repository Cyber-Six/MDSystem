import React from 'react';
import { Image, Text, View } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg';

type UserAvatarProps = {
  name: string;
  size?: AvatarSize;
  photoUri?: string;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
};

const TEXT_CLASSES: Record<AvatarSize, string> = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-[18px]',
};

const getInitials = (fullName: string) => {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return 'P';

  const initials = trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();

  return initials || 'P';
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  size = 'md',
  photoUri,
}) => {
  const initials = getInitials(name);

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        className={`${SIZE_CLASSES[size]} rounded-full`}
      />
    );
  }

  return (
    <View
      className={`${SIZE_CLASSES[size]} rounded-full bg-primary-500 items-center justify-center`}
    >
      <Text
        className={`${TEXT_CLASSES[size]} font-bold text-white`}
      >
        {initials}
      </Text>
    </View>
  );
};

export default UserAvatar;
