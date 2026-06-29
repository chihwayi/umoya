import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../../design/tokens';

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface Props {
  value: Period;
  onChange: (p: Period) => void;
}

const OPTIONS: { key: Period; label: string }[] = [
  { key: 'today',   label: 'Today'      },
  { key: 'week',    label: 'This Week'  },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'Quarter'    },
  { key: 'year',    label: 'Year'       },
];

export const PeriodSelector: React.FC<Props> = ({ value, onChange }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={s.row}
    contentContainerStyle={{ paddingRight: 20 }}
  >
    {OPTIONS.map(opt => (
      <TouchableOpacity
        key={opt.key}
        onPress={() => onChange(opt.key)}
        style={[s.chip, value === opt.key && s.chipActive]}
      >
        <Text style={[s.chipText, value === opt.key && s.chipTextActive]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const s = StyleSheet.create({
  row: { flexGrow: 0, marginBottom: 16 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
    backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal },
  chipText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
  chipTextActive: { color: '#fff' },
});
