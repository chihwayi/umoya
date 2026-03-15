import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { Card } from '../../shared/ui/Card';
import { StatePanel } from '../../shared/ui/StatePanel';
import { theme } from '../../../design/theme';
import { useProviderInbox, useProviderMessagingMutations, useProviderThread, useProviderUnreadCount } from '../hooks/useProviderMessaging';
import { ProviderHero, MetricGrid } from '../ui/ProviderHero';
import { MessageCard } from '../ui/MessageCard';
import { SectionHeader } from '../ui/SectionHeader';
import type { ProviderInboxMessage } from '../../../services/api/provider';
import { formatRelative } from '../utils/format';

export function ProviderMessagesScreen({
  title,
  defaultRecipientRole
}: {
  title: string;
  defaultRecipientRole: 'doctor' | 'nurse' | 'admin';
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(undefined);
  const [composeRole, setComposeRole] = useState(defaultRecipientRole);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyBody, setReplyBody] = useState('');

  const inboxQuery = useProviderInbox();
  const unreadQuery = useProviderUnreadCount();
  const threadQuery = useProviderThread(selectedThreadId);
  const { markRead, sendMessage, replyMessage } = useProviderMessagingMutations();

  const messages = inboxQuery.data?.messages || [];
  const unreadCount = unreadQuery.data?.count || 0;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([inboxQuery.refetch(), unreadQuery.refetch(), threadQuery.refetch()]);
    setRefreshing(false);
  }, [inboxQuery, unreadQuery, threadQuery]);

  const selectedThreadMessages = threadQuery.data?.messages || [];
  const replyTargetMessageId = useMemo(() => {
    if (selectedThreadMessages.length === 0) return null;
    return selectedThreadMessages[selectedThreadMessages.length - 1]?.id || null;
  }, [selectedThreadMessages]);

  const selectedMessage = useMemo(() => {
    if (!selectedThreadId) return null;
    return messages.find((message) => message.thread_id === selectedThreadId) || null;
  }, [messages, selectedThreadId]);

  async function onSendCompose() {
    if (!composeSubject.trim() || !composeBody.trim()) {
      return;
    }

    await sendMessage.mutateAsync({
      subject: composeSubject.trim(),
      message_text: composeBody.trim(),
      recipient_role: composeRole,
      message_type: 'message',
      priority: 'normal'
    });

    setComposeBody('');
    setComposeSubject('');
  }

  async function onSendReply() {
    if (!replyTargetMessageId || !replyBody.trim()) {
      return;
    }

    await replyMessage.mutateAsync({
      messageId: replyTargetMessageId,
      body: replyBody.trim()
    });

    setReplyBody('');
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentTeal} />
        }
      >
        <ProviderHero title={title} subtitle="Secure clinical messaging with live unread counters and thread history.">
          <MetricGrid
            items={[
              { label: 'Inbox', value: messages.length, tone: 'info' },
              { label: 'Unread', value: unreadCount, tone: unreadCount > 0 ? 'warning' : 'success' },
              {
                label: 'Last Update',
                value: messages[0]?.sent_at ? formatRelative(messages[0].sent_at) : 'n/a',
                tone: 'neutral'
              }
            ]}
          />
        </ProviderHero>

        <Card>
          <SectionHeader title="Compose" subtitle="Fast role-targeted clinical message" />
          <View style={styles.composeGrid}>
            <TextInput
              style={styles.input}
              value={composeRole}
              onChangeText={(value) => setComposeRole(value as 'doctor' | 'nurse' | 'admin')}
              placeholder="recipient role"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={composeSubject}
              onChangeText={setComposeSubject}
              placeholder="subject"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              value={composeBody}
              onChangeText={setComposeBody}
              placeholder="message"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
          </View>
          <Pressable disabled={sendMessage.isPending} style={[styles.buttonPrimary, sendMessage.isPending && styles.disabled]} onPress={onSendCompose}>
            <Text style={styles.buttonPrimaryText}>{sendMessage.isPending ? 'Sending...' : 'Send Message'}</Text>
          </Pressable>
          {sendMessage.isError ? (
            <StatePanel state="error" title="Unable to send" message="Check recipient role and retry." />
          ) : null}
        </Card>

        <SectionHeader title="Inbox" subtitle="Tap a message to open its thread" />
        {inboxQuery.isLoading ? <StatePanel state="loading" title="Loading inbox" message="Syncing provider messages..." /> : null}
        {inboxQuery.isError ? <StatePanel state="error" title="Inbox unavailable" message="Could not load provider inbox." /> : null}

        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            busy={markRead.isPending}
            onOpen={(entry: ProviderInboxMessage) => setSelectedThreadId(entry.thread_id || undefined)}
            onMarkRead={(entry) => markRead.mutate(entry.id)}
          />
        ))}

        {!inboxQuery.isLoading && messages.length === 0 ? (
          <StatePanel
            state="empty"
            title="No messages"
            message="Your clinical inbox is clear."
            actionLabel="Refresh"
            onAction={onRefresh}
          />
        ) : null}

        {selectedThreadId ? (
          <Card>
            <SectionHeader
              title={selectedMessage?.subject || 'Thread'}
              subtitle={threadQuery.isLoading ? 'Loading thread...' : `${selectedThreadMessages.length} messages`}
            />

            {selectedThreadMessages.map((entry) => (
              <View key={entry.id} style={styles.threadMessage}>
                <Text style={styles.threadSender}>{entry.sender_name || entry.sender_email || 'Provider'}</Text>
                <Text style={styles.threadBody}>{entry.message_text}</Text>
                <Text style={styles.threadTime}>{formatRelative(entry.sent_at)}</Text>
              </View>
            ))}

            <TextInput
              style={[styles.input, styles.textarea]}
              value={replyBody}
              onChangeText={setReplyBody}
              placeholder="Reply to thread"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <View style={styles.rowActions}>
              <Pressable style={styles.buttonSecondary} onPress={() => setSelectedThreadId(undefined)}>
                <Text style={styles.buttonSecondaryText}>Close Thread</Text>
              </Pressable>
              <Pressable disabled={replyMessage.isPending} style={[styles.buttonPrimarySmall, replyMessage.isPending && styles.disabled]} onPress={onSendReply}>
                <Text style={styles.buttonPrimaryText}>{replyMessage.isPending ? 'Sending...' : 'Reply'}</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  composeGrid: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 13
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  buttonPrimary: {
    marginTop: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentBlue,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonPrimarySmall: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentTeal,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonPrimaryText: {
    color: '#EEF4FF',
    fontWeight: '700',
    fontSize: 13
  },
  buttonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonSecondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13
  },
  threadMessage: {
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  threadSender: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  threadBody: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  threadTime: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  disabled: {
    opacity: 0.6
  }
});
