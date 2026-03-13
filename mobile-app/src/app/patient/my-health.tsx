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
  usePatientCardioBloodPressureTrends,
  usePatientCardiologyEncounters,
  usePatientCarePlans,
  usePatientContinuity,
  usePatientDiabetesCarePlan,
  usePatientDiabetesMedications,
  usePatientDiabetesRegistry,
  usePatientGlucoseHistory,
  usePatientGoals,
  usePatientHealthMutations,
  usePatientLabResults,
  usePatientVitals
} from '../../features/patient/hooks/usePatientHealth';
import { formatDateTime, formatStatusLabel, safeArray, safeNumber } from '../../features/patient/utils/format';

export default function PatientMyHealthScreen() {
  const labsQuery = usePatientLabResults();
  const vitalsQuery = usePatientVitals();
  const diabetesRegistryQuery = usePatientDiabetesRegistry();
  const glucoseHistoryQuery = usePatientGlucoseHistory();
  const diabetesCarePlanQuery = usePatientDiabetesCarePlan();
  const diabetesMedicationsQuery = usePatientDiabetesMedications();
  const cardiologyEncountersQuery = usePatientCardiologyEncounters();
  const cardioBpTrendsQuery = usePatientCardioBloodPressureTrends();
  const goalsQuery = usePatientGoals();
  const carePlansQuery = usePatientCarePlans();
  const continuity = usePatientContinuity();
  const mutations = usePatientHealthMutations();

  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyEmail, setFamilyEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const labs = labsQuery.data || [];
  const vitals = vitalsQuery.data || [];
  const diabetesRegistry = diabetesRegistryQuery.data || [];
  const glucoseHistory = glucoseHistoryQuery.data || [];
  const diabetesMedications = diabetesMedicationsQuery.data || [];
  const cardiologyEncounters = cardiologyEncountersQuery.data || [];
  const cardioTrends = cardioBpTrendsQuery.data || [];
  const goals = goalsQuery.data || [];
  const carePlans = carePlansQuery.data || [];

  const continuityCounts = useMemo(
    () => ({
      questionnaires: continuity.questionnaires.data?.length || 0,
      consents: continuity.consents.data?.length || 0,
      pathways: continuity.pathways.data?.length || 0,
      immunizations: continuity.immunizations.data?.length || 0,
      immunizationForecast: continuity.immunizationForecast.data?.length || 0,
      admissionHistory: continuity.admissionHistory.data?.length || 0,
      edVisits: continuity.edVisits.data?.length || 0,
      familyAccess: continuity.familyAccess.data?.length || 0
    }),
    [
      continuity.admissionHistory.data?.length,
      continuity.consents.data?.length,
      continuity.edVisits.data?.length,
      continuity.familyAccess.data?.length,
      continuity.immunizationForecast.data?.length,
      continuity.immunizations.data?.length,
      continuity.pathways.data?.length,
      continuity.questionnaires.data?.length
    ]
  );

  const metrics = useMemo(
    () => [
      { label: 'Labs', value: labs.length, tone: 'info' as const },
      { label: 'Vitals', value: vitals.length, tone: 'success' as const },
      { label: 'Goals', value: goals.length, tone: goals.length > 0 ? ('info' as const) : ('neutral' as const) },
      {
        label: 'Care Plans',
        value: carePlans.length,
        tone: carePlans.length > 0 ? ('success' as const) : ('neutral' as const)
      }
    ],
    [carePlans.length, goals.length, labs.length, vitals.length]
  );

  const continuityLoading =
    continuity.questionnaires.isLoading ||
    continuity.consents.isLoading ||
    continuity.pathways.isLoading ||
    continuity.immunizations.isLoading;

  const continuityError =
    continuity.questionnaires.isError ||
    continuity.consents.isError ||
    continuity.pathways.isError ||
    continuity.immunizations.isError;

  const currentAdmission = continuity.currentAdmission.data || {};
  const firstConsent = continuity.consents.data?.[0];

  async function submitVitals() {
    await mutations.submitVitals.mutateAsync({
      bloodPressureSystolic: safeNumber(bpSystolic),
      bloodPressureDiastolic: safeNumber(bpDiastolic),
      notes: 'Submitted from patient mobile my-health.'
    });
    setFeedback('Vitals submitted successfully.');
    setBpSystolic('');
    setBpDiastolic('');
  }

  async function createGoal() {
    if (!goalTitle.trim()) return;
    await mutations.createGoal.mutateAsync({
      title: goalTitle.trim(),
      targetValue: safeNumber(goalTarget) || undefined,
      category: 'general',
      unit: 'value'
    });
    setFeedback('Goal created successfully.');
    setGoalTitle('');
    setGoalTarget('');
  }

  async function signFirstConsent() {
    if (!firstConsent?.id) return;
    await mutations.signConsent.mutateAsync({
      consentId: String(firstConsent.id),
      payload: {
        signerRole: 'patient',
        signatureType: 'typed',
        signedName: 'Patient Mobile'
      }
    });
    setFeedback('Consent signed successfully.');
  }

  async function declineFirstConsent() {
    if (!firstConsent?.id) return;
    await mutations.declineConsent.mutateAsync({
      consentId: String(firstConsent.id),
      payload: {
        reason: 'Declined from patient mobile companion.'
      }
    });
    setFeedback('Consent declined successfully.');
  }

  async function grantFamilyAccess() {
    if (!familyName.trim() || !familyEmail.trim()) return;
    await mutations.createFamilyAccess.mutateAsync({
      proxyName: familyName.trim(),
      proxyEmail: familyEmail.trim(),
      accessLevel: 'view_only'
    });
    setFeedback('Family access grant created.');
    setFamilyName('');
    setFamilyEmail('');
  }

  async function runJsonExport() {
    const result = await mutations.exportJson.mutateAsync();
    const keys = Object.keys(result || {});
    setFeedback(keys.length > 0 ? `JSON export prepared with ${keys.length} top-level fields.` : 'JSON export executed.');
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <PatientHero
          title="My Health"
          subtitle="Clinical trends, chronic care views, goals, care continuity modules, and data export controls."
        >
          <PatientMetricGrid items={metrics} />
        </PatientHero>

        {(labsQuery.isLoading || vitalsQuery.isLoading || goalsQuery.isLoading || carePlansQuery.isLoading) && (
          <StatePanel state="loading" title="Loading health data" message="Syncing labs, vitals, goals, and care plans..." />
        )}

        {(labsQuery.isError || vitalsQuery.isError || goalsQuery.isError || carePlansQuery.isError) && (
          <StatePanel state="error" title="Health data unavailable" message="Could not load core health datasets." />
        )}

        <Card>
          <PatientSectionHeader title="Labs & Vitals" subtitle="Recent patient-captured and clinician-recorded values" />
          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>Lab results: {labs.length}</Text>
            <Text style={styles.metricText}>Vitals entries: {vitals.length}</Text>
            <Text style={styles.metricText}>BP trends: {cardioTrends.length}</Text>
          </View>

          {vitals.slice(0, 4).map((entry, index) => (
            <View key={String(entry.id || `vital-${index}`)} style={styles.listCard}>
              <Text style={styles.titleText}>BP {String(entry.blood_pressure || `${entry.systolic || '-'} / ${entry.diastolic || '-'}`)}</Text>
              <Text style={styles.subText}>Recorded: {formatDateTime(String(entry.recorded_at || entry.created_at || null))}</Text>
            </View>
          ))}

          <View style={styles.rowActions}>
            <TextInput
              value={bpSystolic}
              onChangeText={setBpSystolic}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Systolic"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              value={bpDiastolic}
              onChangeText={setBpDiastolic}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Diastolic"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <Pressable
            disabled={mutations.submitVitals.isPending || !bpSystolic.trim() || !bpDiastolic.trim()}
            style={[
              styles.primaryButton,
              (mutations.submitVitals.isPending || !bpSystolic.trim() || !bpDiastolic.trim()) && styles.disabled
            ]}
            onPress={submitVitals}
          >
            <Text style={styles.primaryButtonText}>{mutations.submitVitals.isPending ? 'Submitting...' : 'Submit Vitals'}</Text>
          </Pressable>
        </Card>

        <Card>
          <PatientSectionHeader title="Chronic Care" subtitle="Diabetes and cardiology summaries" />
          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>Diabetes registry: {diabetesRegistry.length}</Text>
            <Text style={styles.metricText}>Glucose history: {glucoseHistory.length}</Text>
            <Text style={styles.metricText}>Cardiology encounters: {cardiologyEncounters.length}</Text>
            <Text style={styles.metricText}>Diabetes meds: {diabetesMedications.length}</Text>
          </View>

          <Text style={styles.subText}>
            Diabetes care plan status: {formatStatusLabel(String(diabetesCarePlanQuery.data?.status || 'not_available'))}
          </Text>

          {safeArray<Record<string, unknown>>(glucoseHistory).slice(0, 4).map((entry, index) => (
            <View key={String(entry.id || `glucose-${index}`)} style={styles.listCard}>
              <Text style={styles.titleText}>Glucose: {String(entry.value || entry.glucose_value || 'n/a')}</Text>
              <Text style={styles.subText}>Observed: {formatDateTime(String(entry.recorded_at || entry.created_at || null))}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <PatientSectionHeader title="Goals & Care Plans" subtitle="Self-management targets and care objectives" />

          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>Goals: {goals.length}</Text>
            <Text style={styles.metricText}>Care plans: {carePlans.length}</Text>
          </View>

          {goals.slice(0, 4).map((goal) => (
            <View key={goal.id} style={styles.listCard}>
              <View style={styles.rowTop}>
                <PatientStatusPill label={formatStatusLabel(String(goal.status || 'active'))} tone="info" />
                <Text style={styles.metaText}>Target {String(goal.target_value || goal.targetValue || 'n/a')}</Text>
              </View>
              <Text style={styles.titleText}>{String(goal.title || 'Health Goal')}</Text>
            </View>
          ))}

          <TextInput
            value={goalTitle}
            onChangeText={setGoalTitle}
            style={styles.input}
            placeholder="New goal title"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            value={goalTarget}
            onChangeText={setGoalTarget}
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Target value (optional)"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Pressable
            disabled={mutations.createGoal.isPending || !goalTitle.trim()}
            style={[styles.secondaryButton, (mutations.createGoal.isPending || !goalTitle.trim()) && styles.disabled]}
            onPress={createGoal}
          >
            <Text style={styles.secondaryButtonText}>{mutations.createGoal.isPending ? 'Creating...' : 'Create Goal'}</Text>
          </Pressable>
        </Card>

        <Card>
          <PatientSectionHeader title="Continuity Controls" subtitle="Questionnaires, consents, pathways, admissions, ED, family access, export" />

          {continuityLoading ? (
            <StatePanel state="loading" title="Loading continuity" message="Syncing continuity modules..." />
          ) : null}
          {continuityError ? (
            <StatePanel state="error" title="Continuity unavailable" message="Could not load one or more continuity modules." />
          ) : null}

          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>Questionnaires: {continuityCounts.questionnaires}</Text>
            <Text style={styles.metricText}>Consents: {continuityCounts.consents}</Text>
            <Text style={styles.metricText}>Pathways: {continuityCounts.pathways}</Text>
            <Text style={styles.metricText}>Immunizations: {continuityCounts.immunizations}</Text>
            <Text style={styles.metricText}>Forecast due: {continuityCounts.immunizationForecast}</Text>
            <Text style={styles.metricText}>Admission history: {continuityCounts.admissionHistory}</Text>
            <Text style={styles.metricText}>ED visits: {continuityCounts.edVisits}</Text>
            <Text style={styles.metricText}>Family access grants: {continuityCounts.familyAccess}</Text>
          </View>

          <Text style={styles.subText}>
            Current admission: {formatStatusLabel(String(currentAdmission.status || currentAdmission.admission_status || 'none'))}
          </Text>

          <View style={styles.rowActions}>
            <Pressable
              disabled={mutations.signConsent.isPending || !firstConsent?.id}
              style={[styles.outlineButton, (mutations.signConsent.isPending || !firstConsent?.id) && styles.disabled]}
              onPress={signFirstConsent}
            >
              <Text style={styles.outlineButtonText}>{mutations.signConsent.isPending ? 'Signing...' : 'Sign First Consent'}</Text>
            </Pressable>

            <Pressable
              disabled={mutations.declineConsent.isPending || !firstConsent?.id}
              style={[styles.outlineButton, (mutations.declineConsent.isPending || !firstConsent?.id) && styles.disabled]}
              onPress={declineFirstConsent}
            >
              <Text style={styles.outlineButtonText}>{mutations.declineConsent.isPending ? 'Updating...' : 'Decline First Consent'}</Text>
            </Pressable>
          </View>

          <TextInput
            value={familyName}
            onChangeText={setFamilyName}
            style={styles.input}
            placeholder="Family proxy name"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            value={familyEmail}
            onChangeText={setFamilyEmail}
            style={styles.input}
            placeholder="Family proxy email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Pressable
            disabled={mutations.createFamilyAccess.isPending || !familyName.trim() || !familyEmail.trim()}
            style={[
              styles.primaryButton,
              (mutations.createFamilyAccess.isPending || !familyName.trim() || !familyEmail.trim()) && styles.disabled
            ]}
            onPress={grantFamilyAccess}
          >
            <Text style={styles.primaryButtonText}>
              {mutations.createFamilyAccess.isPending ? 'Saving...' : 'Grant Family Access'}
            </Text>
          </Pressable>

          <Pressable
            disabled={mutations.exportJson.isPending}
            style={[styles.secondaryButton, mutations.exportJson.isPending && styles.disabled]}
            onPress={runJsonExport}
          >
            <Text style={styles.secondaryButtonText}>{mutations.exportJson.isPending ? 'Exporting...' : 'Run JSON Export'}</Text>
          </Pressable>
        </Card>

        {feedback ? <StatePanel state="empty" title="Update" message={feedback} /> : null}

        {(mutations.submitVitals.isError ||
          mutations.createGoal.isError ||
          mutations.signConsent.isError ||
          mutations.declineConsent.isError ||
          mutations.createFamilyAccess.isError ||
          mutations.exportJson.isError) && (
          <StatePanel
            state="error"
            title="Health action failed"
            message="One or more actions failed. Retry after a refresh."
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
  metricsRow: {
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  metricText: {
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  listCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4
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
    lineHeight: 16,
    marginBottom: theme.spacing.xs
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
    marginBottom: theme.spacing.sm,
    flex: 1
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  primaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  primaryButtonText: {
    color: '#032018',
    fontSize: 13,
    fontWeight: '700'
  },
  secondaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  secondaryButtonText: {
    color: '#EEF4FF',
    fontSize: 13,
    fontWeight: '700'
  },
  outlineButton: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  outlineButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  disabled: {
    opacity: 0.5
  }
});
