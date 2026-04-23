import React from 'react';
import { View } from 'react-native';

type SkeletonProps = {
  className: string;
};

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <View className={`bg-neutral-200 dark:bg-secondary-700 rounded-lg animate-pulse ${className}`} />;
};
