import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../../design/tokens';

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

/** Convert a Period into explicit startDate/endDate (YYYY-MM-DD) for backends
 * that take date ranges rather than a period keyword (e.g. tenant-scoped
 * cascade/equity/mdsr analytics endpoints). */
export function periodToDateRange(period: Period): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  switch (period) {
    case 'today':   break;
    case 'week':    start.setDate(start.getDate() - 7); break;
    case 'month':   start.setMonth(start.getMonth() - 1); break;
    case 'quarter': start.setMonth(start.getMonth() - 3); break;
    case 'year':    start.setFullYear(start.getFullYear() - 1); break;
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

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
    contentContainerStyle={{ paddingRight: 20, alignItems: 'center' }}
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
