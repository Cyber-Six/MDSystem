import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors } from '../context/ThemeContext';

interface BannerProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  statusCode?: number;
  onDismiss: (id: string) => void;
}

const BANNER_ICONS: Record<string, string> = {
  success: '✓',
  error: '!',
  info: 'i',
  warning: '⚠',
};

const BANNER_COLORS = {
  success: { bg: colors.success[50], border: colors.success[500], text: colors.success[700], icon: colors.success[600] },
  error: { bg: colors.error[50], border: colors.error[500], text: colors.error[700], icon: colors.error[600] },
  info: { bg: colors.accent[50], border: colors.accent[500], text: colors.accent[700], icon: colors.accent[600] },
  warning: { bg: '#FFFBEB', border: colors.primary[500], text: colors.primary[800], icon: colors.primary[600] },
};

export const Banner: React.FC<BannerProps> = ({ id, type, message, statusCode, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const palette = BANNER_COLORS[type] || BANNER_COLORS.info;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(id));
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: palette.bg, borderLeftColor: palette.border },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: palette.border }]}>
        <Text style={styles.iconText}>{BANNER_ICONS[type] || 'i'}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
        {statusCode ? (
          <Text style={[styles.statusCode, { color: palette.text }]}>Code: {statusCode}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissBtn}
        accessibilityLabel="Dismiss notification"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.dismissText, { color: palette.icon }]}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  statusCode: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
});

