/**
 * CatalogSearchField — Reusable search-and-create field for catalog "Others" items.
 * Used in MedicalBackgroundStep and MedicalHistoryStep for adding items
 * not found in the pre-loaded catalog.
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../context/ThemeContext';

interface CatalogSearchFieldProps {
  /** Label for the field */
  label: string;
  /** Current input value */
  input: string;
  /** Handle input change */
  onInputChange: (value: string) => void;
  /** Search suggestions */
  suggestions: Array<{ id: string; [key: string]: any }>;
  /** Key to display from suggestion items */
  displayKey: string;
  /** Whether search is in progress */
  searching: boolean;
  /** Whether creation is in progress */
  creating: boolean;
  /** Whether dropdown is visible */
  focused: boolean;
  /** Set focused state */
  onFocusChange: (v: boolean) => void;
  /** Handle item selection */
  onSelect: (item: any) => void;
  /** Handle item creation */
  onCreate?: () => void;
  /** Dark mode flag */
  isDark: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export const CatalogSearchField: React.FC<CatalogSearchFieldProps> = ({
  label,
  input,
  onInputChange,
  suggestions,
  displayKey,
  searching,
  creating,
  focused,
  onFocusChange,
  onSelect,
  onCreate,
  isDark,
  placeholder,
}) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
        {label}
      </Text>
      <View style={{ position: 'relative', zIndex: 50 }}>
        <View style={[styles.inputRow, {
          backgroundColor: isDark ? colors.neutral[700] : '#FFF',
          borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
        }]}>
          <TextInput
            style={[styles.input, { color: isDark ? colors.neutral[100] : colors.neutral[900] }]}
            value={input}
            onChangeText={onInputChange}
            onFocus={() => onFocusChange(true)}
            placeholder={placeholder || `Search or add ${label.toLowerCase()}...`}
            placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <Ionicons name="search" size={16} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
          )}
        </View>

        {focused && (suggestions.length > 0 || (input.trim().length >= 2 && !searching)) && (
          <View style={[styles.dropdown, {
            backgroundColor: isDark ? colors.neutral[800] : '#FFF',
            borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
          }]}>
            {suggestions.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.dropdownItem, { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                onPress={() => onSelect(item)}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.primary[500]} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 14, color: isDark ? colors.neutral[200] : colors.neutral[800] }}>
                  {String(item[displayKey] || '')}
                </Text>
              </TouchableOpacity>
            ))}
            {input.trim().length >= 2 && suggestions.length === 0 && !searching && onCreate && (
              <TouchableOpacity
                style={[styles.dropdownItem, { borderBottomWidth: 0 }]}
                onPress={onCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="add" size={16} color={colors.primary[500]} style={{ marginRight: 8 }} />
                )}
                <Text style={{ flex: 1, fontSize: 14, color: colors.primary[500], fontWeight: '600' }}>
                  + Add "{input.trim()}" as new {label.toLowerCase()}
                </Text>
              </TouchableOpacity>
            )}
            {input.trim().length >= 2 && suggestions.length === 0 && !searching && !onCreate && (
              <Text style={styles.noResults}>
                No results found
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  inputRow: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 14 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    zIndex: 100, borderWidth: 1, borderRadius: 12, marginTop: 4,
    maxHeight: 200, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1,
  },
  noResults: {
    padding: 12, fontSize: 13, color: '#999', textAlign: 'center',
  },
});

export default CatalogSearchField;
