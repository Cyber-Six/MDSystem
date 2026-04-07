import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../context/ThemeContext';

interface Props {
  label?: string;
  value: string;            // 'YYYY-MM-DD' or ''
  onChange: (val: string) => void;
  isDark: boolean;
  placeholder?: string;
  required?: boolean;
}

const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDate = (val: string): Date => {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const DatePickerInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  isDark,
  placeholder = 'Select date',
  required = false,
}) => {
  const [show, setShow] = useState(false);
  const dateValue = parseDate(value);

  const handleChange = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(formatDate(selected));
  };

  const displayText = value || placeholder;
  const hasValue = !!value;

  return (
    <View>
      {label && (
        <Text style={[s.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
          {label}{required ? ' *' : ''}
        </Text>
      )}
      <TouchableOpacity
        style={[
          s.trigger,
          {
            backgroundColor: isDark ? colors.neutral[700] : '#FFF',
            borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
          },
        ]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14, color: hasValue ? (isDark ? colors.neutral[100] : colors.neutral[900]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }}>
          {displayText}
        </Text>
        <Text style={{ fontSize: 16 }}>📅</Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={s.overlay} onPress={() => setShow(false)}>
            <Pressable style={[s.sheet, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]}>
              <View style={s.sheetHeader}>
                <TouchableOpacity onPress={() => { onChange(''); setShow(false); }}>
                  <Text style={{ color: colors.error?.[500] || '#EF4444', fontWeight: '600', fontSize: 15 }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                onChange={handleChange}
                style={{ height: 200 }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {show && Platform.OS === 'web' && (
        <View style={{ marginTop: 4 }}>
          <input
            type="date"
            value={value}
            onChange={(e: any) => { onChange(e.target.value); setShow(false); }}
            style={{
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${isDark ? colors.neutral[600] : colors.neutral[200]}`,
              backgroundColor: isDark ? colors.neutral[700] : '#FFF',
              color: isDark ? colors.neutral[100] : colors.neutral[900],
              fontSize: 14,
              width: '100%',
            }}
          />
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, paddingHorizontal: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
});

export default DatePickerInput;
