import React, { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../shared/ui/Card';
import { theme } from '../../../design/theme';

export function PatientHero({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <Card>
      <View style={styles.banner}>
        <View style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.kicker}>Patient Companion</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
    </Card>
  );
}

export function PatientMetricGrid({
  items
}: {
  items: Array<{ label: string; value: string | number; tone?: 'critical' | 'warning' | 'success' | 'neutral' | 'info' }>;
}) {
  return (
    <View style={styles.metricsGrid}>
      {items.map((item) => {
        const valueColor =
          item.tone === 'critical'
            ? theme.colors.accentRed
            : item.tone === 'warning'
              ? theme.colors.accentAmber
              : item.tone === 'success'
                ? theme.colors.accentTeal
                : item.tone === 'info'
                  ? theme.colors.accentBlue
                  : theme.colors.textPrimary;

        return (
          <View key={item.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{item.label}</Text>
            <Text style={[styles.metricValue, { color: valueColor }]}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(166,108,255,0.35)',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 4,
    backgroundColor: 'rgba(20, 24, 48, 0.95)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.accentPurple
  },
  kicker: {
    color: theme.colors.accentPurple,
    ...theme.typography.textStyles.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.25
  },
  title: {
    color: theme.colors.textPrimary,
    ...theme.typography.textStyles.headlineLarge
  },
  subtitle: {
    color: theme.colors.textSecondary,
    ...theme.typography.textStyles.body
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  metricCard: {
    minWidth: 98,
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  metricLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.textStyles.caption,
    marginBottom: 2
  },
  metricValue: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.extraBold
  }
});
