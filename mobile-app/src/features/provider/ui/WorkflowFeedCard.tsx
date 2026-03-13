import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../shared/ui/Card';
import { theme } from '../../../design/theme';
import { formatRelative, formatStatusLabel } from '../utils/format';
import { StatusPill } from './StatusPill';
import type { NurseCrossModuleFeedItem } from '../../../services/api/provider';

function toneFromSeverity(severity: string): 'critical' | 'warning' | 'success' | 'info' | 'neutral' {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'warning';
  if (normalized === 'low') return 'success';
  return 'info';
}

export function WorkflowFeedCard({
  item,
  busy = false,
  onAcknowledge,
  onComplete
}: {
  item: NurseCrossModuleFeedItem;
  busy?: boolean;
  onAcknowledge?: (item: NurseCrossModuleFeedItem) => void;
  onComplete?: (item: NurseCrossModuleFeedItem) => void;
}) {
  const severityLabel = formatStatusLabel(item.severity || 'medium');
  const workflowLabel = formatStatusLabel(item.workflow_status || 'pending');

  return (
    <Card>
      <View style={styles.topRow}>
        <View style={styles.badges}>
          <StatusPill label={severityLabel} tone={toneFromSeverity(item.severity || 'medium')} />
          <StatusPill label={workflowLabel} tone="neutral" />
        </View>
        <Text style={styles.meta}>{formatRelative(item.updated_at || item.created_at)}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.summary}>{item.summary}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.module}>{formatStatusLabel(item.module)}</Text>
        {item.patient_name ? <Text style={styles.patient}>Patient: {item.patient_name}</Text> : null}
      </View>

      {item.recommended_action ? <Text style={styles.reco}>Recommended: {item.recommended_action}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          disabled={busy || !onAcknowledge}
          style={[styles.secondaryButton, (busy || !onAcknowledge) && styles.disabled]}
          onPress={() => onAcknowledge?.(item)}
        >
          <Text style={styles.secondaryText}>{busy ? 'Working...' : 'Acknowledge'}</Text>
        </Pressable>
        <Pressable
          disabled={busy || !onComplete}
          style={[styles.primaryButton, (busy || !onComplete) && styles.disabled]}
          onPress={() => onComplete?.(item)}
        >
          <Text style={styles.primaryText}>{busy ? 'Working...' : 'Complete'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap'
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  summary: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: 4
  },
  module: {
    color: theme.colors.accentBlue,
    fontSize: 11,
    fontWeight: '700'
  },
  patient: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  reco: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: theme.spacing.md
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center'
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center'
  },
  primaryText: {
    color: '#042018',
    fontWeight: '700',
    fontSize: 13
  },
  secondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13
  },
  disabled: {
    opacity: 0.55
  }
});
