import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { StatusPill } from '../../features/provider/ui/StatusPill';
import { useTelemedicineConsultations, useTelemedicineMutations } from '../../features/provider/hooks/useTelemedicine';
import { formatRelative, formatStatusLabel, safeArray } from '../../features/provider/utils/format';
import { getHivCohortWorklist } from '../../services/api/provider';
import type { TelemedicineConsultation } from '../../services/api/provider';
import { getOnlinePolicyMessage } from '../../lib/network/online-policy';

function consultationTone(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'success' as const;
  if (normalized === 'technical_issue' || normalized === 'cancelled') return 'critical' as const;
  if (normalized === 'in_progress') return 'warning' as const;
  return 'info' as const;
}

export default function DoctorRoundsScreen() {
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [meetingHint, setMeetingHint] = useState<string | null>(null);

  const teleQuery = useTelemedicineConsultations();
  const teleMutations = useTelemedicineMutations();

  const hivQuery = useQuery({
    queryKey: ['provider', 'doctor', 'hiv-cohort-worklist'],
    queryFn: () => getHivCohortWorklist({ status: 'active', limit: 10 }),
    refetchInterval: 45_000
  });

  const consultations = teleQuery.data?.consultations || [];
  const hivItems = useMemo(() => safeArray<Record<string, unknown>>((hivQuery.data as Record<string, unknown>)?.items), [hivQuery.data]);

  const metrics = useMemo(() => {
    const live = consultations.filter((item) => String(item.status || '').toLowerCase() === 'in_progress').length;
    const scheduled = consultations.filter((item) => String(item.status || '').toLowerCase() === 'scheduled').length;
    const pendingHiv = hivItems.length;

    return [
      { label: 'Telemedicine', value: consultations.length, tone: 'info' as const },
      { label: 'Live', value: live, tone: live > 0 ? ('warning' as const) : ('success' as const) },
      { label: 'Scheduled', value: scheduled, tone: 'neutral' as const },
      { label: 'HIV Queue', value: pendingHiv, tone: pendingHiv > 0 ? ('warning' as const) : ('success' as const) }
    ];
  }, [consultations, hivItems.length]);

  async function joinConsultation(entry: TelemedicineConsultation) {
    try {
      setWorkingId(entry.id);
      await teleMutations.joinConsultation.mutateAsync(entry.id);
      const meeting = await teleMutations.getMeetingUrl.mutateAsync(entry.id);
      const url = String(meeting?.meetingUrl || meeting?.url || '').trim();
      setMeetingHint(url ? `Meeting URL ready: ${url}` : 'Joined consultation. Meeting metadata loaded.');
    } catch (error) {
      setMeetingHint(getOnlinePolicyMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  async function endConsultation(entry: TelemedicineConsultation) {
    try {
      setWorkingId(entry.id);
      await teleMutations.endConsultation.mutateAsync(entry.id);
      setMeetingHint('Consultation ended and synced.');
    } catch (error) {
      setMeetingHint(getOnlinePolicyMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ProviderHero
          title="Doctor Rounds"
          subtitle="Telemedicine queue, care coordination, and HIV cohort handoff visibility."
        >
          <MetricGrid items={metrics} />
        </ProviderHero>

        {meetingHint ? <StatePanel state="empty" title="Telemedicine" message={meetingHint} /> : null}

        <Card>
          <Text style={styles.sectionTitle}>Telemedicine Consultations</Text>
          {teleQuery.isLoading ? <StatePanel state="loading" title="Loading consultations" message="Syncing telemedicine board..." /> : null}
          {teleQuery.isError ? <StatePanel state="error" title="Telemedicine unavailable" message="Could not load consultation list." /> : null}

          {consultations.map((entry) => {
            const status = String(entry.status || 'scheduled');
            return (
              <View key={entry.id} style={styles.consultationCard}>
                <View style={styles.consultationTop}>
                  <StatusPill label={formatStatusLabel(status)} tone={consultationTone(status)} />
                  <Text style={styles.consultationMeta}>{formatRelative(entry.updated_at || entry.scheduled_start_time || null)}</Text>
                </View>
                <Text style={styles.consultationTitle}>{entry.patient_name || 'Patient consultation'}</Text>
                <Text style={styles.consultationSubtitle}>
                  Doctor: {entry.doctor_name || 'Assigned doctor'} · Type: {formatStatusLabel(entry.consultation_type || 'general')}
                </Text>

                <View style={styles.rowActions}>
                  <Pressable
                    disabled={workingId === entry.id}
                    style={[styles.secondaryButton, workingId === entry.id && styles.disabled]}
                    onPress={() => joinConsultation(entry)}
                  >
                    <Text style={styles.secondaryButtonText}>{workingId === entry.id ? 'Working...' : 'Join'}</Text>
                  </Pressable>

                  <Pressable
                    disabled={workingId === entry.id}
                    style={[styles.primaryButton, workingId === entry.id && styles.disabled]}
                    onPress={() => endConsultation(entry)}
                  >
                    <Text style={styles.primaryButtonText}>{workingId === entry.id ? 'Working...' : 'End'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {!teleQuery.isLoading && consultations.length === 0 ? (
            <StatePanel state="empty" title="No consultations" message="No telemedicine consultations are currently queued." />
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>HIV Cohort Snapshot</Text>
          {hivQuery.isLoading ? <StatePanel state="loading" title="Loading HIV queue" message="Fetching cohort worklist..." /> : null}
          {hivQuery.isError ? <StatePanel state="error" title="HIV queue unavailable" message="Could not load HIV cohort worklist." /> : null}

          {hivItems.slice(0, 6).map((entry, index) => (
            <View key={String(entry.id || `hiv-${index}`)} style={styles.hivItem}>
              <Text style={styles.hivTitle}>
                {String(entry.patient_name || entry.patientName || entry.enrollment_number || 'HIV follow-up item')}
              </Text>
              <Text style={styles.hivSub}>
                {String(entry.summary || entry.recommended_action || 'Review regimen and follow-up actions.')}
              </Text>
            </View>
          ))}

          {!hivQuery.isLoading && hivItems.length === 0 ? (
            <StatePanel state="empty" title="No HIV items" message="No active cohort records in this window." />
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  consultationCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4
  },
  consultationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  consultationMeta: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  consultationTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  consultationSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.sm
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  primaryButtonText: {
    color: '#022018',
    fontWeight: '700',
    fontSize: 13
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13
  },
  hivItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  hivTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  hivSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  disabled: {
    opacity: 0.55
  }
});
