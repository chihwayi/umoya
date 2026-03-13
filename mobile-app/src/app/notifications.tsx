import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { StatePanel } from '../features/shared/ui/StatePanel';
import { theme } from '../design/theme';
import { getSession } from '../lib/auth/auth-service';
import type { AuthSession } from '../lib/auth/types';
import {
  getPatientMessages,
  getPatientNotifications,
  markAllPatientNotificationsRead,
  markPatientNotificationRead
} from '../services/api/patient';
import { getProviderMessageInbox, getProviderUnreadCount } from '../services/api/provider';
import { formatRelative, formatStatusLabel } from '../features/patient/utils/format';

export default function NotificationsShellScreen() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const current = await getSession();
      if (!mounted) return;
      setSession(current);
      setSessionLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isPatient = session?.role === 'patient';
  const isProvider = session?.role === 'doctor' || session?.role === 'nurse';

  const patientNotificationsQuery = useQuery({
    queryKey: ['notifications', 'patient', 'list'],
    queryFn: () => getPatientNotifications({ limit: 30 }),
    enabled: isPatient,
    refetchInterval: 30_000
  });

  const patientMessagesQuery = useQuery({
    queryKey: ['notifications', 'patient', 'messages'],
    queryFn: () => getPatientMessages({ limit: 30 }),
    enabled: isPatient,
    refetchInterval: 30_000
  });

  const providerUnreadQuery = useQuery({
    queryKey: ['notifications', 'provider', 'unread'],
    queryFn: getProviderUnreadCount,
    enabled: isProvider,
    refetchInterval: 20_000
  });

  const providerInboxQuery = useQuery({
    queryKey: ['notifications', 'provider', 'inbox'],
    queryFn: () => getProviderMessageInbox({ limit: 20 }),
    enabled: isProvider,
    refetchInterval: 25_000
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markPatientNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'patient'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllPatientNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'patient'] });
    }
  });

  const patientUnread = useMemo(() => {
    const unreadFromApi = patientNotificationsQuery.data?.unreadCount || 0;
    if (unreadFromApi > 0) return unreadFromApi;
    const list = patientNotificationsQuery.data?.notifications || [];
    return list.filter((entry) => !Boolean(entry.is_read)).length;
  }, [patientNotificationsQuery.data?.notifications, patientNotificationsQuery.data?.unreadCount]);

  const patientMessageUnread = useMemo(() => {
    const list = patientMessagesQuery.data?.messages || [];
    return list.filter((entry) => !String(entry.read_at || '').trim()).length;
  }, [patientMessagesQuery.data?.messages]);

  if (sessionLoading) {
    return (
      <Screen>
        <StatePanel state="loading" title="Loading session" message="Preparing role-aware notification centre..." />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <StatePanel state="offline" title="No active session" message="Please sign in to view notifications." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.title}>Notification Centre</Text>
          <Text style={styles.subtitle}>
            {isPatient
              ? 'Patient notifications, engagement messages, and reminder actions.'
              : 'Provider operational inbox and unread communication indicators.'}
          </Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metric}>
              Role: <Text style={styles.metricStrong}>{formatStatusLabel(session.role)}</Text>
            </Text>
            {isPatient ? (
              <>
                <Text style={styles.metric}>
                  Unread alerts: <Text style={styles.metricStrong}>{patientUnread}</Text>
                </Text>
                <Text style={styles.metric}>
                  Unread messages: <Text style={styles.metricStrong}>{patientMessageUnread}</Text>
                </Text>
              </>
            ) : (
              <Text style={styles.metric}>
                Unread inbox: <Text style={styles.metricStrong}>{providerUnreadQuery.data?.count || 0}</Text>
              </Text>
            )}
          </View>
        </Card>

        {isPatient ? (
          <Card>
            <View style={styles.inlineHeader}>
              <Text style={styles.sectionTitle}>Patient Alerts</Text>
              <Pressable
                disabled={markAllReadMutation.isPending || patientUnread === 0}
                style={[styles.smallAction, (markAllReadMutation.isPending || patientUnread === 0) && styles.disabled]}
                onPress={() => markAllReadMutation.mutate()}
              >
                <Text style={styles.smallActionText}>
                  {markAllReadMutation.isPending ? 'Updating...' : 'Mark All Read'}
                </Text>
              </Pressable>
            </View>

            {patientNotificationsQuery.isLoading ? (
              <StatePanel state="loading" title="Loading alerts" message="Syncing patient notification feed..." />
            ) : null}
            {patientNotificationsQuery.isError ? (
              <StatePanel state="error" title="Alerts unavailable" message="Could not load patient notifications." />
            ) : null}

            {(patientNotificationsQuery.data?.notifications || []).map((entry) => {
              const unread = !Boolean(entry.is_read);
              return (
                <View key={entry.id} style={styles.itemCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.itemType}>{formatStatusLabel(entry.notification_type || 'update')}</Text>
                    <Text style={styles.itemMeta}>{formatRelative(entry.created_at || null)}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{String(entry.title || 'Patient update')}</Text>
                  <Text style={styles.itemBody}>{String(entry.message || 'No message body')}</Text>
                  {unread ? (
                    <Pressable
                      disabled={markReadMutation.isPending}
                      style={[styles.smallAction, markReadMutation.isPending && styles.disabled]}
                      onPress={() => markReadMutation.mutate(entry.id)}
                    >
                      <Text style={styles.smallActionText}>
                        {markReadMutation.isPending ? 'Updating...' : 'Mark Read'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            {!patientNotificationsQuery.isLoading &&
            (patientNotificationsQuery.data?.notifications || []).length === 0 ? (
              <StatePanel state="empty" title="No alerts" message="You are up to date." />
            ) : null}
          </Card>
        ) : null}

        {isProvider ? (
          <Card>
            <Text style={styles.sectionTitle}>Provider Inbox Events</Text>
            {providerInboxQuery.isLoading ? (
              <StatePanel state="loading" title="Loading inbox events" message="Syncing provider messages..." />
            ) : null}
            {providerInboxQuery.isError ? (
              <StatePanel state="error" title="Inbox unavailable" message="Could not load provider inbox events." />
            ) : null}

            {(providerInboxQuery.data?.messages || []).map((message) => (
              <View key={message.id} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.itemType}>{formatStatusLabel(message.priority || 'normal')}</Text>
                  <Text style={styles.itemMeta}>{formatRelative(message.sent_at || null)}</Text>
                </View>
                <Text style={styles.itemTitle}>{message.subject || 'Message'}</Text>
                <Text style={styles.itemBody}>{message.message_text || 'No message body'}</Text>
              </View>
            ))}

            {!providerInboxQuery.isLoading && (providerInboxQuery.data?.messages || []).length === 0 ? (
              <StatePanel state="empty" title="No inbox events" message="Provider inbox is clear." />
            ) : null}
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
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  metricsRow: {
    marginTop: theme.spacing.md,
    gap: 4
  },
  metric: {
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  metricStrong: {
    color: theme.colors.textPrimary,
    fontWeight: '700'
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  itemCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  itemType: {
    color: theme.colors.accentBlue,
    fontSize: 11,
    fontWeight: '700'
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  itemBody: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  smallAction: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6
  },
  smallActionText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.5
  }
});
