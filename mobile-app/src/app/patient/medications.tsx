import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { PatientHero, PatientMetricGrid } from '../../features/patient/ui/PatientHero';
import { PatientSectionHeader } from '../../features/patient/ui/SectionHeader';
import { PatientStatusPill } from '../../features/patient/ui/StatusPill';
import {
  usePatientAdherenceLogs,
  usePatientAdherenceSummary,
  usePatientMedicationMutations,
  usePatientMedicationReminders,
  usePatientPrescriptions,
  usePatientRefillRequests
} from '../../features/patient/hooks/usePatientMedications';
import { formatDateTime, formatStatusLabel, safeArray, safeNumber } from '../../features/patient/utils/format';
import type { MedicationReminder, PatientPrescription, RefillRequest } from '../../services/api/patient';

function prescriptionTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'success' as const;
  if (normalized === 'paused' || normalized === 'pending') return 'warning' as const;
  if (normalized === 'stopped' || normalized === 'expired') return 'critical' as const;
  return 'neutral' as const;
}

function reminderForPrescription(reminders: MedicationReminder[], prescription: PatientPrescription) {
  return reminders.find(
    (item) =>
      String(item.prescription_id || item.prescriptionId || '') ===
      String(prescription.id)
  );
}

function getMedicationLabel(prescription: PatientPrescription): string {
  return String(
    prescription.medication_name || prescription.medicationName || prescription.drug_name || prescription.medication || 'Medication'
  );
}

function getDoseLabel(prescription: PatientPrescription): string {
  const dosage = String(prescription.dosage || prescription.dose || '').trim();
  const frequency = String(prescription.frequency || '').trim();
  if (dosage && frequency) return `${dosage} · ${frequency}`;
  return dosage || frequency || 'Dose schedule not specified';
}

