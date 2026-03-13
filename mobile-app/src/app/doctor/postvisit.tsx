import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { SectionHeader } from '../../features/provider/ui/SectionHeader';
import { StatusPill } from '../../features/provider/ui/StatusPill';
import { usePostVisitMobileContract, usePostVisitMobileEvents, usePostVisitMutations, usePostVisitSessions } from '../../features/provider/hooks/usePostVisit';
import { formatRelative, formatStatusLabel } from '../../features/provider/utils/format';
import type { PostVisitSession } from '../../services/api/provider';

function statusTone(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'doctor_reviewed') return 'warning' as const;
  if (normalized === 'published' || normalized === 'closed') return 'success' as const;
  if (normalized === 'processing') return 'info' as const;
  return 'neutral' as const;
}

export default function DoctorPostVisitScreen() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [publishNote, setPublishNote] = useState('');

  const sessionsQuery = usePostVisitSessions();
  const contractQuery = usePostVisitMobileContract(selectedSessionId);
  const eventsQuery = usePostVisitMobileEvents(selectedSessionId);
  const { publishSession, reviewArtifact } = usePostVisitMutations();

  const sessions = sessionsQuery.data?.sessions || [];

  const metrics = useMemo(() => {
    const pendingReview = sessions.filter((session) => session.status === 'doctor_reviewed').length;
    const published = sessions.filter((session) => session.status === 'published' || session.status === 'closed').length;
    const processing = sessions.filter((session) => session.status === 'processing' || session.status === 'captured').length;

    return [
      { label: 'Sessions', value: sessions.length, tone: 'info' as const },
      { label: 'Ready to Publish', value: pendingReview, tone: pendingReview > 0 ? ('warning' as const) : ('success' as const) },
      { label: 'Published', value: published, tone: 'success' as const },
      { label: 'Processing', value: processing, tone: processing > 0 ? ('warning' as const) : ('neutral' as const) }
    ];
  }, [sessions]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null;

  async function quickReview(sessionId: string) {
    await reviewArtifact.mutateAsync({
      sessionId,
      artifactType: 'visit_summary',
      action: 'accept',
      reason: 'Accepted from mobile doctor workspace.'
    });

    await reviewArtifact.mutateAsync({
      sessionId,
      artifactType: 'recommendation_bundle',
      action: 'accept',
      reason: 'Recommendation bundle accepted from mobile.'
    });
  }

  async function quickPublish(sessionId: string) {
    await publishSession.mutateAsync({
      sessionId,
      note: publishNote.trim() || 'Published from mobile doctor workspace.'
    });
    setPublishNote('');
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ProviderHero
          title="PostVisit Signoff"
          subtitle="Review session contracts, event timelines, and publish approved summaries."
        >
          <MetricGrid items={metrics} />
        </ProviderHero>

        {sessionsQuery.isLoading ? (
          <StatePanel state="loading" title="Loading sessions" message="Syncing post-visit queue..." />
        ) : null}
        {sessionsQuery.isError ? (
          <StatePanel state="error" title="Queue unavailable" message="Could not load post-visit sessions." />
        ) : null}

        {sessions.map((session) => (
          <Card key={session.id}>
            <View style={styles.sessionTop}>
              <StatusPill label={formatStatusLabel(session.status)} tone={statusTone(session.status)} />
              <Text style={styles.sessionMeta}>{formatRelative(session.updated_at)}</Text>
            </View>
            <Text style={styles.sessionTitle}>
              {session.patient?.firstName || 'Patient'} {session.patient?.lastName || ''}
            </Text>
            <Text style={styles.sessionSubtitle}>
              Source: {formatStatusLabel(session.source_type || 'in_person')} · Transcript segments:{' '}
              {session.telemetry?.transcriptSegmentCount || 0}
            </Text>
            <View style={styles.rowActions}>
              <Pressable style={styles.buttonSecondary} onPress={() => setSelectedSessionId(session.id)}>
                <Text style={styles.buttonSecondaryText}>Open Contract</Text>
              </Pressable>
              <Pressable
                disabled={reviewArtifact.isPending}
                style={[styles.buttonPrimary, reviewArtifact.isPending && styles.disabled]}
                onPress={() => quickReview(session.id)}
              >
                <Text style={styles.buttonPrimaryText}>{reviewArtifact.isPending ? 'Reviewing...' : 'Quick Review'}</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {!sessionsQuery.isLoading && sessions.length === 0 ? (
          <StatePanel state="empty" title="No post-visit sessions" message="No clinician sessions are currently queued." />
        ) : null}

        {selectedSessionId ? (
          <Card>
            <SectionHeader
              title="Mobile Contract"
              subtitle={selectedSession ? `${selectedSession.patient?.firstName || 'Patient'} · ${formatStatusLabel(selectedSession.status)}` : undefined}
            />

            {contractQuery.isLoading ? (
              <StatePanel state="loading" title="Loading contract" message="Fetching mobile contract payload..." />
            ) : null}
            {contractQuery.isError ? (
              <StatePanel state="error" title="Contract unavailable" message="Could not load post-visit contract." />
            ) : null}

            {(contractQuery.data?.cards || []).map((card) => (
              <View key={card.id} style={styles.contractCard}>
                <Text style={styles.contractTitle}>{card.title}</Text>
                <Text style={styles.contractBody}>{card.body}</Text>
              </View>
            ))}

            <SectionHeader
              title="Checklist"
              subtitle={`${contractQuery.data?.checklist?.length || 0} actions in contract`}
            />
            {(contractQuery.data?.checklist || []).map((entry) => (
              <View key={entry.id} style={styles.checkItem}>
                <StatusPill label={formatStatusLabel(entry.status)} tone={statusTone(entry.status)} />
                <Text style={styles.checkTitle}>{entry.title}</Text>
                <Text style={styles.checkDesc}>{entry.description}</Text>
              </View>
            ))}

            <SectionHeader title="Event Timeline" subtitle={`${eventsQuery.data?.paging?.total || 0} events`} />
            {(eventsQuery.data?.events || []).slice(0, 8).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <Text style={styles.eventType}>{formatStatusLabel(event.eventType)}</Text>
                <Text style={styles.eventTime}>{formatRelative(event.occurredAt)}</Text>
              </View>
            ))}

            <TextInput
              style={[styles.input, styles.textarea]}
              value={publishNote}
              onChangeText={setPublishNote}
              placeholder="Optional publish note"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />

            <View style={styles.rowActions}>
              <Pressable style={styles.buttonSecondary} onPress={() => setSelectedSessionId(undefined)}>
                <Text style={styles.buttonSecondaryText}>Close</Text>
              </Pressable>
              <Pressable
                disabled={publishSession.isPending || !selectedSessionId}
                style={[styles.buttonPrimary, (publishSession.isPending || !selectedSessionId) && styles.disabled]}
                onPress={() => selectedSessionId && quickPublish(selectedSessionId)}
              >
                <Text style={styles.buttonPrimaryText}>{publishSession.isPending ? 'Publishing...' : 'Publish'}</Text>
              </Pressable>
            </View>

            {publishSession.isError ? (
              <StatePanel
                state="error"
                title="Publish blocked"
                message="Session may still require full doctor review gates before publish."
              />
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
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  sessionMeta: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  sessionTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4
  },
  sessionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.md
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  buttonPrimary: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonPrimaryText: {
    color: '#032018',
    fontWeight: '700',
    fontSize: 13
  },
  buttonSecondary: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonSecondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13
  },
  contractCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  contractTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  contractBody: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17
  },
  checkItem: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  checkTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700'
  },
  checkDesc: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 6
  },
  eventType: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    marginRight: theme.spacing.sm
  },
  eventTime: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 13,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  disabled: {
    opacity: 0.55
  }
});
