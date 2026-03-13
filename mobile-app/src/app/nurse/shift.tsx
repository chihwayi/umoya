import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { WorkflowFeedCard } from '../../features/provider/ui/WorkflowFeedCard';
import { useNurseCrossModuleFeed, useWorkflowMutations } from '../../features/provider/hooks/useProviderWorkflows';
import type { NurseCrossModuleFeedItem } from '../../services/api/provider';

export default function NurseShiftScreen() {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const feedQuery = useNurseCrossModuleFeed();
  const { updateWorkflow } = useWorkflowMutations();

  const items = feedQuery.data?.items || [];

  const metrics = useMemo(() => {
    const critical = items.filter((item) => item.severity === 'critical').length;
    const high = items.filter((item) => item.severity === 'high').length;
    const pending = items.filter((item) => String(item.workflow_status || '').toLowerCase() === 'pending').length;

    return [
      { label: 'Queue', value: items.length, tone: 'info' as const },
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
        note: status === 'completed' ? 'Completed from nurse shift queue.' : 'Acknowledged from nurse shift queue.',
        context: {
          source: 'nurse_mobile_shift',
          workflowStatus: item.workflow_status || null,
          moduleStatus: item.module_status || null
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
      <ScrollView contentContainerStyle={styles.container}>
        <ProviderHero
          title="Nurse Shift Dashboard"
          subtitle="Cross-module tasks and escalation bundles aligned to current shift workflow."
        >
          <MetricGrid items={metrics} />
        </ProviderHero>

        {feedQuery.isLoading ? <StatePanel state="loading" title="Loading shift feed" message="Syncing nurse queue..." /> : null}
        {feedQuery.isError ? <StatePanel state="error" title="Queue unavailable" message="Could not load nurse cross-module feed." /> : null}

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
          <StatePanel state="empty" title="Shift queue clear" message="No pending cross-module actions for now." />
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
