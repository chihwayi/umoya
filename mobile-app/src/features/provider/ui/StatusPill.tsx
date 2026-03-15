import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';

type Tone = 'critical' | 'warning' | 'success' | 'info' | 'neutral';

const toneStyles: Record<Tone, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(255,77,106,0.18)', border: 'rgba(255,77,106,0.45)', text: theme.colors.accentRed },
  warning: { bg: 'rgba(255,176,32,0.18)', border: 'rgba(255,176,32,0.45)', text: theme.colors.accentAmber },
  success: { bg: 'rgba(0,200,150,0.18)', border: 'rgba(0,200,150,0.45)', text: theme.colors.accentTeal },
  info: { bg: 'rgba(43,127,255,0.18)', border: 'rgba(43,127,255,0.45)', text: theme.colors.accentBlue },
  neutral: { bg: 'rgba(30,48,80,0.48)', border: theme.colors.border, text: theme.colors.textSecondary }
};

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  text: {
    ...theme.typography.textStyles.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase'
  }
});
