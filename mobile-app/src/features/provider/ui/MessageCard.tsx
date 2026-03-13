import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../shared/ui/Card';
import { theme } from '../../../design/theme';
import { formatRelative, formatStatusLabel } from '../utils/format';
import { StatusPill } from './StatusPill';
import type { ProviderInboxMessage } from '../../../services/api/provider';

function toneFromPriority(priority?: string | null): 'critical' | 'warning' | 'success' | 'info' | 'neutral' {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'urgent') return 'critical';
  if (normalized === 'high') return 'warning';
  if (normalized === 'normal') return 'info';
  return 'neutral';
}

export function MessageCard({
  message,
  onOpen,
  onMarkRead,
  busy = false
}: {
  message: ProviderInboxMessage;
  onOpen?: (message: ProviderInboxMessage) => void;
  onMarkRead?: (message: ProviderInboxMessage) => void;
  busy?: boolean;
}) {
  const read = Boolean(message.read_at) || String(message.status || '').toLowerCase() === 'read';

  return (
    <Card>
      <Pressable onPress={() => onOpen?.(message)}>
        <View style={styles.topRow}>
          <StatusPill label={formatStatusLabel(message.priority || 'normal')} tone={toneFromPriority(message.priority)} />
          <Text style={styles.meta}>{formatRelative(message.sent_at)}</Text>
        </View>

        <Text style={styles.subject}>{message.subject || 'Untitled message'}</Text>
        <Text style={styles.preview} numberOfLines={3}>
          {message.message_text || 'No message body'}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.from}>From: {message.sender_name || message.sender_email || 'Provider'}</Text>
          {!read ? <Text style={styles.unread}>Unread</Text> : null}
        </View>

        {!read ? (
          <Pressable disabled={busy} style={[styles.readButton, busy && styles.disabled]} onPress={() => onMarkRead?.(message)}>
            <Text style={styles.readButtonText}>{busy ? 'Updating...' : 'Mark Read'}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  subject: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  preview: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.sm
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  from: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  unread: {
    color: theme.colors.accentBlue,
    fontSize: 11,
    fontWeight: '700'
  },
  readButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6
  },
  readButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.6
  }
});
