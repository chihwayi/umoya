import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { ProviderHero, MetricGrid } from '../../features/provider/ui/ProviderHero';
import { useNurseWorklistState, useWorkflowMutations } from '../../features/provider/hooks/useProviderWorkflows';

export default function NurseVitalsScreen() {
  const [taskId, setTaskId] = useState('');
  const [alertId, setAlertId] = useState('');
  const [reason, setReason] = useState('');

  const stateQuery = useNurseWorklistState();
  const { completeTask, acknowledgeAlert } = useWorkflowMutations();

  const completedTaskIds = stateQuery.data?.completedTaskIds || [];
  const acknowledgedAlertIds = stateQuery.data?.acknowledgedAlertIds || [];

  const metrics = useMemo(
    () => [
      { label: 'Completed Tasks', value: completedTaskIds.length, tone: 'success' as const },
      { label: 'Acknowledged Alerts', value: acknowledgedAlertIds.length, tone: 'info' as const },
      {
        label: 'State Sync',
        value: stateQuery.isFetching ? 'syncing' : 'live',
        tone: stateQuery.isFetching ? ('warning' as const) : ('success' as const)
      }
    ],
    [completedTaskIds.length, acknowledgedAlertIds.length, stateQuery.isFetching]
  );

  async function submitTaskCompletion() {
    if (!taskId.trim()) {
      return;
    }

    await completeTask.mutateAsync({
      taskId: taskId.trim(),
      payload: {
        reason: reason.trim() || 'Completed from nurse mobile vitals board.',
        context: {
          source: 'nurse_mobile_vitals'
        }
      }
    });

    setTaskId('');
  }

  async function submitAlertAcknowledgement() {
    if (!alertId.trim()) {
      return;
    }

    await acknowledgeAlert.mutateAsync({
      alertId: alertId.trim(),
      payload: {
        reason: reason.trim() || 'Acknowledged from nurse mobile vitals board.',
        context: {
          source: 'nurse_mobile_vitals'
        }
      }
    });

    setAlertId('');
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ProviderHero
          title="Nurse Vitals & Actions"
          subtitle="Capture and close task/alert actions with auditable nurse workflow state."
        >
          <MetricGrid items={metrics} />
        </ProviderHero>

        {stateQuery.isLoading ? (
          <StatePanel state="loading" title="Loading state" message="Fetching nurse task/alert state..." />
        ) : null}
        {stateQuery.isError ? (
          <StatePanel state="error" title="State unavailable" message="Could not load nurse worklist state." />
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Complete Task</Text>
          <TextInput
            value={taskId}
            onChangeText={setTaskId}
            style={styles.input}
            placeholder="Task ID"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={[styles.input, styles.textarea]}
            placeholder="Reason / context"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          <Pressable
            style={[styles.buttonPrimary, completeTask.isPending && styles.disabled]}
            onPress={submitTaskCompletion}
            disabled={completeTask.isPending}
          >
            <Text style={styles.buttonPrimaryText}>{completeTask.isPending ? 'Submitting...' : 'Complete Task'}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Acknowledge Alert</Text>
          <TextInput
            value={alertId}
            onChangeText={setAlertId}
            style={styles.input}
            placeholder="Alert ID"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Pressable
            style={[styles.buttonSecondary, acknowledgeAlert.isPending && styles.disabled]}
            onPress={submitAlertAcknowledgement}
            disabled={acknowledgeAlert.isPending}
          >
            <Text style={styles.buttonSecondaryText}>
              {acknowledgeAlert.isPending ? 'Submitting...' : 'Acknowledge Alert'}
            </Text>
          </Pressable>

          {completeTask.isError || acknowledgeAlert.isError ? (
            <StatePanel state="error" title="Action failed" message="Verify IDs and retry the action." />
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Recent Completed Task IDs</Text>
          {completedTaskIds.slice(0, 8).map((id) => (
            <Text style={styles.idRow} key={id}>
              {id}
            </Text>
          ))}
          {completedTaskIds.length === 0 ? (
            <StatePanel state="empty" title="No completed tasks" message="Completed task IDs will appear here." />
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Recent Acknowledged Alert IDs</Text>
          {acknowledgedAlertIds.slice(0, 8).map((id) => (
            <Text style={styles.idRow} key={id}>
              {id}
            </Text>
          ))}
          {acknowledgedAlertIds.length === 0 ? (
            <StatePanel state="empty" title="No acknowledged alerts" message="Acknowledged alert IDs will appear here." />
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
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 13,
    marginBottom: theme.spacing.sm
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top'
  },
  buttonPrimary: {
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
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  buttonSecondaryText: {
    color: '#EEF4FF',
    fontWeight: '700',
    fontSize: 13
  },
  idRow: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  disabled: {
    opacity: 0.55
  }
});
