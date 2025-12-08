import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import patientService, { Patient } from '../../services/patient.service';
import prescriptionService from '../../services/prescription.service';
import labService from '../../services/lab.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import PatientSummaryCard from '../../components/patient/PatientSummaryCard';

const PatientDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activePrescriptions, setActivePrescriptions] = useState<any[]>([]);
  const [recentLabs, setRecentLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPatientData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, prescriptions, labs] = await Promise.allSettled([
        patientService.getPatientProfile(patientId),
        prescriptionService.getActivePrescriptions(patientId),
        labService.getPatientLabResults(patientId),
      ]);

      if (patientData.status === 'fulfilled') {
        setPatient(patientData.value);
      } else {
        console.error('Error loading patient:', patientData.reason);
      }

      if (prescriptions.status === 'fulfilled') {
        setActivePrescriptions(prescriptions.value);
      } else {
        console.error('Error loading prescriptions:', prescriptions.reason);
        setActivePrescriptions([]); // Set empty array on error
      }

      if (labs.status === 'fulfilled') {
        setRecentLabs(Array.isArray(labs.value) ? labs.value.slice(0, 5) : []);
      } else {
        console.error('Error loading labs:', labs.reason);
        setRecentLabs([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Patient Details" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Patient Details" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Patient not found</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={patient.patientNumber ? `ID: ${patient.patientNumber}` : undefined}
      />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Enhanced Patient Summary Card */}
        <PatientSummaryCard patientId={patientId} patient={patient} />

        <GlassCard style={styles.section} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>Demographics</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth:</Text>
            <Text style={styles.infoValue}>{patient.dateOfBirth}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender:</Text>
            <Text style={styles.infoValue}>{patient.gender}</Text>
          </View>
          {patient.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{patient.phone}</Text>
            </View>
          )}
          {patient.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{patient.email}</Text>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.section} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Prescriptions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButton}>+ Prescribe</Text>
            </TouchableOpacity>
          </View>
          {activePrescriptions.length > 0 ? (
            activePrescriptions.map((prescription) => (
              <View key={prescription.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{prescription.medication}</Text>
                <Text style={styles.itemSubtitle}>
                  {prescription.dosage} - {prescription.frequency}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active prescriptions</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.section} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Lab Results</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButton}>+ Order Lab</Text>
            </TouchableOpacity>
          </View>
          {recentLabs.length > 0 ? (
            recentLabs.map((lab) => (
              <View key={lab.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{lab.testName}</Text>
                <Text style={styles.itemSubtitle}>
                  {lab.value} {lab.unit} - {lab.status}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent lab results</Text>
          )}
        </GlassCard>

        {/* Clinical Documentation Quick Access */}
        <GlassCard style={styles.section} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>Clinical Documentation</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ClinicalNotes' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>📝</Text>
              <Text style={styles.quickActionText}>Clinical Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ProblemList' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>⚠️</Text>
              <Text style={styles.quickActionText}>Problems</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Allergies' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>🚨</Text>
              <Text style={styles.quickActionText}>Allergies</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ChartReview' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={styles.quickActionText}>Chart Review</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <PrimaryButton
            title="Create Appointment"
            onPress={() => navigation.navigate('CreateAppointment' as never, { patientId } as never)}
            icon="📅"
          />
          <PrimaryButton
            title="Prescribe Medication"
            onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
            icon="💊"
          />
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Order Lab Test</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  content: {
    padding: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.label,
    width: 120,
    color: colors.textTertiary,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  actionButton: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PatientDetailScreen;
