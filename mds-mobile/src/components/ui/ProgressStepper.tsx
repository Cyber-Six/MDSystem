/**
 * ProgressStepper — Visual step indicator for multi-step forms
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../context/ThemeContext';

interface ProgressStepperProps {
  steps: string[];
  currentStep: number;
  isDark: boolean;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ steps, currentStep, isDark }) => (
  <View style={styles.container}>
    {steps.map((label, i) => {
      const isCompleted = i < currentStep;
      const isActive = i === currentStep;
      return (
        <View key={i} style={styles.stepRow}>
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
              <Text style={[styles.circleText, !isCompleted && !isActive && { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                {isCompleted ? '✓' : String(i + 1)}
              </Text>
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary[500] : isDark ? colors.neutral[400] : colors.neutral[500] },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
          {i < steps.length - 1 && (
            <View
              style={[
                styles.connector,
                {
                  backgroundColor: isCompleted
                    ? colors.success[500]
                    : isDark ? colors.neutral[700] : colors.neutral[200],
                },
              ]}
            />
          )}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepItem: { alignItems: 'center', width: 48 },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  circleCompleted: { backgroundColor: colors.success[500] },
  circleActive: { backgroundColor: colors.primary[500] },
  circleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  labelActive: { fontWeight: '600' },
  connector: { height: 2, flex: 1, marginHorizontal: 2, borderRadius: 1 },
});

export default ProgressStepper;
