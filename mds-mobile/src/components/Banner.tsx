import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../context/ThemeContext';

interface BannerProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  statusCode?: number;
  onDismiss: (id: string) => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const BANNER_ICONS: Record<string, IoniconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

const BANNER_COLORS: Record<string, string> = {
  success: colors.success[500],
  error: colors.error[500],
  info: colors.accent[500],
  warning: colors.primary[500],
};

export const Banner: React.FC<BannerProps> = ({ id, type, message, statusCode, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bg = BANNER_COLORS[type] ?? BANNER_COLORS.info;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onDismiss(id));
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: bg },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Ionicons name={BANNER_ICONS[type] ?? 'information-circle'} size={22} color="#FFFFFF" />
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {statusCode ? (
          <Text style={styles.statusCode}>Error {statusCode}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissBtn}
        accessibilityLabel="Dismiss notification"
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    flex: 1,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  statusCode: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 2,
  },
});

