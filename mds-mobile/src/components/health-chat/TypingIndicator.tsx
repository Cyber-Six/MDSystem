/**
 * TypingIndicator - Animated dots when staff is typing
 * Mirrors mds-patient TypingIndicator.jsx for React Native
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TypingIndicatorProps {
  isTyping: boolean;
}

const Dot: React.FC<{ delay: number }> = ({ delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: colors.primary[500], transform: [{ translateY }] },
      ]}
    />
  );
};

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  const { isDark } = useTheme();

  if (!isTyping) return null;

  return (
    <View style={styles.container}>
      {/* Staff avatar */}
      <View style={styles.avatar}>
        <MaterialCommunityIcons name="stethoscope" size={14} color={colors.primary[500]} />
      </View>

      {/* Dots bubble */}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
            borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
          },
        ]}
      >
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244,196,48,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,196,48,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

export default React.memo(TypingIndicator);
