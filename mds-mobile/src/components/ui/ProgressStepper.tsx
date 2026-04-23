/**
 * ProgressStepper — Visual step indicator for multi-step forms
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../context/ThemeContext';

interface ProgressStepperProps {
  steps: string[];
  currentStep: number;
  isDark: boolean;
}

const formatStepLabel = (label: string): string => {
  const trimmed = label.trim();
  if (!trimmed.includes(' ')) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) return `${parts[0]}\n${parts[1]}`;
  return `${parts.slice(0, -1).join(' ')}\n${parts[parts.length - 1]}`;
};

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ steps, currentStep, isDark }) => (
  <View style={styles.container}>
    {steps.map((label, i) => {
      const isCompleted = i < currentStep;
      const isActive = i === currentStep;
      const leftConnectorColor = i === 0
        ? 'transparent'
        : (i - 1 < currentStep ? colors.success[500] : (isDark ? colors.neutral[700] : colors.neutral[200]));
      const rightConnectorColor = i === steps.length - 1
        ? 'transparent'
        : (i < currentStep ? colors.success[500] : (isDark ? colors.neutral[700] : colors.neutral[200]));

      return (
        <View key={i} style={styles.stepSlot}>
          <View style={styles.nodeRow}>
            <View style={[styles.connectorHalf, { backgroundColor: leftConnectorColor }]} />

          <View style={styles.stepItem}>
            <View
              style={[
                styles.circle,
                isCompleted && styles.circleCompleted,
                isActive && styles.circleActive,
                !isCompleted && !isActive && {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              ) : (
                <Text style={[styles.circleText, !isCompleted && !isActive && { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}> 
                  {String(i + 1)}
                </Text>
              )}
            </View>
          </View>

            <View style={[styles.connectorHalf, { backgroundColor: rightConnectorColor }]} />
          </View>

            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary[500] : isDark ? colors.neutral[400] : colors.neutral[500] },
                isActive && styles.labelActive,
              ]}
              numberOfLines={2}
            >
              {formatStepLabel(label)}
            </Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    width: '100%',
  },
  stepSlot: {
    flex: 1,
    alignItems: 'center',
  },
  nodeRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectorHalf: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  stepItem: { alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  circleCompleted: { backgroundColor: colors.success[500] },
  circleActive: { backgroundColor: colors.primary[500] },
  circleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  label: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 24,
    width: '100%',
    paddingHorizontal: 2,
  },
  labelActive: { fontWeight: '600' },
});

export default ProgressStepper;
