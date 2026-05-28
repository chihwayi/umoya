import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props { score: number; band: string; }

const BAND_COLORS: Record<string, { bg: string; text: string }> = {
  low:      { bg: '#22C55E33', text: C.green },
  moderate: { bg: '#fef9c3',   text: '#a16207' },
  high:     { bg: '#FF7A4033', text: C.amber },
  critical: { bg: '#FF4D6A33', text: C.red   },
};

export const MortalityBadge: React.FC<Props> = ({ score, band }) => {
  const colors = BAND_COLORS[band] ?? BAND_COLORS.low;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.score, { color: colors.text }]}>{score}</Text>
      <Text style={[styles.label, { color: colors.text }]}>
        {band.toUpperCase().slice(0, 4)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 36,
  },
  score: { fontFamily: FONT.uiBd, fontSize: 14 },
  label: { fontFamily: FONT.ui, fontSize: 8 },
});
