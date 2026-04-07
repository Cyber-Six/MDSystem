/**
 * CreateTicketForm - Health chat ticket creation
 * Mirrors the create ticket form from mds-patient health-chat.jsx
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';

interface CreateTicketFormProps {
  purpose: string;
  onPurposeChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

const CreateTicketForm: React.FC<CreateTicketFormProps> = ({
  purpose,
  onPurposeChange,
  onSubmit,
  onCancel,
  isLoading,
  error,
}) => {
  const { isDark } = useTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex1}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="create" size={22} color={colors.primary[500]} />
          </View>

          <Text
            style={[
              styles.title,
              { color: isDark ? colors.neutral[100] : colors.secondary[800] },
            ]}
          >
            Tell us what's on your mind
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}
          >
            Be as detailed as you'd like — the more context, the better we can help.
          </Text>

          {/* Error */}
          {error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239,68,68,0.2)' : '#FECACA',
                },
              ]}
            >
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Text area */}
          <TextInput
            value={purpose}
            onChangeText={onPurposeChange}
            placeholder="e.g. I've had a headache for 3 days and it's not getting better..."
            placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            multiline
            numberOfLines={5}
            style={[
              styles.textArea,
              {
                backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                color: isDark ? colors.neutral[100] : colors.secondary[800],
                borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
              },
            ]}
            editable={!isLoading}
            textAlignVertical="top"
          />

          <Text
            style={[
              styles.hint,
              { color: isDark ? colors.neutral[500] : colors.neutral[400] },
            ]}
          >
            {purpose.length > 0
              ? `${purpose.length} characters`
              : 'Tip: include duration, severity, and any relevant history'}
          </Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] },
              ]}
              onPress={onCancel}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelBtnText,
                  { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { opacity: isLoading || !purpose.trim() ? 0.4 : 1 },
              ]}
              onPress={onSubmit}
              disabled={isLoading || !purpose.trim()}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.secondary[900]} />
              ) : (
                <Text style={styles.submitBtnText}>Send Request →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(244,196,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  textArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    borderWidth: 1,
  },
  hint: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F4C430',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#F4C430',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary[900],
  },
});

export default React.memo(CreateTicketForm);
