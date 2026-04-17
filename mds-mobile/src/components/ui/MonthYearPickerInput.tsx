import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  FlatList, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../context/ThemeContext';

interface Props {
  label?: string;
  value: string;            // 'YYYY-MM' or ''
  onChange: (val: string) => void;
  isDark: boolean;
  placeholder?: string;
  required?: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = currentYear; y >= 1950; y--) YEARS.push(y);

const parseValue = (val: string): { month: number; year: number } => {
  if (val && /^\d{4}-\d{2}$/.test(val)) {
    const [y, m] = val.split('-').map(Number);
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const formatDisplay = (val: string): string => {
  if (!val) return '';
  const { month, year } = parseValue(val);
  return `${MONTHS[month - 1]} ${year}`;
};

export const MonthYearPickerInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  isDark,
  placeholder = 'Select month & year',
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const initial = parseValue(value);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);

  const handleOpen = () => {
    const parsed = parseValue(value);
    setSelectedMonth(parsed.month);
    setSelectedYear(parsed.year);
    setOpen(true);
  };

  const handleDone = () => {
    const mm = String(selectedMonth).padStart(2, '0');
    onChange(`${selectedYear}-${mm}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const displayText = value ? formatDisplay(value) : placeholder;
  const hasValue = !!value;

  const monthData = useMemo(() => MONTHS.map((m, i) => ({ label: m, value: i + 1 })), []);

  return (
    <View>
      {label && (
        <Text style={[s.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
          {label}{required ? ' *' : ''}
        </Text>
      )}
      <TouchableOpacity
        style={[s.trigger, {
          backgroundColor: isDark ? colors.neutral[700] : '#FFF',
          borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
        }]}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14, color: hasValue ? (isDark ? colors.neutral[100] : colors.neutral[900]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }}>
          {displayText}
        </Text>
        <Ionicons name="calendar" size={16} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]} onPress={() => {}}>
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={handleClear}>
                <Text style={{ color: colors.error?.[500] || '#EF4444', fontWeight: '600', fontSize: 15 }}>Clear</Text>
              </TouchableOpacity>
              <Text style={[s.headerTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                Select Month &amp; Year
              </Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 15 }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Selected preview */}
            <View style={s.preview}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary[500] }}>
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </Text>
            </View>

            {/* Two columns */}
            <View style={s.columns}>
              {/* Month column */}
              <View style={s.column}>
                <Text style={[s.colHeader, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Month</Text>
                <FlatList
                  data={monthData}
                  keyExtractor={item => String(item.value)}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => {
                    const isSelected = item.value === selectedMonth;
                    return (
                      <TouchableOpacity
                        style={[s.item, isSelected && { backgroundColor: colors.primary[50] || '#FEF3C7' }]}
                        onPress={() => setSelectedMonth(item.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 14,
                          color: isSelected ? colors.primary[500] : (isDark ? colors.neutral[200] : colors.neutral[800]),
                          fontWeight: isSelected ? '700' : '400',
                        }}>
                          {item.label}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={14} color={colors.primary[500]} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>

              <View style={s.divider} />

              {/* Year column */}
              <View style={s.column}>
                <Text style={[s.colHeader, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Year</Text>
                <FlatList
                  data={YEARS}
                  keyExtractor={item => String(item)}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => {
                    const isSelected = item === selectedYear;
                    return (
                      <TouchableOpacity
                        style={[s.item, isSelected && { backgroundColor: colors.primary[50] || '#FEF3C7' }]}
                        onPress={() => setSelectedYear(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 14,
                          color: isSelected ? colors.primary[500] : (isDark ? colors.neutral[200] : colors.neutral[800]),
                          fontWeight: isSelected ? '700' : '400',
                        }}>
                          {item}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={14} color={colors.primary[500]} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  preview: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 8 },
  columns: { flexDirection: 'row', paddingTop: 4 },
  column: { flex: 1 },
  colHeader: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginVertical: 1 },
  divider: { width: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 8 },
});

export default MonthYearPickerInput;