export default function PatientMedicationsScreen() {
  const prescriptionsQuery = usePatientPrescriptions();
  const remindersQuery = usePatientMedicationReminders();
  const refillRequestsQuery = usePatientRefillRequests();
  const adherenceSummaryQuery = usePatientAdherenceSummary();
  const adherenceLogsQuery = usePatientAdherenceLogs();
  const mutations = usePatientMedicationMutations();

  const [refillReason, setRefillReason] = useState('');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [workingPrescriptionId, setWorkingPrescriptionId] = useState<string | null>(null);

  const prescriptions = prescriptionsQuery.data || [];
  const reminders = remindersQuery.data || [];
  const refillRequests = refillRequestsQuery.data || [];
  const adherenceLogs = adherenceLogsQuery.data || [];

  const adherenceSummary = adherenceSummaryQuery.data || {};
  const adherenceRate = safeNumber(
    adherenceSummary.overallRate || adherenceSummary.adherenceRate || adherenceSummary.rate || 0
  );

  const metrics = useMemo(
    () => [
      { label: 'Prescriptions', value: prescriptions.length, tone: 'info' as const },
      {
        label: 'Active Reminders',
        value: reminders.filter((item) => Boolean(item.is_active ?? item.isActive ?? true)).length,
        tone: 'success' as const
      },
      {
        label: 'Adherence',
        value: `${Math.round(adherenceRate)}%`,
        tone: adherenceRate >= 80 ? ('success' as const) : ('warning' as const)
      },
      {
        label: 'Refill Requests',
        value: refillRequests.length,
        tone: refillRequests.length > 0 ? ('info' as const) : ('neutral' as const)
      }
    ],
    [adherenceRate, prescriptions.length, refillRequests.length, reminders]
  );

  async function onToggleReminder(prescription: PatientPrescription) {
    try {
      setWorkingPrescriptionId(prescription.id);
      const reminder = reminderForPrescription(reminders, prescription);

      if (reminder?.id) {
        await mutations.updateReminder.mutateAsync({
          reminderId: reminder.id,
          payload: {
            isActive: !Boolean(reminder.is_active ?? reminder.isActive ?? true),
            reminderTime,
            reminderDays: safeArray<number>(reminder.reminder_days || reminder.reminderDays || [1, 2, 3, 4, 5])
          }
        });
        return;
      }

      await mutations.createReminder.mutateAsync({
        prescriptionId: prescription.id,
        payload: {
          reminderTime,
          reminderDays: [1, 2, 3, 4, 5],
          reminderType: 'push',
          timezone: 'Africa/Harare'
        }
      });
    } finally {
      setWorkingPrescriptionId(null);
    }
  }

  async function onRequestRefill(prescription: PatientPrescription) {
    try {
      setWorkingPrescriptionId(prescription.id);
      await mutations.requestRefill.mutateAsync({
        prescriptionId: prescription.id,
        payload: {
          reason: refillReason.trim() || 'Patient mobile refill request',
          urgency: 'normal'
        }
      });
      setRefillReason('');
    } finally {
      setWorkingPrescriptionId(null);
    }
  }

  async function onMarkTaken(prescription: PatientPrescription) {
    try {
      setWorkingPrescriptionId(prescription.id);
      const now = new Date().toISOString();
      await mutations.logAdherence.mutateAsync({
        prescriptionId: prescription.id,
        payload: {
          scheduledTime: now,
          taken: true,
          takenTime: now,
          notes: 'Logged from patient mobile medications.'
        }
      });
    } finally {
      setWorkingPrescriptionId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <PatientHero
          title="Medications"
          subtitle="Manage prescriptions, reminders, adherence logs, and refill requests."
        >
          <PatientMetricGrid items={metrics} />
        </PatientHero>

        {(prescriptionsQuery.isLoading || remindersQuery.isLoading || adherenceSummaryQuery.isLoading) && (
          <StatePanel state="loading" title="Loading medications" message="Syncing prescriptions and adherence data..." />
        )}

        {(prescriptionsQuery.isError || remindersQuery.isError || adherenceSummaryQuery.isError) && (
          <StatePanel state="error" title="Medication data unavailable" message="Could not load your medication data." />
        )}

        <Card>
          <PatientSectionHeader title="Reminder Defaults" subtitle="Used for quick reminder toggles" />
          <TextInput
            value={reminderTime}
            onChangeText={setReminderTime}
            style={styles.input}
            placeholder="Reminder time (HH:MM)"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            value={refillReason}
            onChangeText={setRefillReason}
            style={[styles.input, styles.textarea]}
            placeholder="Optional refill reason"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </Card>

        <Card>
          <PatientSectionHeader title="Prescription List" subtitle={`${prescriptions.length} medication(s)`} />

          {prescriptions.map((prescription) => {
            const reminder = reminderForPrescription(reminders, prescription);
            const reminderActive = Boolean(reminder?.is_active ?? reminder?.isActive ?? false);
            const busy = workingPrescriptionId === prescription.id;

            return (
              <View key={prescription.id} style={styles.listCard}>
                <View style={styles.rowTop}>
                  <PatientStatusPill
                    label={formatStatusLabel(String(prescription.status || 'active'))}
                    tone={prescriptionTone(prescription.status)}
                  />
                  <Text style={styles.metaText}>{formatDateTime(String(prescription.start_date || null))}</Text>
                </View>

                <Text style={styles.titleText}>{getMedicationLabel(prescription)}</Text>
                <Text style={styles.subText}>{getDoseLabel(prescription)}</Text>

                {reminder ? (
                  <Text style={styles.subText}>
                    Reminder: {String(reminder.reminder_time || reminder.reminderTime || 'n/a')} ·{' '}
                    {reminderActive ? 'Active' : 'Paused'}
                  </Text>
                ) : (
                  <Text style={styles.subText}>Reminder not set</Text>
                )}

                <View style={styles.rowActions}>
                  <Pressable
                    disabled={busy}
                    style={[styles.secondaryButton, busy && styles.disabled]}
                    onPress={() => onToggleReminder(prescription)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {busy ? 'Working...' : reminderActive ? 'Pause Reminder' : 'Enable Reminder'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    style={[styles.primaryButton, busy && styles.disabled]}
                    onPress={() => onMarkTaken(prescription)}
                  >
                    <Text style={styles.primaryButtonText}>{busy ? 'Working...' : 'Mark Taken'}</Text>
                  </Pressable>
                </View>

                <Pressable
                  disabled={busy}
                  style={[styles.ghostButton, busy && styles.disabled]}
                  onPress={() => onRequestRefill(prescription)}
                >
                  <Text style={styles.ghostButtonText}>{busy ? 'Working...' : 'Request Refill'}</Text>
                </Pressable>
              </View>
            );
          })}

          {!prescriptionsQuery.isLoading && prescriptions.length === 0 ? (
            <StatePanel state="empty" title="No prescriptions" message="Prescriptions will appear once issued by your clinician." />
          ) : null}
        </Card>

        <Card>
          <PatientSectionHeader title="Refill Requests" subtitle={`${refillRequests.length} request(s)`} />
          {refillRequests.slice(0, 8).map((request: RefillRequest) => (
            <View key={request.id} style={styles.listCard}>
              <View style={styles.rowTop}>
                <PatientStatusPill label={formatStatusLabel(String(request.status || 'pending'))} tone="info" />
                <Text style={styles.metaText}>{formatDateTime(request.created_at || null)}</Text>
              </View>
              <Text style={styles.subText}>
                Quantity: {safeNumber((request.requested_quantity ?? request.requestedQuantity ?? 0))}
              </Text>
            </View>
          ))}

          {!refillRequestsQuery.isLoading && refillRequests.length === 0 ? (
            <StatePanel state="empty" title="No refill requests" message="Refill request history will appear here." />
          ) : null}
        </Card>

        <Card>
          <PatientSectionHeader title="Adherence Logs" subtitle={`${adherenceLogs.length} recent entries`} />

          {adherenceLogs.slice(0, 10).map((log, index) => (
            <View key={String(log.id || `log-${index}`)} style={styles.listCard}>
              <Text style={styles.titleText}>{formatStatusLabel(String(log.taken ? 'taken' : 'missed'))}</Text>
              <Text style={styles.subText}>Scheduled: {formatDateTime(String(log.scheduled_time || log.scheduledTime || null))}</Text>
              <Text style={styles.subText}>Recorded: {formatDateTime(String(log.taken_time || log.takenTime || log.created_at || null))}</Text>
            </View>
          ))}

          {!adherenceLogsQuery.isLoading && adherenceLogs.length === 0 ? (
            <StatePanel state="empty" title="No adherence logs" message="Mark medications as taken to build your adherence history." />
          ) : null}
        </Card>

        {(mutations.requestRefill.isError ||
          mutations.createReminder.isError ||
          mutations.updateReminder.isError ||
          mutations.logAdherence.isError) && (
          <StatePanel
            state="error"
            title="Medication action failed"
            message="One or more medication actions failed. Retry after refreshing data."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
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
  listCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  subText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm
  },
  primaryButton: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  primaryButtonText: {
    color: '#032018',
    fontSize: 12,
    fontWeight: '700'
  },
  secondaryButton: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  ghostButton: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(166,108,255,0.5)',
    backgroundColor: 'rgba(166,108,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  ghostButtonText: {
    color: theme.colors.accentPurple,
    fontSize: 12,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.5
  }
});
