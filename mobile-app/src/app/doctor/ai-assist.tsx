import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { useDoctorSyncFeed } from '../../features/provider/hooks/useProviderWorkflows';
import { usePostVisitSessions } from '../../features/provider/hooks/usePostVisit';

export default function DoctorAiAssistScreen() {
  const doctorFeedQuery = useDoctorSyncFeed({ includeAcknowledged: true });
  const postVisitQuery = usePostVisitSessions();

  const feedItems = doctorFeedQuery.data?.items || [];
  const postVisitSessions = postVisitQuery.data?.sessions || [];

  const aiStats = useMemo(() => {
    const syncRecommended = feedItems.filter((item) => String(item.recommended_action || '').trim().length > 0).length;
    const criticalSignals = feedItems.filter((item) => item.severity === 'critical').length;
    const postVisitReady = postVisitSessions.filter((session) => session.status === 'doctor_reviewed').length;

    return [
      { label: 'AI Hints', value: syncRecommended, tone: 'info' as const },
      { label: 'Critical Signals', value: criticalSignals, tone: criticalSignals > 0 ? ('critical' as const) : ('success' as const) },
      { label: 'PostVisit Ready', value: postVisitReady, tone: postVisitReady > 0 ? ('warning' as const) : ('success' as const) }
    ];
  }, [feedItems, postVisitSessions]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ProviderHero
          title="AI Assist"
          subtitle="Advisory-only CDSS cues for doctor prioritization. Human signoff remains required."
        >
          <MetricGrid items={aiStats} />
        </ProviderHero>

        {doctorFeedQuery.isLoading || postVisitQuery.isLoading ? (
          <StatePanel state="loading" title="Loading AI context" message="Collecting CDSS recommendation signals..." />
        ) : null}

        {doctorFeedQuery.isError || postVisitQuery.isError ? (
          <StatePanel state="error" title="AI context unavailable" message="Could not fetch recommendation context." />
        ) : null}

        {feedItems.slice(0, 8).map((item) => (
          <Card key={item.id}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.recommendation}>{item.recommended_action || 'No recommendation text available.'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Severity: {item.severity}</Text>
              <Text style={styles.meta}>Module: {item.module}</Text>
            </View>
          </Card>
        ))}

        {!doctorFeedQuery.isLoading && feedItems.length === 0 ? (
          <StatePanel state="empty" title="No AI hints" message="No active recommendation hints in doctor sync feed." />
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
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6
  },
  recommendation: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.sm
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11
  }
});
