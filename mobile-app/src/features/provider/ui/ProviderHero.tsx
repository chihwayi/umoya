import React, { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';
import { Card } from '../../shared/ui/Card';

export function ProviderHero({
  title,
  subtitle,
  children
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <Card style={styles.card}>
      <View style={styles.banner}>
        <View style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.kicker}>CLINICAL LIVE</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children ? <View style={styles.metricsWrap}>{children}</View> : null}
    </Card>
  );
}

export function MetricGrid({
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
  card: {
    marginBottom: 0,
  },
  banner: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accentTeal,
  },
  kicker: {
    color: theme.colors.accentTeal,
    ...theme.typography.textStyles.caption,
    letterSpacing: 0.1,
  },
  title: {
    color: theme.colors.textPrimary,
    ...theme.typography.textStyles.headline,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    ...theme.typography.textStyles.body,
  },
  metricsWrap: {
    marginTop: theme.spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metricCard: {
    minWidth: 98,
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.textStyles.caption,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.extraBold,
  },
});
