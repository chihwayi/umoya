import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { WorkflowFeedCard } from '../../features/provider/ui/WorkflowFeedCard';
import { useDoctorSyncFeed, useWorkflowMutations } from '../../features/provider/hooks/useProviderWorkflows';
import type { NurseCrossModuleFeedItem } from '../../services/api/provider';

export default function DoctorInboxScreen() {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const feedQuery = useDoctorSyncFeed({ includeAcknowledged: true });
  const { updateWorkflow } = useWorkflowMutations();

  const items = feedQuery.data?.items || [];
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await feedQuery.refetch();
    setRefreshing(false);
  }, [feedQuery]);

  const metrics = useMemo(() => {
    const critical = items.filter((item) => item.severity === 'critical').length;
    const high = items.filter((item) => item.severity === 'high').length;
    const pending = items.filter((item) => String(item.workflow_status || '').toLowerCase() === 'pending').length;

    return [
      { label: 'Sync Queue', value: items.length, tone: 'info' as const },
      { label: 'Critical', value: critical, tone: critical > 0 ? ('critical' as const) : ('success' as const) },
      { label: 'High', value: high, tone: high > 0 ? ('warning' as const) : ('neutral' as const) },
      { label: 'Pending', value: pending, tone: pending > 0 ? ('warning' as const) : ('success' as const) }
    ];
  }, [items]);

  async function handleStatusChange(item: NurseCrossModuleFeedItem, status: 'acknowledged' | 'completed') {
    try {
      setBusyItemId(item.id);
      await updateWorkflow.mutateAsync({
        itemId: item.id,
        module: item.module,
        itemType: item.item_type,
        sourceRecordId: item.source_record_id || null,
        patientId: item.patient_id || null,
        enrollmentId: item.enrollment_id || null,
        status,
        note: status === 'completed' ? 'Completed from doctor mobile inbox.' : 'Acknowledged from doctor mobile inbox.',
        context: {
          source: 'doctor_mobile_inbox',
          doctorSyncStatus: item.doctor_sync_status || null,
          workflowStatus: item.workflow_status || null
        },
        destinationRole: item.destination_role || null,
        destinationService: item.destination_service || null,
        destinationSpecialty: item.destination_specialty || null,
        destinationUserId: item.destination_user_id || null,
        destinationFacilityId: item.destination_facility_id || null,
        destinationFacilityName: item.destination_facility_name || null
      });
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentTeal} />
        }
      >
        <ProviderHero
          title="Doctor Coordination Inbox"
          subtitle="Critical cross-module escalations with SLA-sensitive workflow actions."
        >
          <MetricGrid items={metrics} />
        </ProviderHero>

        {feedQuery.isLoading ? <StatePanel state="loading" title="Loading inbox" message="Syncing doctor workflow feed..." /> : null}
        {feedQuery.isError ? <StatePanel state="error" title="Inbox unavailable" message="Could not load doctor synchronization feed." /> : null}

        {items.map((item) => (
          <WorkflowFeedCard
            key={item.id}
            item={item}
            busy={busyItemId === item.id}
            onAcknowledge={(entry) => handleStatusChange(entry, 'acknowledged')}
            onComplete={(entry) => handleStatusChange(entry, 'completed')}
          />
        ))}

        {!feedQuery.isLoading && !feedQuery.isError && items.length === 0 ? (
          <StatePanel state="empty" title="No active escalations" message="Doctor synchronization queue is currently clear." />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  }
});
